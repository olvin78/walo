from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from .models import Category, Listing

CITY_LANDINGS = {
    "managua": "Managua",
    "leon": "León",
    "granada": "Granada",
    "masaya": "Masaya",
    "esteli": "Estelí",
    "matagalpa": "Matagalpa",
}


class HomeSitemap(Sitemap):
    changefreq = "daily"
    priority = 1.0

    def items(self):
        return ["home"]

    def location(self, item):
        return reverse(item)


class CategorySitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.7

    def items(self):
        return Category.objects.filter(listings__is_active=True).distinct()


class ListingSitemap(Sitemap):
    changefreq = "daily"
    priority = 0.8

    def items(self):
        # TODO: filter only public/published listings when that state exists.
        return Listing.objects.filter(is_active=True).order_by("-created_at")

    def lastmod(self, obj):
        return obj.created_at


class CitySitemap(Sitemap):
    changefreq = "daily"
    priority = 0.6

    def items(self):
        items = []
        for city_slug, city_name in CITY_LANDINGS.items():
            if Listing.objects.filter(is_active=True, location__icontains=city_name).exists():
                items.append(city_slug)
        return items

    def location(self, item):
        return reverse("city_landing", kwargs={"city_slug": item})


class CityCategorySitemap(Sitemap):
    changefreq = "daily"
    priority = 0.5

    def items(self):
        items = []
        categories = Category.objects.filter(listings__is_active=True).distinct()
        for city_slug, city_name in CITY_LANDINGS.items():
            for category in categories:
                if Listing.objects.filter(
                    is_active=True,
                    location__icontains=city_name,
                    category=category,
                ).exists():
                    items.append((city_slug, category.slug))
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
    "cities": CitySitemap,
    "city_categories": CityCategorySitemap,
}
