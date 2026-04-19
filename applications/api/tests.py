from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from applications.core.models import Category, Listing


User = get_user_model()


class MobileAPITests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(
            name="Tecnologia",
            slug="tecnologia",
            icon="💻",
            description="",
            keywords="celular, laptop",
            order=1,
        )
        self.owner = User.objects.create_user(username="seller", email="seller@example.com", password="secret12345")
        self.other = User.objects.create_user(username="other", email="other@example.com", password="secret12345")
        self.active_listing = Listing.objects.create(
            title="iPhone usado",
            description="Buen estado",
            price=12000,
            category=self.category,
            location="Managua",
            user=self.owner,
            is_active=True,
        )
        self.inactive_listing = Listing.objects.create(
            title="Laptop antigua",
            description="Solo para refacciones",
            price=3000,
            category=self.category,
            location="Managua",
            user=self.owner,
            is_active=False,
        )

    def test_public_list_only_shows_active_listings(self):
        response = self.client.get(reverse("api-listings"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], self.active_listing.title)

    def test_public_detail_returns_active_listing(self):
        response = self.client.get(reverse("api-listing-detail", kwargs={"pk": self.active_listing.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], self.active_listing.title)

    def test_public_detail_hides_inactive_listing(self):
        response = self.client.get(reverse("api-listing-detail", kwargs={"pk": self.inactive_listing.pk}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_authenticated_user_can_create_listing(self):
        self.client.force_authenticate(user=self.owner)
        payload = {
            "title": "Samsung A54",
            "description": "Nuevo",
            "price": "15000",
            "category": self.category.pk,
            "location": "León",
        }
        response = self.client.post(reverse("api-listings"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Listing.objects.filter(title="Samsung A54", user=self.owner).count(), 1)

    def test_anonymous_user_cannot_create_listing(self):
        payload = {
            "title": "Samsung A54",
            "description": "Nuevo",
            "price": "15000",
            "category": self.category.pk,
            "location": "León",
        }
        response = self.client.post(reverse("api-listings"), payload, format="json")
        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_user_cannot_edit_someone_elses_listing(self):
        self.client.force_authenticate(user=self.other)
        payload = {"title": "Cambio"}
        response = self.client.patch(reverse("api-listing-detail", kwargs={"pk": self.active_listing.pk}), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_favorite_toggle_adds_and_removes(self):
        self.client.force_authenticate(user=self.other)
        favorite_url = reverse("api-listing-favorite", kwargs={"pk": self.active_listing.pk})

        add_response = self.client.post(favorite_url)
        self.assertEqual(add_response.status_code, status.HTTP_200_OK)
        self.assertTrue(self.active_listing.favorites.filter(pk=self.other.pk).exists())

        remove_response = self.client.delete(favorite_url)
        self.assertEqual(remove_response.status_code, status.HTTP_200_OK)
        self.assertFalse(self.active_listing.favorites.filter(pk=self.other.pk).exists())

    def test_login_returns_jwt_tokens(self):
        response = self.client.post(
            reverse("api-login"),
            {"login": self.owner.username, "password": "secret12345"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)
