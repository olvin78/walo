from django.contrib import admin
from .models import Category, Subcategory, Listing, Profile, ProfileReview, BugReport
from django.utils.safestring import mark_safe


@admin.register(BugReport)
class BugReportAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "description_short")
    list_filter = ("created_at", "user")
    readonly_fields = ("created_at", "user", "description", "screenshot_preview")
    
    def description_short(self, obj):
        return obj.description[:80] + "..." if len(obj.description) > 80 else obj.description
    
    def screenshot_preview(self, obj):
        if obj.screenshot:
            return mark_safe(f'<img src="{obj.screenshot.url}" width="300" />')
        return "No hay captura"


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "order", "slug")
    list_editable = ("order",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Subcategory)
class SubcategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "order", "slug")
    list_editable = ("order",)
    list_filter = ("category",)
    search_fields = ("name", "slug", "category__name")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "price", "category", "subcategory", "is_active", "location", "user", "created_at")
    list_editable = ("is_active",)
    list_filter = ("is_active", "category", "subcategory", "location", "created_at")
    search_fields = ("title", "description", "location")
    autocomplete_fields = ("category", "subcategory", "user")
    date_hierarchy = "created_at"


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "show_verification_photo", "is_verified", "phone", "location")
    list_filter = ("is_verified", "location")
    list_editable = ("is_verified",)
    search_fields = ("user__username", "phone", "location")
    readonly_fields = ("show_details_verification_photo",)

    def show_verification_photo(self, obj):
        if obj.verification_photo:
            return mark_safe(f'<img src="{obj.verification_photo.url}" width="50" height="50" style="border-radius: 5px; object-fit: cover; border: 2px solid #22c55e;" />')
        return "No escaneada"
    show_verification_photo.short_description = "Escaneo"

    def show_details_verification_photo(self, obj):
        if obj.verification_photo:
            return mark_safe(f'<img src="{obj.verification_photo.url}" width="300" style="border-radius: 10px; border: 3px solid #22c55e;" />')
        return "Sin foto de verificación"
    show_details_verification_photo.short_description = "Detalle del Escaneo"

@admin.register(ProfileReview)
class ProfileReviewAdmin(admin.ModelAdmin):
    list_display = ("profile_user", "reviewer", "rating", "created_at")
    list_filter = ("rating", "created_at")

from .models import MarketingConsent

@admin.register(MarketingConsent)
class MarketingConsentAdmin(admin.ModelAdmin):
    list_display = ("email", "user", "allows_notifications", "allows_marketing", "created_at")
    list_filter = ("allows_notifications", "allows_marketing", "created_at")
    search_fields = ("email", "user__username", "user__email")
    readonly_fields = ("created_at",)
