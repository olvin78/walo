from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from applications.core.models import Category, Listing, Subcategory


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
            status="paused",
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


class ListingSearchAPITests(APITestCase):
    """P1 — Fase 3: integración del motor de búsqueda compartido en la API.

    Valida que /search/ usa applications/core/search.py (el mismo motor que
    la Web), mantiene el contrato JSON, los filtros, la paginación y
    exact_matches, y produce los mismos resultados/orden que la Web.
    """

    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(username="api_search", password="x")

        cls.cat_celulares = Category.objects.create(
            name="Celulares", slug="celulares", icon="📱", keywords="movil, telefono", order=1,
        )
        cls.cat_videojuegos = Category.objects.create(
            name="Videojuegos", slug="videojuegos", icon="🎮", keywords="consola, juego", order=2,
        )
        cls.cat_hogar = Category.objects.create(
            name="Hogar", slug="hogar", icon="🏠", keywords="mueble, sofa", order=3,
        )
        cls.cat_otros = Category.objects.create(
            name="Otros", slug="otros", icon="🔎", keywords="", order=4,
        )
        cls.cat_ropa = Category.objects.create(
            name="Ropa", slug="ropa", icon="👕", keywords="camisa", order=5,
        )
        cls.cat_deporte = Category.objects.create(
            name="Deporte", slug="deporte", icon="⚽", keywords="deportes", order=6,
        )
        cls.sub_smartphones = Subcategory.objects.create(
            category=cls.cat_celulares,
            name="Smartphones",
            slug="smartphones",
            icon="📱",
            keywords="celular, movil",
            order=1,
        )
        cls.sub_audio = Subcategory.objects.create(
            category=cls.cat_celulares,
            name="Audio",
            slug="audio",
            icon="🔊",
            keywords="audio, sonido",
            order=2,
        )

        def make(title, category, price, **extra):
            defaults = dict(
                title=title,
                description="Anuncio de prueba para API search",
                price=price,
                category=category,
                user=cls.user,
                location="Managua",
                is_active=True,
            )
            defaults.update(extra)
            return Listing.objects.create(**defaults)

        cls.iphone_max = make("iPhone 15 Pro Max 256GB", cls.cat_celulares, 900,
                              subcategory=cls.sub_smartphones)
        cls.iphone_usado = make("iPhone 15 Pro usado", cls.cat_celulares, 700,
                                subcategory=cls.sub_smartphones)
        cls.ps5 = make("PS5 Console", cls.cat_videojuegos, 500, location="León")
        cls.cafetera = make("Cafetera Pro 12 tazas", cls.cat_hogar, 40, location="Masaya")
        cls.libros = make("Libros nuevos colección completa", cls.cat_otros, 10)
        cls.lata = make("Lata de Coca Cola coleccionable", cls.cat_otros, 5)
        cls.multiplataforma = make("Multiplataforma 15CM decorativa", cls.cat_otros, 8, location="Boaco")
        cls.sofa = make("Sofá 3 puestos color gris", cls.cat_hogar, 300)
        cls.camisa = make("Camisa azul talla M", cls.cat_ropa, 25)
        cls.telefono = make("Teléfono antiguo de colección", cls.cat_celulares, 50, location="Granada")
        cls.bicicleta = make("Bicicleta de montaña rodado 29", cls.cat_deporte, 200, location="Estelí")
        cls.inactivo = make("iPhone 15 Pro descontinuado", cls.cat_celulares, 1, status="paused")

        cls.active_count = 11

    def get_search(self, **params):
        return self.client.get(reverse("api-search"), params)

    def titles(self, response):
        return [item["title"] for item in response.data["results"]]

    def title_set(self, response):
        return set(self.titles(response))

    # 1. iphone 15 pro: sin falsos positivos
    def test_iphone_15_pro_sin_falsos_positivos(self):
        resp = self.get_search(q="iphone 15 pro")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        result = self.title_set(resp)
        self.assertIn("iPhone 15 Pro Max 256GB", result)
        self.assertIn("iPhone 15 Pro usado", result)
        self.assertNotIn("Cafetera Pro 12 tazas", result)
        self.assertNotIn("Libros nuevos colección completa", result)
        self.assertNotIn("Lata de Coca Cola coleccionable", result)
        self.assertNotIn("Multiplataforma 15CM decorativa", result)

    # 2. playstation 5 -> PS5 Console
    def test_playstation_5_devuelve_ps5_console(self):
        resp = self.get_search(q="playstation 5")
        self.assertEqual(self.title_set(resp), {"PS5 Console"})

    def test_ps5_devuelve_ps5_console(self):
        resp = self.get_search(q="ps5")
        self.assertEqual(self.title_set(resp), {"PS5 Console"})

    # 3. sofa / sofá equivalentes
    def test_sofa_sin_tilde_equivale_a_sofa_con_tilde(self):
        sin = self.title_set(self.get_search(q="sofa"))
        con = self.title_set(self.get_search(q="sofá"))
        self.assertEqual(sin, {"Sofá 3 puestos color gris"})
        self.assertEqual(con, sin)

    # 4. camisa / camisas equivalentes
    def test_camisa_y_camisas_equivalentes(self):
        singular = self.title_set(self.get_search(q="camisa"))
        plural = self.title_set(self.get_search(q="camisas"))
        self.assertIn("Camisa azul talla M", singular)
        self.assertIn("Camisa azul talla M", plural)

    # 5. sin q: comportamiento anterior intacto
    def test_sin_q_devuelve_todos_los_activos_orden_cronologico(self):
        resp = self.get_search()
        self.assertEqual(resp.data["count"], self.active_count)
        ids = [item["id"] for item in resp.data["results"]]
        self.assertEqual(ids, sorted(ids, reverse=True))
        self.assertNotIn(self.inactivo.title, self.title_set(resp))

    # 6. búsqueda + categoría
    def test_query_mas_categoria(self):
        resp = self.get_search(q="iphone 15 pro", category="celulares")
        self.assertEqual(self.title_set(resp), {"iPhone 15 Pro Max 256GB", "iPhone 15 Pro usado"})
        resp = self.get_search(q="iphone 15 pro", category="hogar")
        self.assertEqual(self.title_set(resp), set())

    # 7. búsqueda + subcategoría
    def test_query_mas_subcategoria(self):
        resp = self.get_search(q="iphone 15 pro", subcategory="smartphones")
        self.assertEqual(self.title_set(resp), {"iPhone 15 Pro Max 256GB", "iPhone 15 Pro usado"})
        resp = self.get_search(q="iphone 15 pro", subcategory="audio")
        self.assertEqual(self.title_set(resp), set())

    # 8. búsqueda + precio
    def test_query_mas_precio(self):
        resp = self.get_search(q="iphone 15 pro", min_price="800")
        self.assertEqual(self.title_set(resp), {"iPhone 15 Pro Max 256GB"})
        resp = self.get_search(q="iphone 15 pro", min_price="800", max_price="850")
        self.assertEqual(self.title_set(resp), set())

    # 9. búsqueda + ubicación
    def test_query_mas_ubicacion(self):
        resp = self.get_search(q="iphone 15 pro", location="Managua")
        self.assertEqual(self.title_set(resp), {"iPhone 15 Pro Max 256GB", "iPhone 15 Pro usado"})
        resp = self.get_search(q="iphone 15 pro", location="Boaco")
        self.assertEqual(self.title_set(resp), set())

    # 10. búsqueda + sort
    def test_query_mas_sort_newest_mantiene_relevancia(self):
        resp = self.get_search(q="iphone 15 pro", sort="newest")
        self.assertEqual(self.title_set(resp), {"iPhone 15 Pro Max 256GB", "iPhone 15 Pro usado"})

    def test_query_mas_sort_precio_asc(self):
        resp = self.get_search(q="iphone 15 pro", sort="price_asc")
        prices = [item["price"] for item in resp.data["results"]]
        self.assertEqual(prices, sorted(prices))

    def test_query_mas_sort_precio_desc(self):
        resp = self.get_search(q="iphone 15 pro", sort="price_desc")
        prices = [item["price"] for item in resp.data["results"]]
        self.assertEqual(prices, sorted(prices, reverse=True))

    # 11. paginación
    def test_paginacion(self):
        resp = self.get_search(q="iphone 15 pro", page_size="1")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertIsNotNone(resp.data["next"])
        first_id = resp.data["results"][0]["id"]
        page2 = self.get_search(q="iphone 15 pro", page_size="1", page="2")
        self.assertEqual(len(page2.data["results"]), 1)
        self.assertNotEqual(page2.data["results"][0]["id"], first_id)

    # 12. exact_matches
    def test_exact_matches_verdadero_en_coincidencia_estricta(self):
        self.assertTrue(self.get_search(q="ps5").data["exact_matches"])
        self.assertTrue(self.get_search(q="playstation 5").data["exact_matches"])

    def test_exact_matches_falso_en_fallback_trigram(self):
        self.assertFalse(self.get_search(q="biciclta").data["exact_matches"])
        self.assertFalse(self.get_search(q="camisas").data["exact_matches"])

    # 13. contrato JSON existente
    def test_contrato_json(self):
        resp = self.get_search(q="iphone 15 pro")
        data = resp.data
        self.assertIn("count", data)
        self.assertIn("next", data)
        self.assertIn("previous", data)
        self.assertIn("results", data)
        self.assertIn("exact_matches", data)
        self.assertIsInstance(data["results"], list)
        self.assertTrue(all({"id", "title"} <= set(item) for item in data["results"]))

    # 14. queryset compatible con count()/paginación/filtros posteriores
    def test_queryset_compatible_con_count_y_filtros(self):
        resp = self.get_search(q="iphone 15 pro", page_size="100")
        self.assertEqual(resp.data["count"], 2)
        self.assertEqual(len(resp.data["results"]), resp.data["count"])
        self.assertIsNone(resp.data["next"])

    # 15. Web y API: misma selección y orden
    def test_web_y_api_mismo_ranking(self):
        for query in ["ps5", "playstation 5", "iphone 15 pro", "sofa", "telefono"]:
            api = self.titles(self.get_search(q=query))
            web = self.client.get(reverse("explore"), {"q": query})
            web_titles = [l.title for l in web.context["listings"]]
            self.assertEqual(
                api, web_titles,
                f"Web y API difieren para q={query!r}: API={api} Web={web_titles}",
            )
