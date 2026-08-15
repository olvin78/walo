import random

from django import template

register = template.Library()


@register.simple_tag(takes_context=True)
def math_captcha(context):
    """Genera una operación matemática simple y guarda la respuesta en la sesión."""
    a = random.randint(1, 5)
    b = random.randint(1, 5)
    request = context.get("request")
    if request:
        request.session["math_captcha_answer"] = str(a + b)
    return f"¿Cuánto es {a} + {b}?"