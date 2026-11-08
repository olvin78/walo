from django import template

register = template.Library()


def _visible(alerts):
    """Filtra por activa + rango de fechas (si tiene)."""
    return [a for a in alerts if a.visible_now]


@register.simple_tag
def get_system_alerts():
    """Devuelve las alertas visibles ahora (activas y en fecha).

    Excluye los popups exclusivos de la web ("Navidad", "Verificacion"):
    esos se muestran como modal en el home, nunca como barra superior.
    """
    from applications.core.models import SystemAlert

    try:
        return _visible(
            SystemAlert.objects.filter(active=True).exclude(
                name__in=["Navidad", "Verificacion"]
            )
        )
    except Exception:
        return []


@register.simple_tag
def get_popup_alert(name):
    """Devuelve la alerta con ese nombre si está visible ahora, si no None."""
    from applications.core.models import SystemAlert

    try:
        alert = SystemAlert.objects.filter(name=name).first()
    except Exception:
        return None
    if alert and alert.visible_now:
        return alert
    return None


@register.simple_tag
def get_xmas_alert():
    """Devuelve la alerta 'Navidad' si está visible ahora, si no None."""
    return get_popup_alert("Navidad")
