from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from .models import Category, Listing


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
        return Category.objects.all()


class ListingSitemap(Sitemap):
    changefreq = "daily"
    priority = 0.8

    def items(self):
        return Listing.objects.all().order_by("-created_at")

    def lastmod(self, obj):
        return obj.created_at


sitemaps = {
    "home": HomeSitemap,
    "categories": CategorySitemap,
    "listings": ListingSitemap,
}
