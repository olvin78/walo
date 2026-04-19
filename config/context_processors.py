from django.conf import settings
from applications.core.models import SystemPaymentSetting


def tracking(request):
    """Expose global feature flags to templates."""
    system_payments_enabled = SystemPaymentSetting.get_solo().enabled
    container_id = getattr(settings, "GOOGLE_TAG_MANAGER_ID", "")

    if settings.DEBUG or not container_id:
        container_id = ""

    return {
        "google_tag_manager_id": container_id,
        "system_payments_enabled": system_payments_enabled,
    }
