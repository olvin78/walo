from __future__ import annotations

from pathlib import Path

from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from applications.core.models import Category, Listing, ListingImage


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


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    parent = serializers.SerializerMethodField()
    total_active_listings = serializers.IntegerField(read_only=True)

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
        )

    def get_image(self, obj):
        return absolute_media_url(self.context.get("request"), obj.image)

    def get_parent(self, obj):
        return None


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


class ListingSummarySerializer(serializers.ModelSerializer):
    category = CategoryNestedSerializer(read_only=True)
    seller = PublicSellerSerializer(source="user", read_only=True)
    main_image = serializers.SerializerMethodField()
    is_promoted = serializers.SerializerMethodField()
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
            "location",
            "is_promoted",
            "city",
            "department",
            "main_image",
            "created_at",
            "is_favorite",
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
        city, _ = split_location(obj.location)
        return city

    def get_department(self, obj):
        _, department = split_location(obj.location)
        return department

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
    payment_methods = serializers.CharField(read_only=True)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, read_only=True, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, read_only=True, allow_null=True)

    class Meta(ListingSummarySerializer.Meta):
        fields = ListingSummarySerializer.Meta.fields + (
            "description",
            "images",
            "is_active",
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
            "payment_methods",
            "latitude",
            "longitude",
            "main_image",
            "images",
        )
        read_only_fields = ("id",)

    def validate_price(self, value):
        if value <= 0:
            raise ValidationError("El precio debe ser mayor que cero.")
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

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if main_image:
            instance.image = main_image
        elif not instance.image and images:
            instance.image = images[0]
            images = images[1:]

        instance.save()

        for image in images:
            ListingImage.objects.create(listing=instance, image=image)

        return instance


class MeSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "date_joined", "profile")

    def get_profile(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return {
            "avatar": absolute_media_url(self.context.get("request"), profile.avatar) if profile.avatar else None,
            "cover_image": absolute_media_url(self.context.get("request"), profile.cover_image) if profile.cover_image else None,
            "location": profile.location,
            "phone": profile.phone,
            "bio": profile.bio,
            "rating": profile.rating,
            "reviews_count": profile.reviews_count,
            "is_verified": profile.is_verified,
        }


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
