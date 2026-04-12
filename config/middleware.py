import logging
from urllib.parse import urlencode

from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse


logger = logging.getLogger("django")


class LoginRequiredMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            return self.get_response(request)

        path = request.path
        allowed_paths = {
            "/",
            settings.LOGIN_URL,
            "/robots.txt",
            "/sitemap.xml",
            "/registro/",
        }
        allowed_prefixes = (
            "/admin/",
            "/accounts/",
            settings.STATIC_URL,
            settings.MEDIA_URL,
        )

        if path in allowed_paths or path.startswith(allowed_prefixes):
            return self.get_response(request)

        query = urlencode({"next": request.get_full_path()})
        return redirect(f"{settings.LOGIN_URL}?{query}")


class HostRedirectMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = request.get_host()
        if host == "127.0.0.1:8000":
            protocol = getattr(settings, "ACCOUNT_DEFAULT_HTTP_PROTOCOL", "http")
            target = f"{protocol}://localhost:8000{request.get_full_path()}"
            return redirect(target)
        return self.get_response(request)


class AllauthDebugMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/accounts/google/"):
            try:
                callback_path = reverse("google_callback")
                callback_url = request.build_absolute_uri(callback_path)
            except Exception:
                callback_url = "<unknown>"
            logger.warning(
                "ALLAUTH DEBUG host=%s path=%s callback=%s",
                request.get_host(),
                request.path,
                callback_url,
            )
        return self.get_response(request)
