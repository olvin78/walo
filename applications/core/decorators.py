from functools import wraps

from django.core.cache import cache
from django.conf import settings
from django.http import HttpResponse


def cache_public_page(timeout=None, vary_on_query=False):
    """
    Cachea una vista SOLO para usuarios anónimos (el HTML del navbar depende
    del usuario autenticado y su contador de mensajes, por lo que no debemos
    cachear respuestas de usuarios logueados).

    La clave incluye: vista + path + querystring (opcional, para páginas que
    usan filtros sin indexar, aunque éstas normalmente llevan noindex).
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if request.user.is_authenticated:
                return view_func(request, *args, **kwargs)

            ttl = timeout if timeout is not None else getattr(settings, "CACHE_HOME_TTL", 120)
            key = f"pub:{request.resolver_match.view_name}:{request.path}"
            if vary_on_query:
                key += f":{request.META.get('QUERY_STRING', '')}"

            cached = cache.get(key)
            if cached is not None:
                return HttpResponse(cached, content_type="text/html; charset=utf-8")

            response = view_func(request, *args, **kwargs)
            try:
                cache.set(key, response.content, ttl)
            except Exception:
                pass
            return response
        return wrapper
    return decorator