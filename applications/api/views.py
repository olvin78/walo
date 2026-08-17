from __future__ import annotations

import logging
from datetime import datetime

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Exists, OuterRef, Prefetch, Q
from django.http import Http404
from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
import requests

from applications.core import paypal
from applications.core import stripe_client
from applications.api.filters import normalize_listing_ordering, search_listing_queryset
from applications.api.permissions import IsOwnerOrAdminOrReadOnly
from applications.api.serializers import (
    CategorySerializer,
    ConversationSerializer,
    ListingDetailSerializer,
    ListingSummarySerializer,
    ListingWriteSerializer,
    MeSerializer,
    MessageSerializer,
    MobileTokenObtainPairSerializer,
    NotificationSerializer,
    PasswordChangeSerializer,
    ProfileRatingSerializer,
    ProfileReviewSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    StorySerializer,
    ListingReportSerializer,
    BugReportSerializer,
    absolute_media_url,
)
from applications.core.models import BugReport, Category, Conversation, Listing, ListingImage, MarketingConsent, Message, Notification, Profile, ProfileReview, SearchHistory, Story, SystemPaymentSetting


User = get_user_model()

logger = logging.getLogger(__name__)


def listing_queryset(include_inactive: bool = False):
    queryset = (
        Listing.objects.select_related("category", "subcategory", "user", "user__profile")
        .prefetch_related(Prefetch("images", queryset=ListingImage.objects.order_by("created_at", "id")))
        .order_by("-created_at")
    )
    if not include_inactive:
        queryset = queryset.filter(is_active=True)
    return queryset


def annotate_favorite_flag(queryset, user):
    if not user or not user.is_authenticated:
        return queryset

    favorite_subquery = Listing.favorites.through.objects.filter(listing_id=OuterRef("pk"), user_id=user.id)
    return queryset.annotate(is_favorite=Exists(favorite_subquery))


def filter_listing_queryset(queryset, params):
    queryset, _ = filter_listing_queryset_with_metadata(queryset, params)
    return queryset


def filter_listing_queryset_with_metadata(queryset, params):
    query = params.get("q") or params.get("search")
    category_value = params.get("category")
    subcategory_value = params.get("subcategory")
    location = params.get("location")
    ordering = normalize_listing_ordering(params.get("ordering") or params.get("sort"))
    min_price = params.get("min_price")
    max_price = params.get("max_price")

    if category_value:
        if str(category_value).isdigit():
            queryset = queryset.filter(category_id=category_value)
        else:
            queryset = queryset.filter(Q(category__slug=category_value) | Q(category__name__iexact=category_value))

    if subcategory_value:
        if str(subcategory_value).isdigit():
            queryset = queryset.filter(subcategory_id=subcategory_value)
        else:
            queryset = queryset.filter(Q(subcategory__slug=subcategory_value) | Q(subcategory__name__iexact=subcategory_value))

    if location and location != 'Todo Nicaragua':
        queryset = queryset.filter(location__icontains=location)

    if min_price:
        try:
            queryset = queryset.filter(price__gte=float(min_price))
        except (ValueError, TypeError):
            pass

    if max_price:
        try:
            queryset = queryset.filter(price__lte=float(max_price))
        except (ValueError, TypeError):
            pass

    queryset, exact_matches = search_listing_queryset(queryset, query)
    return queryset.order_by(ordering), exact_matches


class CategoryListAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return Category.objects.annotate(
            total_active_listings=Count("listings", filter=Q(listings__is_active=True), distinct=True)
        ).order_by("order", "name")


class ListingListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ListingWriteSerializer
        return ListingSummarySerializer

    def get_queryset(self):
        queryset = listing_queryset(include_inactive=False)
        queryset = annotate_favorite_flag(queryset, self.request.user)
        return filter_listing_queryset(queryset, self.request.query_params)

    def get_serializer(self, *args, **kwargs):
        if self.request.method in {"POST", "PATCH", "PUT"} and hasattr(self.request, "FILES"):
            data = self.request.data.copy()
            if self.request.FILES.getlist("images"):
                data.setlist("images", self.request.FILES.getlist("images"))
            if self.request.FILES.get("main_image"):
                data["main_image"] = self.request.FILES.get("main_image")
            kwargs["data"] = data
        return super().get_serializer(*args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.error("Listing create invalid payload for user %s: %s", request.user, dict(serializer.errors))
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save()


class ListingSearchAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ListingSummarySerializer

    def get_queryset(self):
        queryset = listing_queryset(include_inactive=False)
        queryset = annotate_favorite_flag(queryset, self.request.user)
        queryset, self.exact_matches = filter_listing_queryset_with_metadata(queryset, self.request.query_params)
        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, dict):
            response.data["exact_matches"] = getattr(self, "exact_matches", True)
        return response


class ListingDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsOwnerOrAdminOrReadOnly]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_serializer_class(self):
        if self.request.method in {"PATCH", "PUT"}:
            return ListingWriteSerializer
        return ListingDetailSerializer

    def get_queryset(self):
        queryset = listing_queryset(include_inactive=True)
        return annotate_favorite_flag(queryset, self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not instance.is_active and instance.user != request.user and not request.user.is_staff:
            raise Http404
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def get_serializer(self, *args, **kwargs):
        if self.request.method in {"PATCH", "PUT"} and hasattr(self.request, "FILES"):
            data = self.request.data.copy()
            if self.request.FILES.getlist("images"):
                data.setlist("images", self.request.FILES.getlist("images"))
            if self.request.FILES.get("main_image"):
                data["main_image"] = self.request.FILES.get("main_image")
            kwargs["data"] = data
            kwargs["partial"] = self.request.method == "PATCH"
        return super().get_serializer(*args, **kwargs)


class HomeAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        categories = Category.objects.annotate(
            total_active_listings=Count("listings", filter=Q(listings__is_active=True), distinct=True)
        ).order_by("order", "name")[:8]

        latest = annotate_favorite_flag(listing_queryset(include_inactive=False), request.user)[:12]
        featured = annotate_favorite_flag(
            listing_queryset(include_inactive=False).annotate(favorites_count=Count("favorites", distinct=True)).order_by("-favorites_count", "-created_at"),
            request.user,
        )[:12]

        recommended = listing_queryset(include_inactive=False)
        if request.user.is_authenticated:
            recommended = recommended.exclude(user=request.user)
            favorite_categories = list(
                Listing.objects.filter(favorites=request.user, is_active=True)
                .values_list("category_id", flat=True)
                .distinct()[:3]
            )
            if favorite_categories:
                recommended = recommended.filter(category_id__in=favorite_categories)
        recommended = annotate_favorite_flag(recommended, request.user)[:12]

        popular_searches = list(
            SearchHistory.objects.values("normalized_query")
            .annotate(total=Count("id"))
            .order_by("-total", "normalized_query")[:8]
        )

        payload = {
            "brand": "IGUALO",
            "base_url": settings.PUBLIC_BASE_URL.rstrip("/"),
            "categories": CategorySerializer(categories, many=True, context={"request": request}).data,
            "latest": ListingSummarySerializer(latest, many=True, context={"request": request}).data,
            "featured": ListingSummarySerializer(featured, many=True, context={"request": request}).data,
            "recommended": ListingSummarySerializer(recommended, many=True, context={"request": request}).data,
            "popular_searches": [item["normalized_query"] for item in popular_searches],
        }
        return Response(payload)


class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        profile.maybe_expire_pro()
        return Response(MeSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        user = request.user

        if str(request.data.get("toggle_plan")) == "1":
            if not SystemPaymentSetting.get_solo().enabled:
                return Response({"detail": "El sistema de planes no está disponible en este momento."}, status=status.HTTP_403_FORBIDDEN)
            profile, _ = Profile.objects.get_or_create(user=user)
            if not profile.is_pro:
                # Pasar a PRO requiere una suscripción verificada: ver PayPalCreateSubscriptionAPIView /
                # PayPalConfirmSubscriptionAPIView / StripeCreateCheckoutSessionAPIView. Este endpoint
                # solo permite cancelar el plan.
                return Response(
                    {"detail": "Para activar el plan PRO completa el pago con PayPal."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.is_pro = False
            profile.save(update_fields=["is_pro"])
            return Response(MeSerializer(user, context={"request": request}).data)

        # Update User fields (email)
        email = request.data.get("email")
        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")
        allows_notifications = request.data.get("allows_notifications")
        
        should_save_user = False
        if email:
            if User.objects.exclude(pk=user.pk).filter(email=email).exists():
                return Response({"email": ["Este correo ya está en uso."]}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email
            should_save_user = True
        
        if first_name is not None:
            user.first_name = first_name
            should_save_user = True
            
        if last_name is not None:
            user.last_name = last_name
            should_save_user = True

        if allows_notifications is not None:
            if isinstance(allows_notifications, str):
                allows_notifications = allows_notifications.strip().lower() in {"1", "true", "yes", "on"}
            else:
                allows_notifications = bool(allows_notifications)

            MarketingConsent.objects.update_or_create(
                user=user,
                defaults={
                    "email": user.email,
                    "allows_notifications": allows_notifications,
                    "allows_marketing": MarketingConsent.objects.filter(user=user).order_by("-created_at").values_list("allows_marketing", flat=True).first() or False,
                },
            )
            
        if should_save_user:
            user.save()

        # Update Profile fields
        profile, _ = Profile.objects.get_or_create(user=user)
        serializer = ProfileUpdateSerializer(profile, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(MeSerializer(user, context={"request": request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PayPalCreateSubscriptionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not SystemPaymentSetting.get_solo().enabled:
            return Response({"detail": "El sistema de planes no está disponible en este momento."}, status=status.HTTP_403_FORBIDDEN)
        return_url = request.data.get("return_url")
        if not return_url:
            return Response({"detail": "Falta return_url."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            subscription = paypal.create_subscription(user_id=request.user.id, return_url=return_url, cancel_url=return_url)
        except paypal.PayPalError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        approve_url = next((link["href"] for link in subscription.get("links", []) if link.get("rel") == "approve"), None)
        return Response({"id": subscription["id"], "approve_url": approve_url})


class PayPalConfirmSubscriptionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        subscription_id = request.data.get("subscription_id")
        if not subscription_id:
            return Response({"detail": "Falta subscription_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            subscription = paypal.get_subscription(subscription_id=subscription_id)
        except paypal.PayPalError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        if subscription.get("status") != "ACTIVE":
            return Response({"detail": "La suscripción de PayPal no está activa."}, status=status.HTTP_400_BAD_REQUEST)

        if subscription.get("custom_id") != str(request.user.id):
            logger.warning("PayPal subscription user mismatch: sub=%s user=%s", subscription_id, request.user.id)
            return Response({"detail": "La suscripción no corresponde a este usuario."}, status=status.HTTP_400_BAD_REQUEST)

        if subscription.get("plan_id") != settings.PAYPAL_PLAN_ID:
            logger.warning("PayPal subscription plan mismatch: sub=%s plan=%s", subscription_id, subscription.get("plan_id"))
            return Response({"detail": "El plan de la suscripción no coincide con el de Igualo PRO."}, status=status.HTTP_400_BAD_REQUEST)

        next_billing_time = subscription.get("billing_info", {}).get("next_billing_time")
        profile, _ = Profile.objects.get_or_create(user=request.user)
        profile.is_pro = True
        profile.paypal_subscription_id = subscription_id
        profile.pro_activated_at = timezone.now()
        profile.pro_current_period_end = parse_datetime(next_billing_time) if next_billing_time else None
        profile.pro_cancel_at_period_end = False
        profile.save(update_fields=[
            "is_pro", "paypal_subscription_id", "pro_activated_at",
            "pro_current_period_end", "pro_cancel_at_period_end",
        ])
        return Response(MeSerializer(request.user, context={"request": request}).data)


class PayPalCancelSubscriptionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        if not profile.paypal_subscription_id:
            return Response({"detail": "No tienes una suscripción de PayPal activa."}, status=status.HTTP_400_BAD_REQUEST)

        refunded = False
        try:
            if profile.refund_eligible() and profile.pro_activated_at:
                start_time = profile.pro_activated_at.strftime("%Y-%m-%dT%H:%M:%SZ")
                end_time = timezone.now().strftime("%Y-%m-%dT%H:%M:%SZ")
                paypal.cancel_subscription(subscription_id=profile.paypal_subscription_id)
                paypal.refund_latest_subscription_payment(
                    subscription_id=profile.paypal_subscription_id, start_time=start_time, end_time=end_time
                )
                refunded = True
                profile.is_pro = False
                profile.paypal_subscription_id = None
                profile.pro_cancel_at_period_end = False
            else:
                paypal.cancel_subscription(subscription_id=profile.paypal_subscription_id)
                profile.pro_cancel_at_period_end = True
        except paypal.PayPalError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        profile.save(update_fields=["is_pro", "paypal_subscription_id", "pro_cancel_at_period_end"])
        data = MeSerializer(request.user, context={"request": request}).data
        data["refunded"] = refunded
        return Response(data)


class StripeCreateCheckoutSessionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not SystemPaymentSetting.get_solo().enabled:
            return Response({"detail": "El sistema de planes no está disponible en este momento."}, status=status.HTTP_403_FORBIDDEN)
        success_url = request.data.get("success_url")
        cancel_url = request.data.get("cancel_url")
        if not success_url or not cancel_url:
            return Response({"detail": "Falta success_url o cancel_url."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            session = stripe_client.create_subscription_checkout_session(
                user_id=request.user.id, success_url=success_url, cancel_url=cancel_url
            )
        except stripe_client.StripeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"id": session["id"], "url": session.get("url")})


class StripeConfirmSessionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session_id = request.data.get("session_id")
        if not session_id:
            return Response({"detail": "Falta session_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = stripe_client.retrieve_checkout_session(session_id=session_id)
        except stripe_client.StripeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        if session.get("payment_status") != "paid":
            return Response({"detail": "El pago no se completó."}, status=status.HTTP_400_BAD_REQUEST)

        if session.get("client_reference_id") != str(request.user.id):
            logger.warning("Stripe session user mismatch: session=%s user=%s", session_id, request.user.id)
            return Response({"detail": "La sesión no corresponde a este usuario."}, status=status.HTTP_400_BAD_REQUEST)

        expected_cents = int(round(float(settings.PAYPAL_PRO_PRICE) * 100))
        if (
            session.get("amount_total") != expected_cents
            or str(session.get("currency", "")).upper() != settings.PAYPAL_PRO_CURRENCY
        ):
            logger.warning("Stripe session amount mismatch: session=%s amount=%s", session_id, session.get("amount_total"))
            return Response({"detail": "El monto pagado no coincide con el del plan PRO."}, status=status.HTTP_400_BAD_REQUEST)

        subscription_id = session.get("subscription")
        try:
            subscription = stripe_client.retrieve_subscription(subscription_id=subscription_id)
            period_end = stripe_client.get_current_period_end(subscription)
        except stripe_client.StripeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        profile, _ = Profile.objects.get_or_create(user=request.user)
        profile.is_pro = True
        profile.stripe_customer_id = session.get("customer")
        profile.stripe_subscription_id = subscription_id
        profile.pro_activated_at = timezone.now()
        profile.pro_current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
        profile.pro_cancel_at_period_end = False
        profile.save(update_fields=[
            "is_pro", "stripe_customer_id", "stripe_subscription_id",
            "pro_activated_at", "pro_current_period_end", "pro_cancel_at_period_end",
        ])
        return Response(MeSerializer(request.user, context={"request": request}).data)


class StripeCancelSubscriptionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        if not profile.stripe_subscription_id:
            return Response({"detail": "No tienes una suscripción de Stripe activa."}, status=status.HTTP_400_BAD_REQUEST)

        refunded = False
        try:
            if profile.refund_eligible():
                stripe_client.cancel_immediately(subscription_id=profile.stripe_subscription_id)
                stripe_client.refund_latest_invoice(subscription_id=profile.stripe_subscription_id)
                refunded = True
                profile.is_pro = False
                profile.stripe_subscription_id = None
                profile.pro_cancel_at_period_end = False
            else:
                stripe_client.cancel_at_period_end(subscription_id=profile.stripe_subscription_id)
                profile.pro_cancel_at_period_end = True
        except stripe_client.StripeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        profile.save(update_fields=["is_pro", "stripe_subscription_id", "pro_cancel_at_period_end"])
        data = MeSerializer(request.user, context={"request": request}).data
        data["refunded"] = refunded
        return Response(data)


class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data["old_password"]):
                return Response({"old_password": ["Contraseña actual incorrecta."]}, status=status.HTTP_400_BAD_REQUEST)
            
            user.set_password(serializer.validated_data["new_password"])
            user.save()
            return Response({"detail": "Contraseña actualizada correctamente."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MeListingsAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ListingSummarySerializer

    def get_queryset(self):
        queryset = listing_queryset(include_inactive=True).filter(user=self.request.user)
        return annotate_favorite_flag(queryset, self.request.user)


class FavoriteListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ListingSummarySerializer

    def get_queryset(self):
        queryset = listing_queryset(include_inactive=False).filter(favorites=self.request.user)
        return annotate_favorite_flag(queryset, self.request.user)


class FavoriteToggleAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        listing = Listing.objects.filter(is_active=True).filter(pk=pk).first()
        if not listing:
            raise Http404
        listing.favorites.add(request.user)
        return Response({"is_favorite": True}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        listing = Listing.objects.filter(pk=pk).first()
        if not listing:
            raise Http404
        listing.favorites.remove(request.user)
        return Response({"is_favorite": False}, status=status.HTTP_200_OK)


class ListingOfferAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        listing = get_object_or_404(Listing, pk=pk, is_active=True)
        amount = request.data.get("amount")
        message_text = request.data.get("message", "")

        if not amount:
            return Response({"detail": "El monto de la oferta es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)

        # Formatear el mensaje igual que en la web
        full_message = f"📢 HE HECHO UNA OFERTA: C$ {amount}\n\nNota: {message_text}"

        # Obtener o crear conversación
        conversation = (
            Conversation.objects.filter(listing=listing, participants=request.user)
            .filter(participants=listing.user)
            .first()
        )
        if not conversation:
            conversation = Conversation.objects.create(listing=listing)
            conversation.participants.add(request.user, listing.user)

        # Crear el mensaje
        message = Message.objects.create(conversation=conversation, sender=request.user, text=full_message)
        conversation.save(update_fields=["updated_at"])

        return Response(
            {
                "status": "success",
                "conversation_id": conversation.id,
                "message": MessageSerializer(message, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ProfileDetailAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, username):
        profile_user = User.objects.select_related("profile").filter(username=username).first()
        if not profile_user:
            raise Http404

        profile, _ = Profile.objects.get_or_create(user=profile_user)
        reviews = ProfileReview.objects.select_related("reviewer").filter(profile_user=profile_user).order_by("-created_at")
        average_rating = reviews.aggregate(avg=Avg("rating"))["avg"] or 5.0
        listings = annotate_favorite_flag(
            listing_queryset(include_inactive=False).filter(user=profile_user),
            request.user,
        )[:12]
        user_review = None
        if request.user.is_authenticated:
            user_review = reviews.filter(reviewer=request.user).first()

        return Response(
            {
                "id": profile_user.id,
                "username": profile_user.username,
                "display_name": profile_user.get_full_name().strip() or profile_user.username,
                "date_joined": profile_user.date_joined,
                "profile": {
                    "avatar": absolute_media_url(request, profile.avatar) if profile.avatar else None,
                    "cover_image": absolute_media_url(request, profile.cover_image) if profile.cover_image else None,
                    "location": profile.location,
                    "bio": profile.bio,
                    "is_verified": profile.is_verified,
                    "is_pro": profile.is_pro,
                },
                "stats": {
                    "followers_count": profile.followers.count(),
                    "listings_count": Listing.objects.filter(user=profile_user, is_active=True).count(),
                    "average_rating": round(average_rating, 1),
                    "reviews_count": reviews.count(),
                    "user_rating": user_review.rating if user_review else 0,
                    "user_comment": user_review.comment if user_review else "",
                    "can_review": bool(request.user.is_authenticated and request.user != profile_user),
                },
                "reviews": ProfileReviewSerializer(reviews[:20], many=True, context={"request": request}).data,
                "listings": ListingSummarySerializer(listings, many=True, context={"request": request}).data,
            }
        )


class ProfileReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        profile_user = User.objects.filter(username=username).first()
        if not profile_user:
            raise Http404
        if profile_user == request.user:
            return Response({"detail": "No puedes calificarte a ti mismo."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ProfileRatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review, _ = ProfileReview.objects.update_or_create(
            profile_user=profile_user,
            reviewer=request.user,
            defaults={
                "rating": serializer.validated_data["rating"],
                "comment": serializer.validated_data.get("comment", ""),
            },
        )


class ConversationListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = (
            Conversation.objects.filter(participants=request.user, messages__isnull=False)
            .select_related("listing", "listing__category", "listing__user", "listing__user__profile")
            .prefetch_related("participants", "participants__profile", "messages", "messages__sender", "messages__sender__profile")
            .distinct()
            .order_by("-updated_at")
        )
        serializer = ConversationSerializer(conversations, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        listing_id = request.data.get("listing") or request.data.get("listing_id")
        if not listing_id:
            return Response({"listing": "El anuncio es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)

        listing = Listing.objects.select_related("user").filter(pk=listing_id, is_active=True).first()
        if not listing:
            raise Http404
        if listing.user_id == request.user.id:
            return Response({"detail": "No puedes iniciar un chat contigo mismo."}, status=status.HTTP_400_BAD_REQUEST)

        conversation = (
            Conversation.objects.filter(listing=listing, participants=request.user)
            .filter(participants=listing.user)
            .first()
        )
        if not conversation:
            conversation = Conversation.objects.create(listing=listing)
            conversation.participants.add(request.user, listing.user)

        text = (request.data.get("text") or "").strip()
        if text:
            Message.objects.create(conversation=conversation, sender=request.user, text=text)
            conversation.save(update_fields=["updated_at"])

        serializer = ConversationSerializer(conversation, context={"request": request, "include_messages": True})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        conversation = (
            Conversation.objects.filter(pk=pk, participants=request.user)
            .select_related("listing", "listing__category", "listing__user", "listing__user__profile")
            .prefetch_related("participants", "participants__profile", "messages", "messages__sender", "messages__sender__profile")
            .first()
        )
        if not conversation:
            raise Http404
        return conversation

    def get(self, request, pk):
        conversation = self.get_object(request, pk)
        conversation.messages.exclude(sender=request.user).filter(is_read=False).update(is_read=True)
        serializer = ConversationSerializer(conversation, context={"request": request, "include_messages": True})
        return Response(serializer.data)

    def delete(self, request, pk):
        conversation = self.get_object(request, pk)
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MessageCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        serializer = MessageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        message.conversation.save(update_fields=["updated_at"])
        return Response(MessageSerializer(message, context={"request": request}).data, status=status.HTTP_201_CREATED)


class MessageReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        message = Message.objects.filter(pk=pk, conversation__participants=request.user).first()
        if not message:
            raise Http404
        if message.sender_id != request.user.id:
            message.is_read = True
            message.save(update_fields=["is_read"])
        return Response(MessageSerializer(message, context={"request": request}).data)


class MessageViewOnceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        message = (
            Message.objects.filter(pk=pk, conversation__participants=request.user, is_view_once=True)
            .exclude(sender=request.user)
            .first()
        )
        if not message:
            raise Http404
        if message.image:
            message.image.delete(save=False)
        if message.audio:
            message.audio.delete(save=False)
        if message.file:
            message.file.delete(save=False)
        message.delete()
        return Response({"status": "deleted"})


class StoryListCreateAPIView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_queryset(self):
        time_threshold = timezone.now() - timezone.timedelta(hours=24)
        return Story.objects.select_related("user", "user__profile").filter(
            is_active=True,
        ).filter(
            Q(expires_at__gt=timezone.now()) | Q(expires_at__isnull=True, created_at__gte=time_threshold),
        ).order_by("-created_at")

    def get(self, request):
        return Response(StorySerializer(self.get_queryset(), many=True, context={"request": request}).data)

    def post(self, request):
        image = request.FILES.get("image")
        if not image:
            return Response({"image": "La imagen es obligatoria."}, status=status.HTTP_400_BAD_REQUEST)
        story = Story.objects.create(
            user=request.user,
            image=image,
            text=request.data.get("text", ""),
            audio_url=request.data.get("audio_url", ""),
            audio_start=request.data.get("audio_start") or 0,
            audio_name=request.data.get("audio_name", ""),
            metadata=request.data.get("metadata", ""),
        )
        return Response(StorySerializer(story, context={"request": request}).data, status=status.HTTP_201_CREATED)


class StoryDetailAPIView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_object(self, pk):
        story = Story.objects.select_related("user", "user__profile").filter(
            pk=pk,
            is_active=True,
            expires_at__gt=timezone.now(),
        ).first()
        if not story:
            raise Http404
        return story

    def get(self, request, pk):
        return Response(StorySerializer(self.get_object(pk), context={"request": request}).data)

    def delete(self, request, pk):
        story = Story.objects.filter(pk=pk).first()
        if not story:
            raise Http404
        if story.user_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)
        story.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": MeSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginAPIView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = MobileTokenObtainPairSerializer


class GoogleLoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        id_token = request.data.get("id_token")
        if not id_token:
            return Response({"error": "id_token is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate the token with Google
        response = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
        if response.status_code != 200:
            return Response({"error": "Invalid Google token"}, status=status.HTTP_400_BAD_REQUEST)

        user_info = response.json()
        email = user_info.get("email")
        if not email:
            return Response({"error": "Email not provided by Google"}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create the user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            username = email.split('@')[0]
            # Ensure unique username
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
            
            user = User.objects.create(
                username=username,
                email=email,
                first_name=user_info.get("given_name", ""),
                last_name=user_info.get("family_name", "")
            )
            # Create a profile with the Google picture
            profile, _ = Profile.objects.get_or_create(user=user)
            picture = user_info.get("picture")
            if picture and not profile.avatar:
                # We could download and save the picture, but for now we'll just let them upload one later
                # Or if you have a field for avatar URL, set it here.
                pass

        # Generate tokens
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": MeSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class RefreshAPIView(TokenRefreshView):
    permission_classes = [AllowAny]


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            raise ValidationError({"refresh": "El token refresh es obligatorio."})

        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except TokenError:
            raise ValidationError({"refresh": "Token refresh inválido."})

        return Response({"detail": "Sesión cerrada."}, status=status.HTTP_200_OK)
class NotificationListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")


class NotificationUnreadCountAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})


class NotificationMarkReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, user=request.user)
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification, context={"request": request}).data)


class NotificationReadAllAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"status": "success"})


class ListingReportAPIView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = ListingReportSerializer

    def perform_create(self, serializer):
        serializer.save()

class BugReportCreateAPIView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = BugReportSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save()
