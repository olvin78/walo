from __future__ import annotations

from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.http import Http404
from django.conf import settings
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from applications.api.filters import apply_listing_search, normalize_listing_ordering
from applications.api.permissions import IsOwnerOrAdminOrReadOnly
from applications.api.serializers import (
    CategorySerializer,
    ListingDetailSerializer,
    ListingSummarySerializer,
    ListingWriteSerializer,
    MeSerializer,
    MobileTokenObtainPairSerializer,
    RegisterSerializer,
)
from applications.core.models import Category, Listing, ListingImage, SearchHistory


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
    query = params.get("q") or params.get("search")
    category_value = params.get("category")
    location = params.get("location")
    ordering = normalize_listing_ordering(params.get("ordering") or params.get("sort"))

    queryset = apply_listing_search(queryset, query)

    if category_value:
        if str(category_value).isdigit():
            queryset = queryset.filter(category_id=category_value)
        else:
            queryset = queryset.filter(Q(category__slug=category_value) | Q(category__name__iexact=category_value))

    if location:
        queryset = queryset.filter(location__icontains=location)

    return queryset.order_by(ordering)


class CategoryListAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer

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

    def perform_create(self, serializer):
        serializer.save()


class ListingSearchAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ListingSummarySerializer

    def get_queryset(self):
        queryset = listing_queryset(include_inactive=False)
        queryset = annotate_favorite_flag(queryset, self.request.user)
        return filter_listing_queryset(queryset, self.request.query_params)


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

    def get(self, request):
        return Response(MeSerializer(request.user, context={"request": request}).data)


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
