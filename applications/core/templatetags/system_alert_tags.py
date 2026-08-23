from django import template

register = template.Library()


@register.simple_tag
def get_system_alert():
    """Devuelve la alerta activa del sistema o None si está apagada."""
    from applications.core.models import SystemAlert

    try:
        alert = SystemAlert.get_solo()
    except Exception:
        return None
    return alert if alert.active else None
