from urllib.parse import urlparse

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.sitemaps import Sitemap
from django.contrib.sitemaps.views import x_robots_tag
from django.core.paginator import EmptyPage, PageNotAnInteger
from django.http import Http404
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils.http import http_date

from .models import Category, Department, Listing, department_listings_q


class HomeSitemap(Sitemap):
    protocol = "https"
    changefreq = "daily"
    priority = 1.0

    def items(self):
        return ["home"]

    def location(self, item):
        return reverse(item)


class CategorySitemap(Sitemap):
    protocol = "https"
    changefreq = "weekly"
    priority = 0.8

    def items(self):
        return Category.objects.filter(listings__is_active=True).distinct()

    def lastmod(self, obj):
        latest = obj.listings.filter(is_active=True).order_by("-created_at").first()
        return latest.created_at if latest else obj.listings.first().created_at if obj.listings.exists() else None


class ListingSitemap(Sitemap):
    protocol = "https"
    changefreq = "daily"
    priority = 0.9

    def items(self):
        return Listing.objects.filter(is_active=True).order_by("-created_at")

    def lastmod(self, obj):
        return obj.updated_at or obj.created_at


class ProfileSitemap(Sitemap):
    """La indexabilidad de un perfil depende únicamente de User (is_active,
    username), no de si ya existe una fila Profile persistida: user_profile
    crea el Profile de forma perezosa (get_or_create) en la primera visita,
    así que consultar Profile aquí podía dejar fuera del sitemap usuarios
    reales cuyo Profile no se hubiera creado todavía (p. ej. si la señal
    post_save de creación no se disparó al insertar el User)."""
    protocol = "https"
    changefreq = "weekly"
    priority = 0.5

    def items(self):
        return User.objects.filter(is_active=True).exclude(username__startswith="_")

    def location(self, obj):
        return reverse("user_profile", kwargs={"username": obj.username})

    def lastmod(self, obj):
        latest_listing = obj.listing_set.filter(is_active=True).order_by("-created_at").first()
        return latest_listing.created_at if latest_listing else obj.date_joined


class CitySitemap(Sitemap):
    protocol = "https"
    changefreq = "daily"
    priority = 0.6

    def items(self):
        return [
            d for d in Department.objects.all()
            if Listing.objects.filter(is_active=True).filter(department_listings_q(d)).exists()
        ]

    def location(self, item):
        return reverse("city_landing", kwargs={"city_slug": item.slug})


class CityCategorySitemap(Sitemap):
    protocol = "https"
    changefreq = "daily"
    priority = 0.5

    def items(self):
        categories = Category.objects.filter(listings__is_active=True).distinct()
        items = []
        for department in Department.objects.all():
            for category in categories:
                if Listing.objects.filter(is_active=True, category=category).filter(
                    department_listings_q(department)
                ).exists():
                    items.append((department.slug, category.slug))
        return items

    def location(self, item):
        city_slug, category_slug = item
        return reverse(
            "city_category_landing",
            kwargs={"city_slug": city_slug, "category_slug": category_slug},
        )


sitemaps = {
    "home": HomeSitemap,
    "categories": CategorySitemap,
    "listings": ListingSitemap,
    "profiles": ProfileSitemap,
    "cities": CitySitemap,
    "city_categories": CityCategorySitemap,
}


class _CanonicalSite:
    """Objeto mínimo compatible con Sitemap.get_urls(site=...): expone solo
    .domain, tomado de PUBLIC_BASE_URL — la misma autoridad de dominio única
    que ya usan canonical/og:url/robots.txt (ver 3A)."""

    domain = urlparse(settings.PUBLIC_BASE_URL).netloc


def _latest_lastmod(current, new):
    if new is None:
        return current
    return new if current is None else max(current, new)


@x_robots_tag
def sitemap_view(request, sitemaps, section=None, template_name="sitemap.xml", content_type="application/xml"):
    """Equivalente a django.contrib.sitemaps.views.sitemap, pero resuelve el
    dominio desde PUBLIC_BASE_URL (_CanonicalSite) en vez de
    contrib.sites.get_current_site(request).

    Causa raíz corregida: get_current_site(request) usa
    Site.objects.get_current(), que depende de la fila con id=SITE_ID en la
    base de datos y la cachea en memoria por proceso (SITE_CACHE de
    django.contrib.sites). Si esa fila no tiene el dominio correcto en el
    entorno donde corre la app -- por ejemplo porque la migración de datos
    que la fija no llegó a ejecutarse en esa base de datos, o el proceso
    lleva cacheado un valor previo -- el sitemap generaba URLs con
    "example.com" (el valor de fábrica de Django) sin que hubiera ningún
    error visible. Esta vista deja de depender por completo de esa tabla
    para construir las URLs del sitemap."""
    req_protocol = request.scheme
    req_site = _CanonicalSite()

    if section is not None:
        if section not in sitemaps:
            raise Http404("No sitemap available for section: %r" % section)
        maps = [sitemaps[section]]
    else:
        maps = sitemaps.values()
    page = request.GET.get("p", 1)

    lastmod = None
    all_sites_lastmod = True
    urls = []
    for site in maps:
        try:
            if callable(site):
                site = site()
            urls.extend(site.get_urls(page=page, site=req_site, protocol=req_protocol))
            if all_sites_lastmod:
                site_lastmod = getattr(site, "latest_lastmod", None)
                if site_lastmod is not None:
                    lastmod = _latest_lastmod(lastmod, site_lastmod)
                else:
                    all_sites_lastmod = False
        except EmptyPage:
            raise Http404("Page %s empty" % page)
        except PageNotAnInteger:
            raise Http404("No page '%s'" % page)

    headers = None
    if all_sites_lastmod and lastmod:
        headers = {"Last-Modified": http_date(lastmod.timestamp())}
    return TemplateResponse(
        request, template_name, {"urlset": urls}, content_type=content_type, headers=headers,
    )
