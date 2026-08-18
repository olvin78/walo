from __future__ import annotations

from pathlib import Path

from django.contrib.auth import authenticate, get_user_model
from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from applications.core.models import BugReport, Category, Conversation, Listing, ListingImage, ListingReport, MarketingConsent, Message, Notification, Profile, ProfileReview, Story, Subcategory, SystemPaymentSetting


User = get_user_model()
MAX_LISTING_IMAGES = 10
MAX_IMAGE_SIZE_MB = 10
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def absolute_media_url(request, file_field):
    if not file_field:
        return None
    url = file_field.url if hasattr(file_field, "url") else str(file_field)
    if request:
        return request.build_absolute_uri(url)
    return url


class UploadUrlField(serializers.FileField):
    def to_representation(self, value):
        return absolute_media_url(self.context.get("request"), value)


def split_location(location: str | None):
    value = (location or "").strip()
    if not value:
        return None, None
    if "," in value:
        city, department = [part.strip() for part in value.split(",", 1)]
        return city or None, department or None
    return value, None


class CategoryNestedSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "slug", "icon", "image")

    def get_image(self, obj):
        return absolute_media_url(self.context.get("request"), obj.image)


class SubcategorySerializer(serializers.ModelSerializer):
    icon = serializers.CharField(read_only=True)
    total_active_listings = serializers.IntegerField(read_only=True)

    class Meta:
        model = Subcategory
        fields = (
            "id",
            "name",
            "slug",
            "icon",
            "description",
            "total_active_listings",
        )


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    parent = serializers.SerializerMethodField()
    total_active_listings = serializers.IntegerField(read_only=True)
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "slug",
            "icon",
            "image",
            "parent",
            "total_active_listings",
            "subcategories",
        )

    def get_image(self, obj):
        return absolute_media_url(self.context.get("request"), obj.image)

    def get_parent(self, obj):
        return None

    def get_subcategories(self, obj):
        subcategories = obj.subcategories.annotate(
            total_active_listings=Count("listings", filter=Q(listings__is_active=True), distinct=True)
        ).order_by("order", "name")
        return SubcategorySerializer(subcategories, many=True, context=self.context).data


class PublicSellerSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    is_verified = serializers.SerializerMethodField()
    is_pro = serializers.SerializerMethodField()
    whatsapp = serializers.SerializerMethodField()
    registered_at = serializers.DateTimeField(source="date_joined", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "display_name",
            "avatar",
            "registered_at",
            "is_verified",
            "is_pro",
            "whatsapp",
        )

    def get_display_name(self, obj):
        name = obj.get_full_name().strip()
        return name or obj.username

    def get_avatar(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile or not profile.avatar:
            return None
        return absolute_media_url(self.context.get("request"), profile.avatar)

    def get_is_verified(self, obj):
        profile = getattr(obj, "profile", None)
        return bool(profile and profile.is_verified)

    def get_is_pro(self, obj):
        profile = getattr(obj, "profile", None)
        return bool(profile and profile.is_pro)

    def get_whatsapp(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile or not profile.phone:
            return None
        return profile.phone


class ListingImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    medium = serializers.SerializerMethodField()
    order = serializers.SerializerMethodField()

    class Meta:
        model = ListingImage
        fields = ("id", "url", "thumbnail", "medium", "order")

    def get_url(self, obj):
        return absolute_media_url(self.context.get("request"), obj.image)

    def get_thumbnail(self, obj):
        return absolute_media_url(self.context.get("request"), obj.get_thumb)

    def get_medium(self, obj):
        return absolute_media_url(self.context.get("request"), obj.get_medium)

    def get_order(self, obj):
        return self.context.get("image_order_map", {}).get(obj.id)


class SubcategoryNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subcategory
        fields = ("id", "name", "slug", "icon")


class ListingSummarySerializer(serializers.ModelSerializer):
    category = CategoryNestedSerializer(read_only=True)
    subcategory = SubcategoryNestedSerializer(read_only=True)
    seller = PublicSellerSerializer(source="user", read_only=True)
    main_image = serializers.SerializerMethodField()
    is_promoted = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()
    whatsapp = serializers.SerializerMethodField()
    contact_available = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = (
            "id",
            "title",
            "slug",
            "price",
            "currency",
            "category",
            "subcategory",
            "location",
            "is_promoted",
            "is_negotiable",
            "city",
            "department",
            "main_image",
            "created_at",
            "is_favorite",
            "is_active",
            "seller",
            "whatsapp",
            "contact_available",
        )

    def get_main_image(self, obj):
        request = self.context.get("request")
        image = obj.image
        if not image:
            first_extra = next(iter(obj.images.all()), None)
            image = first_extra.image if first_extra else None
        return absolute_media_url(request, image)

    def get_city(self, obj):
        if obj.city_id:
            return obj.city.name
        city, _ = split_location(obj.location)
        return city

    def get_department(self, obj):
        if obj.department_id:
            return obj.department.name
        _, department = split_location(obj.location)
        return department

    def get_location(self, obj):
        return obj.location

    def get_currency(self, obj):
        return "NIO"

    def get_is_promoted(self, obj):
        return bool(getattr(obj, "is_promoted", False))

    def get_is_favorite(self, obj):
        value = getattr(obj, "is_favorite", None)
        if value is not None:
            return bool(value)

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return obj.favorites.filter(id=user.id).exists()

    def get_whatsapp(self, obj):
        profile = getattr(obj.user, "profile", None)
        if not profile or not profile.phone:
            return None
        return profile.phone

    def get_contact_available(self, obj):
        return bool(self.get_whatsapp(obj))


class ListingDetailSerializer(ListingSummarySerializer):
    images = serializers.SerializerMethodField()
    description = serializers.CharField()
    is_active = serializers.BooleanField(read_only=True)
    is_negotiable = serializers.BooleanField(read_only=True)
    payment_methods = serializers.CharField(read_only=True)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, read_only=True, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, read_only=True, allow_null=True)

    class Meta(ListingSummarySerializer.Meta):
        fields = ListingSummarySerializer.Meta.fields + (
            "description",
            "images",
            "is_active",
            "is_negotiable",
            "payment_methods",
            "latitude",
            "longitude",
        )

    def get_images(self, obj):
        images = list(obj.images.all())
        order_map = {image.id: index + 1 for index, image in enumerate(images)}
        serializer = ListingImageSerializer(
            images,
            many=True,
            context={**self.context, "image_order_map": order_map},
        )
        return serializer.data


class ListingWriteSerializer(serializers.ModelSerializer):
    main_image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    images = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        write_only=True,
    )
    deleted_images = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )
    is_active = serializers.BooleanField(required=False, default=None, allow_null=True)
    location = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Listing
        fields = (
            "id",
            "title",
            "description",
            "price",
            "category",
            "subcategory",
            "location",
            "is_active",
            "status",
            "is_negotiable",
            "payment_methods",
            "latitude",
            "longitude",
            "latitude",
            "longitude",
            "main_image",
            "images",
            "deleted_images",
        )
        read_only_fields = ("id",)

    def validate_price(self, value):
        if value < 0:
            raise ValidationError("El precio no puede ser negativo.")
        return value

    def validate_images(self, value):
        if len(value) > MAX_LISTING_IMAGES:
            raise ValidationError(f"Solo se permiten {MAX_LISTING_IMAGES} imágenes por anuncio.")

        for image in value:
            extension = Path(image.name).suffix.lower()
            if extension not in ALLOWED_IMAGE_EXTENSIONS:
                raise ValidationError("Formato de imagen no permitido.")
            if image.size > MAX_IMAGE_SIZE_MB * 1024 * 1024:
                raise ValidationError("Cada imagen debe pesar menos de 10 MB.")

        return value

    def validate(self, attrs):
        category = attrs.get("category") or getattr(self.instance, "category", None)
        subcategory = attrs.get("subcategory", getattr(self.instance, "subcategory", None))

        if subcategory and category and subcategory.category_id != category.id:
            raise ValidationError({"subcategory": "La subcategoría no pertenece a la categoría seleccionada."})

        is_negotiable = attrs.get("is_negotiable", getattr(self.instance, "is_negotiable", False))
        price = attrs.get("price", getattr(self.instance, "price", 0))
        if not is_negotiable and price <= 0:
            raise ValidationError({"price": "El precio debe ser mayor que cero si no es negociable."})

        main_image = attrs.get("main_image")
        images = attrs.get("images", [])
        total_images = len(images) + (1 if main_image else 0)
        if total_images > MAX_LISTING_IMAGES:
            raise ValidationError({"images": f"Solo se permiten {MAX_LISTING_IMAGES} imágenes por anuncio."})

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        images = validated_data.pop("images", [])
        main_image = validated_data.pop("main_image", None)

        is_active = validated_data.pop("is_active", None)
        if "status" not in validated_data and is_active is not None:
            validated_data["status"] = Listing.STATUS_ACTIVE if is_active else Listing.STATUS_PAUSED

        if not main_image and images:
            main_image = images[0]
            images = images[1:]

        listing = Listing.objects.create(user=request.user, image=main_image, **validated_data)

        for image in images:
            ListingImage.objects.create(listing=listing, image=image)

        return listing

    def update(self, instance, validated_data):
        images = validated_data.pop("images", [])
        main_image = validated_data.pop("main_image", None)
        deleted_images = validated_data.pop("deleted_images", [])
        is_active = validated_data.pop("is_active", None)
        if is_active is not None and "status" not in validated_data:
            validated_data["status"] = Listing.STATUS_ACTIVE if is_active else Listing.STATUS_PAUSED

        # 1. Handle Deletions
        if deleted_images:
            # Delete extra images
            instance.images.filter(id__in=deleted_images).delete()
            
            # If main image was "deleted" (we represent main image deletion by sending its ID if it was in ListingImage OR a special flag)
            # In our current schema, 'instance.image' is the main one.
            # If the user wants to remove the main one, they should send 'main_image' as Null or a new one.
        
        # 2. Update normal fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 3. Handle Main Image
        if main_image:
            instance.image = main_image
        elif instance.image is None and (instance.images.exists() or images):
             # If we have no main image but we have extras, pick the first one
             if images:
                 instance.image = images[0]
                 images = images[1:]
             else:
                 first_extra = instance.images.first()
                 if first_extra:
                     instance.image = first_extra.image
                     first_extra.delete()

        instance.save()

        # 4. Add new images
        for image in images:
            ListingImage.objects.create(listing=instance, image=image)

        return instance


class MeSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()
    system_payments_enabled = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "date_joined", "profile", "system_payments_enabled")

    def get_system_payments_enabled(self, obj):
        return SystemPaymentSetting.get_solo().enabled

    def get_profile(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        consent = MarketingConsent.objects.filter(user=obj).order_by("-created_at").first()
        return {
            "id": profile.id,
            "avatar": absolute_media_url(self.context.get("request"), profile.avatar) if profile.avatar else None,
            "cover_image": absolute_media_url(self.context.get("request"), profile.cover_image) if profile.cover_image else None,
            "location": profile.location,
            "phone": profile.phone,
            "bio": profile.bio,
            "latitude": profile.latitude,
            "longitude": profile.longitude,
            "rating": profile.rating,
            "reviews_count": profile.reviews_count,
            "is_verified": profile.is_verified,
            "is_pro": profile.is_pro,
            "has_stripe_subscription": bool(profile.stripe_subscription_id),
            "has_paypal_subscription": bool(profile.paypal_subscription_id),
            "pro_cancel_at_period_end": profile.pro_cancel_at_period_end,
            "pro_current_period_end": profile.pro_current_period_end,
            "has_verification_photo": bool(profile.verification_photo),
            "followers_count": profile.followers.count(),
            "listings_count": obj.listing_set.filter(is_active=True).count(),
            "allows_notifications": consent.allows_notifications if consent else True,
        }


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ("avatar", "cover_image", "bio", "phone", "location", "latitude", "longitude", "expo_push_token", "verification_photo")


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True)

    def validate(self, data):
        if data["new_password"] != data["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Las contraseñas no coinciden."})
        return data


class ProfileReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.SerializerMethodField()

    class Meta:
        model = ProfileReview
        fields = ("id", "reviewer", "rating", "comment", "created_at")

    def get_reviewer(self, obj):
        return obj.reviewer.get_full_name().strip() or obj.reviewer.username


class ProfileRatingSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class ChatUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    is_verified = serializers.SerializerMethodField()
    is_pro = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "display_name", "avatar", "is_verified", "is_pro")

    def get_display_name(self, obj):
        return obj.get_full_name().strip() or obj.username

    def get_avatar(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile or not profile.avatar:
            return None
        return absolute_media_url(self.context.get("request"), profile.avatar)

    def get_is_verified(self, obj):
        profile = getattr(obj, "profile", None)
        return bool(profile and profile.is_verified)

    def get_is_pro(self, obj):
        profile = getattr(obj, "profile", None)
        return bool(profile and profile.is_pro)


class MessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()
    image = UploadUrlField(required=False, allow_null=True)
    audio = UploadUrlField(required=False, allow_null=True)
    file = UploadUrlField(required=False, allow_null=True)

    class Meta:
        model = Message
        fields = ("id", "conversation", "sender", "text", "image", "audio", "file", "is_view_once", "viewed_by_sender", "viewed_by_receiver", "created_at", "is_read", "is_mine")
        read_only_fields = ("id", "sender", "created_at", "is_read", "is_mine", "viewed_by_sender", "viewed_by_receiver")

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.sender_id == request.user.id)

    def validate_conversation(self, value):
        request = self.context.get("request")
        if not request or not value.participants.filter(id=request.user.id).exists():
            raise ValidationError("No puedes enviar mensajes en esta conversación.")
        return value

    def validate_text(self, value):
        value = (value or "").strip()
        has_attachment = any(self.initial_data.get(field) for field in ("image", "audio", "file"))
        if not value and not has_attachment:
            raise ValidationError("El mensaje no puede estar vacío.")
        return value

    def validate(self, attrs):
        if not any(attrs.get(field) for field in ("text", "image", "audio", "file")):
            raise ValidationError("El mensaje no puede estar vacío.")
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        return Message.objects.create(sender=request.user, **validated_data)


class ConversationSerializer(serializers.ModelSerializer):
    listing = ListingSummarySerializer(read_only=True)
    participants = ChatUserSerializer(many=True, read_only=True)
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    messages = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ("id", "listing", "participants", "other_user", "last_message", "messages", "created_at", "updated_at")

    def get_other_user(self, obj):
        request = self.context.get("request")
        user = obj.participants.exclude(id=getattr(request.user, "id", None)).first() if request else None
        return ChatUserSerializer(user, context=self.context).data if user else None

    def get_last_message(self, obj):
        message = obj.messages.order_by("-created_at").first()
        return MessageSerializer(message, context=self.context).data if message else None

    def get_messages(self, obj):
        if not self.context.get("include_messages"):
            return []
        return MessageSerializer(obj.messages.select_related("sender", "sender__profile"), many=True, context=self.context).data


class StorySerializer(serializers.ModelSerializer):
    user = serializers.IntegerField(source="user_id", read_only=True)
    user_display_name = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = (
            "id",
            "user",
            "user_display_name",
            "user_avatar",
            "image",
            "text",
            "audio_url",
            "audio_start",
            "audio_name",
            "metadata",
            "created_at",
            "expires_at",
            "is_own",
        )
        read_only_fields = ("id", "user", "user_display_name", "user_avatar", "created_at", "expires_at", "is_own")

    def get_user_display_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.username

    def get_user_avatar(self, obj):
        profile = getattr(obj.user, "profile", None)
        if not profile or not profile.avatar:
            return None
        return absolute_media_url(self.context.get("request"), profile.avatar)

    def get_image(self, obj):
        return absolute_media_url(self.context.get("request"), obj.image)

    def get_is_own(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.user_id == request.user.id)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password2", "first_name", "last_name")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise ValidationError("Ya existe una cuenta con ese email.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise ValidationError({"password2": "Las contraseñas no coinciden."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class MobileTokenObtainPairSerializer(serializers.Serializer):
    login = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        login = attrs.get("login") or attrs.get("username") or attrs.get("email")
        password = attrs.get("password")

        if not login or not password:
            raise ValidationError("Credenciales inválidas.")

        user = User.objects.filter(username__iexact=login).first() or User.objects.filter(email__iexact=login).first()
        if not user:
            raise ValidationError("Credenciales inválidas.")

        authenticated = authenticate(
            request=self.context.get("request"),
            username=user.username,
            password=password,
        )
        if not authenticated:
            raise ValidationError("Credenciales inválidas.")

        refresh = RefreshToken.for_user(authenticated)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": MeSerializer(authenticated, context=self.context).data,
        }
class NotificationSerializer(serializers.ModelSerializer):
    listing_title = serializers.ReadOnlyField(source="related_listing.title")

    class Meta:
        model = Notification
        fields = (
            "id",
            "notification_type",
            "title",
            "body",
            "related_listing",
            "listing_title",
            "related_conversation",
            "is_read",
            "created_at",
        )


class ListingReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingReport
        fields = ("id", "listing", "reason", "description", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        return ListingReport.objects.create(user=user, **validated_data)

class BugReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugReport
        fields = ("id", "description", "screenshot", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        return BugReport.objects.create(user=user, **validated_data)
