from django.conf import settings
from applications.core.models import SystemPaymentSetting, Message


def tracking(request):
    """Expose global feature flags to templates."""
    system_payments_enabled = SystemPaymentSetting.get_solo().enabled
    container_id = getattr(settings, "GOOGLE_TAG_MANAGER_ID", "")

    if settings.DEBUG or not container_id:
        container_id = ""

    unread_messages = 0
    if request.user.is_authenticated:
        conversation_ids = request.user.conversations.values_list("id", flat=True)
        unread_messages = Message.objects.filter(
            conversation_id__in=conversation_ids,
        ).exclude(sender=request.user).filter(is_read=False).count()

    return {
        "google_tag_manager_id": container_id,
        "system_payments_enabled": system_payments_enabled,
        "unread_messages": unread_messages,
    }
