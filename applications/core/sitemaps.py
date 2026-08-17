from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from .models import Category, Listing, Profile

CITY_LANDINGS = {
    "boaco": "Boaco",
    "carazo": "Carazo",
    "chinandega": "Chinandega",
    "chontales": "Chontales",
    "esteli": "Estelí",
    "granada": "Granada",
    "jinotega": "Jinotega",
    "leon": "León",
    "madriz": "Madriz",
    "managua": "Managua",
    "masaya": "Masaya",
    "matagalpa": "Matagalpa",
    "nueva-segovia": "Nueva Segovia",
    "rivas": "Rivas",
    "rio-san-juan": "Río San Juan",
    "raccn": "Costa Caribe Norte",
    "raccs": "Costa Caribe Sur",
}


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
    protocol = "https"
    changefreq = "weekly"
    priority = 0.5

    def items(self):
        return Profile.objects.filter(user__is_active=True).exclude(user__username__startswith="_")

    def location(self, obj):
        return reverse("user_profile", kwargs={"username": obj.user.username})

    def lastmod(self, obj):
        latest_listing = obj.user.listing_set.filter(is_active=True).order_by("-created_at").first()
        return latest_listing.created_at if latest_listing else obj.user.date_joined


class CitySitemap(Sitemap):
    protocol = "https"
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
    protocol = "https"
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
    "profiles": ProfileSitemap,
    "cities": CitySitemap,
    "city_categories": CityCategorySitemap,
}
