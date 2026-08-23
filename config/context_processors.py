from django.conf import settings
from applications.core.models import SystemPaymentSetting, Message, SystemAlert


def system_alert(request):
    """Expose the admin-configurable system alert to templates."""
    alert = SystemAlert.get_solo()
    return {
        "system_alert": alert if alert.active else None,
        "system_alert_active": alert.active,
    }


def tracking(request):
    """Expose global feature flags and site metadata to templates."""
    system_payments_enabled = SystemPaymentSetting.get_solo().enabled
    container_id = getattr(settings, "GOOGLE_TAG_MANAGER_ID", "")

    if settings.DEBUG or not container_id:
        container_id = ""

    unread_messages = 0
    is_pro = False
    if request.user.is_authenticated:
        conversation_ids = request.user.conversations.values_list("id", flat=True)
        unread_messages = Message.objects.filter(
            conversation_id__in=conversation_ids,
        ).exclude(sender=request.user).filter(is_read=False).count()
        is_pro = bool(getattr(getattr(request.user, "profile", None), "is_pro", False))

    return {
        "google_tag_manager_id": container_id,
        "system_payments_enabled": system_payments_enabled,
        "unread_messages": unread_messages,
        "nav_is_pro": is_pro,
        "site_url": getattr(settings, "PUBLIC_BASE_URL", "https://igualo.com").rstrip("/"),
        "site_name": "IGUALO",
    }
