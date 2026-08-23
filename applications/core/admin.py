from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import (
    Category, Subcategory, Listing, Profile, ProfileReview, BugReport,
    SearchHistory, SystemPaymentSetting, ListingReport,
    Department, City, Brand, Model, Conversation, Message,
)
from django.utils.safestring import mark_safe

admin.site.site_header = "Administración de IGUALO"
admin.site.site_title = "IGUALO Admin"
admin.site.index_title = "Panel de administración"

User = get_user_model()
admin.site.unregister(User)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = DjangoUserAdmin.list_display + ("date_joined",)
    list_filter = DjangoUserAdmin.list_filter + ("date_joined",)


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


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "order")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "slug")
    ordering = ("order",)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "department", "is_active")
    list_filter = ("department", "is_active")
    search_fields = ("name", "slug", "department__name")
    autocomplete_fields = ("department",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "order", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Model)
class ModelAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "category", "slug", "is_active")
    list_filter = ("brand", "category", "is_active")
    search_fields = ("name", "brand__name")
    autocomplete_fields = ("brand", "category")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "price", "category", "subcategory", "status", "condition", "brand", "model", "year", "city", "is_active", "user", "created_at")
    list_editable = ("status",)
    list_filter = ("status", "condition", "is_featured_paid", "category", "subcategory", "brand", "model", "year", "department", "city", "created_at")
    search_fields = ("title", "description", "address_text")
    autocomplete_fields = ("category", "subcategory", "brand", "model", "department", "city", "user")
    readonly_fields = ("is_active", "location")
    date_hierarchy = "created_at"
    actions = ("mark_active", "mark_paused", "mark_sold")

    @admin.action(description="Marcar como activo")
    def mark_active(self, request, queryset):
        queryset.update(status="active")

    @admin.action(description="Marcar como pausado")
    def mark_paused(self, request, queryset):
        queryset.update(status="paused")

    @admin.action(description="Marcar como vendido")
    def mark_sold(self, request, queryset):
        queryset.update(status="sold")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "show_verification_photo", "is_verified", "es_pro", "phone", "location", "fecha_registro")
    list_filter = ("is_verified", "is_pro", "location")
    list_editable = ("is_verified",)
    search_fields = ("user__username", "phone", "location")
    readonly_fields = ("show_details_verification_photo",)
    list_select_related = ("user",)

    @admin.display(boolean=True, description="Usuario Pro")
    def es_pro(self, obj):
        return obj.is_pro

    @admin.display(description="Fecha de registro", ordering="user__date_joined")
    def fecha_registro(self, obj):
        return obj.user.date_joined

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


@admin.register(SystemPaymentSetting)
class SystemPaymentSettingAdmin(admin.ModelAdmin):
    list_display = ("display_enabled", "display_status", "updated_at")
    readonly_fields = ("updated_at",)
    list_display_links = ("display_enabled",)

    @admin.display(description="Sistema de pagos activo")
    def display_enabled(self, obj):
        if obj.enabled:
            return "✓ Sí, ACTIVO"
        return "✗ No, INACTIVO"

    @admin.display(description="Estado")
    def display_status(self, obj):
        from django.utils.safestring import mark_safe
        if obj.enabled:
            return mark_safe(
                '<span style="background:#22c55e;color:#000;padding:4px 12px;border-radius:20px;font-weight:700;">🟢 Pro y promociones ENCENDIDOS</span>'
            )
        return mark_safe(
            '<span style="background:#6b7280;color:#fff;padding:4px 12px;border-radius:20px;font-weight:700;">⚪ Sistema apagado</span>'
        )

    def has_add_permission(self, request):
        return not SystemPaymentSetting.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(SearchHistory)
class SearchHistoryAdmin(admin.ModelAdmin):
    list_display = ('query', 'user', 'category', 'results_count', 'updated_at')
    list_filter = ('category', 'created_at', 'updated_at')
    search_fields = ('query', 'normalized_query', 'user__username')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'updated_at'
@admin.register(ListingReport)
class ListingReportAdmin(admin.ModelAdmin):
    list_display = ("listing", "user", "reason", "created_at")
    list_filter = ("reason", "created_at")
    search_fields = ("listing__title", "user__username", "description")
    readonly_fields = ("listing", "user", "reason", "description", "created_at")


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ('sender', 'short_text', 'is_read', 'created_at')
    readonly_fields = ('sender', 'short_text', 'is_read', 'created_at')
    can_delete = False
    max_num = 0

    @admin.display(description="Mensaje")
    def short_text(self, obj):
        if obj.is_deleted:
            return "(eliminado)"
        if obj.text:
            return obj.text[:80]
        if obj.image:
            return "🖼️ imagen"
        if obj.audio:
            return "🎤 audio"
        if obj.file:
            return "📎 archivo"
        return "-"


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'listing_link', 'participants_display', 'message_count', 'last_message_at', 'updated_at')
    search_fields = ('listing__title', 'participants__username', 'participants__email', 'messages__text')
    list_filter = ('created_at', 'updated_at')
    date_hierarchy = 'updated_at'
    inlines = [MessageInline]

    @admin.display(description="Anuncio")
    def listing_link(self, obj):
        return obj.listing.title if obj.listing else "(consulta directa)"

    @admin.display(description="Participantes")
    def participants_display(self, obj):
        return ", ".join(u.username for u in obj.participants.all()[:4])

    @admin.display(description="Mensajes")
    def message_count(self, obj):
        return obj.messages.count()

    @admin.display(description="Último mensaje", ordering='updated_at')
    def last_message_at(self, obj):
        last = obj.messages.order_by('-created_at').first()
        return last.created_at if last else None


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'id', 'conversation_info', 'short_text', 'is_read', 'created_at')
    list_filter = ('is_read', 'is_deleted', 'created_at')
    search_fields = ('text', 'sender__username', 'conversation__participants__username')
    date_hierarchy = 'created_at'

    @admin.display(description="Mensaje")
    def short_text(self, obj):
        if obj.text:
            return obj.text[:80]
        if obj.image:
            return "🖼️ imagen"
        if obj.audio:
            return "🎤 audio"
        if obj.file:
            return "📎 archivo"
        return "-"

    @admin.display(description="Conversación")
    def conversation_info(self, obj):
        others = obj.conversation.participants.exclude(id=obj.sender.id)
        other = others.first()
        listing = obj.conversation.listing.title if obj.conversation.listing else "consulta"
        return f"con {other.username if other else '?'} · {listing}"
