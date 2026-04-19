from django.urls import path

from applications.api.views import (
    CategoryListAPIView,
    FavoriteListAPIView,
    FavoriteToggleAPIView,
    HomeAPIView,
    ListingDetailAPIView,
    ListingListCreateAPIView,
    ListingSearchAPIView,
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    MeListingsAPIView,
    RefreshAPIView,
    RegisterAPIView,
)


urlpatterns = [
    path("categories/", CategoryListAPIView.as_view(), name="api-categories"),
    path("listings/", ListingListCreateAPIView.as_view(), name="api-listings"),
    path("listings/<int:pk>/", ListingDetailAPIView.as_view(), name="api-listing-detail"),
    path("listings/<int:pk>/favorite/", FavoriteToggleAPIView.as_view(), name="api-listing-favorite"),
    path("search/", ListingSearchAPIView.as_view(), name="api-search"),
    path("home/", HomeAPIView.as_view(), name="api-home"),
    path("me/", MeAPIView.as_view(), name="api-me"),
    path("me/listings/", MeListingsAPIView.as_view(), name="api-me-listings"),
    path("me/favorites/", FavoriteListAPIView.as_view(), name="api-me-favorites"),
    path("auth/register/", RegisterAPIView.as_view(), name="api-register"),
    path("auth/login/", LoginAPIView.as_view(), name="api-login"),
    path("auth/refresh/", RefreshAPIView.as_view(), name="api-refresh"),
    path("auth/logout/", LogoutAPIView.as_view(), name="api-logout"),
]
