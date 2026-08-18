from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView
from django.views.static import serve

from applications.core.sitemaps import sitemap_view, sitemaps

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("api/v1/", include("applications.api.urls")),
    path("", include("applications.core.urls")),
    path(
        "robots.txt",
        TemplateView.as_view(template_name="robots.txt", content_type="text/plain"),
    ),
    path("sitemap.xml", sitemap_view, {"sitemaps": sitemaps}, name="sitemap"),
]

urlpatterns += [
    path("media/<path:path>", serve, {"document_root": settings.MEDIA_ROOT}),
]
