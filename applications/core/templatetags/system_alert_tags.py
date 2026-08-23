from django import template

register = template.Library()


@register.simple_tag
def get_system_alerts():
    """Devuelve las alertas activas del sistema ordenadas."""
    from applications.core.models import SystemAlert

    try:
        return list(SystemAlert.objects.filter(active=True))
    except Exception:
        return []

