from django import template

register = template.Library()


def _visible(alerts):
    """Filtra por activa + rango de fechas (si tiene)."""
    return [a for a in alerts if a.visible_now]


@register.simple_tag
def get_system_alerts():
    """Devuelve las alertas visibles ahora (activas y en fecha)."""
    from applications.core.models import SystemAlert

    try:
        return _visible(SystemAlert.objects.filter(active=True))
    except Exception:
        return []


@register.simple_tag
def get_xmas_alert():
    """Devuelve la alerta 'Navidad' si está visible ahora, si no None."""
    from applications.core.models import SystemAlert

    try:
        alert = SystemAlert.objects.filter(name="Navidad").first()
    except Exception:
        return None
    if alert and alert.visible_now:
        return alert
    return None
