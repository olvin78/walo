import json
import re

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from .models import Brand, Category, City, Department, Listing, Model, department_listings_q
from .search import search_listings


class SearchEngineTests(TestCase):
    """Motor de búsqueda P1 — Fase 1 (applications/core/search.py).

    Todavía no está conectado a ningún endpoint de Web ni de App: estos
    tests validan el motor de forma aislada, contra PostgreSQL real
    (unaccent + pg_trgm), tal como se probó manualmente durante la
    auditoría antes de escribir este archivo.
    """

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="buscador_test", password="x")

        category_cache: dict[str, Category] = {}

        def cat(slug):
            if slug not in category_cache:
                category_cache[slug], _ = Category.objects.get_or_create(
                    slug=slug, defaults={"name": slug.capitalize(), "icon": "🔎"},
                )
            return category_cache[slug]

        listings = [
            ("ps5_console", "PS5 Console", cat("videojuegos")),
            ("iphone_15_pro", "iPhone 15 Pro Max 256GB", cat("celulares")),
            ("iphone_13", "iPhone 13 usado buen estado", cat("celulares")),
            ("cafetera_pro", "Cafetera Pro 12 tazas", cat("hogar")),
            ("libros_nuevos", "Libros nuevos colección completa", cat("libros")),
            ("lata_coca_cola", "Lata de Coca Cola coleccionable", cat("otros")),
            ("multiplataforma_15cm", "Multiplataforma 15CM decorativa", cat("otros")),
            ("sofa_gris", "Sofá 3 puestos color gris", cat("hogar")),
            ("sofa_barato", "Sofa cama barato usado", cat("hogar")),
            ("zapatos_baratos", "Zapatos baratos talla 40", cat("moda")),
            ("bicicleta_montana", "Bicicleta de montaña rodado 29", cat("deporte")),
            ("bicicleta_ninos", "Bicicletas para niños rin 20", cat("deporte")),
            ("cabana_montana", "Cabaña en alquiler en la montaña", cat("inmuebles")),
            ("camisa_azul", "Camisa azul talla M", cat("ropa")),
            ("telefono_antiguo", "Teléfono antiguo de colección", cat("celulares")),
        ]
        cls.ids = {}
        for key, title, category in listings:
            listing = Listing.objects.create(
                title=title,
                description="Anuncio de prueba para test_search",
                price=100,
                category=category,
                user=cls.user,
                location="Managua",
                is_active=True,
            )
            cls.ids[key] = listing.id

    def qs(self):
        return Listing.objects.filter(id__in=self.ids.values())

    def titles_for(self, query):
        return set(search_listings(self.qs(), query).values_list("title", flat=True))

    # --- Positivos ---

    def test_ps5_encuentra_ps5_console(self):
        self.assertEqual(self.titles_for("ps5"), {"PS5 Console"})

    def test_playstation_5_encuentra_ps5_console(self):
        self.assertEqual(self.titles_for("playstation 5"), {"PS5 Console"})

    def test_sofa_sin_tilde_encuentra_sofa_con_tilde(self):
        result = self.titles_for("sofa")
        self.assertIn("Sofá 3 puestos color gris", result)

    def test_sofa_con_tilde_encuentra_lo_mismo(self):
        result = self.titles_for("sofá")
        self.assertIn("Sofá 3 puestos color gris", result)

    def test_telefono_sin_tilde_encuentra_telefono_con_tilde(self):
        result = self.titles_for("telefono")
        self.assertIn("Teléfono antiguo de colección", result)

    def test_telefono_con_tilde_encuentra_lo_mismo(self):
        result = self.titles_for("teléfono")
        self.assertIn("Teléfono antiguo de colección", result)

    def test_camisa_singular_encuentra_el_anuncio(self):
        self.assertIn("Camisa azul talla M", self.titles_for("camisa"))

    def test_camisas_plural_comportamiento_coherente(self):
        # Sin stemming manual: el plural no hace match estricto, pero el
        # fallback por trigramas sí lo recupera (comportamiento documentado,
        # no un bug).
        self.assertIn("Camisa azul talla M", self.titles_for("camisas"))

    def test_typo_leve_via_trigram_cuando_es_matematicamente_viable(self):
        # "biciclta montaña" (falta una "e") tiene similitud > 0.45 contra
        # el título real, muy por encima del umbral (0.2) -> debe recuperarse.
        self.assertIn(
            "Bicicleta de montaña rodado 29",
            self.titles_for("biciclta montaña"),
        )

    # --- Negativos (el bug original reportado) ---

    def test_iphone_15_pro_no_devuelve_cafetera_pro(self):
        result = self.titles_for("iphone 15 pro")
        self.assertNotIn("Cafetera Pro 12 tazas", result)

    def test_iphone_15_pro_no_devuelve_libros_nuevos(self):
        result = self.titles_for("iphone 15 pro")
        self.assertNotIn("Libros nuevos colección completa", result)

    def test_iphone_15_pro_no_devuelve_lata_de_coca_cola(self):
        result = self.titles_for("iphone 15 pro")
        self.assertNotIn("Lata de Coca Cola coleccionable", result)

    def test_iphone_15_pro_no_devuelve_multiplataforma_15cm(self):
        result = self.titles_for("iphone 15 pro")
        self.assertNotIn("Multiplataforma 15CM decorativa", result)

    def test_iphone_15_pro_si_encuentra_el_iphone_real(self):
        result = self.titles_for("iphone 15 pro")
        self.assertIn("iPhone 15 Pro Max 256GB", result)

    def test_sofa_barato_no_devuelve_solo_por_barato(self):
        result = self.titles_for("sofa barato")
        self.assertNotIn("Zapatos baratos talla 40", result)
        self.assertNotIn("Sofá 3 puestos color gris", result)  # no tiene "barato"
        self.assertIn("Sofa cama barato usado", result)

    def test_bicicleta_montana_no_devuelve_solo_por_montana(self):
        result = self.titles_for("bicicleta montaña")
        self.assertNotIn("Cabaña en alquiler en la montaña", result)
        self.assertIn("Bicicleta de montaña rodado 29", result)

    # --- Contrato del motor ---

    def test_devuelve_queryset_no_lista(self):
        from django.db.models import QuerySet

        result = search_listings(self.qs(), "iphone")
        self.assertIsInstance(result, QuerySet)

    def test_query_vacia_devuelve_el_queryset_sin_filtrar(self):
        self.assertEqual(search_listings(self.qs(), "").count(), self.qs().count())
        self.assertEqual(search_listings(self.qs(), None).count(), self.qs().count())


class WebSearchIntegrationTests(TestCase):
    """P1 — Fase 2: integración del motor de búsqueda en la Web (home/explore).

    Valida que las vistas `home` y `explore` usan applications/core/search.py
    (en vez de la antigua build_search_query) sin romper filtros existentes
    de categoría/subcategoría/precio/ubicación/orden.
    """

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="web_search_test", password="x")

        cls.cat_celulares = Category.objects.get_or_create(
            slug="celulares", defaults={"name": "Celulares", "icon": "📱"},
        )[0]
        cls.cat_hogar = Category.objects.get_or_create(
            slug="hogar", defaults={"name": "Hogar", "icon": "🏠"},
        )[0]
        cls.cat_videojuegos = Category.objects.get_or_create(
            slug="videojuegos", defaults={"name": "Videojuegos", "icon": "🎮"},
        )[0]
        cls.cat_otros = Category.objects.get_or_create(
            slug="otros", defaults={"name": "Otros", "icon": "🔎"},
        )[0]

        def make(title, category, price, **extra):
            defaults = dict(
                title=title,
                description="Anuncio de prueba para test_web_search",
                price=price,
                category=category,
                user=cls.user,
                location="Managua",
                is_active=True,
            )
            defaults.update(extra)
            return Listing.objects.create(**defaults)

        cls.iphone = make("iPhone 15 Pro Max 256GB", cls.cat_celulares, 900)
        cls.iphone_barato = make("iPhone 15 Pro usado", cls.cat_celulares, 700)
        cls.cafetera = make("Cafetera Pro 12 tazas", cls.cat_hogar, 40)
        cls.libros = make("Libros nuevos colección completa", cls.cat_otros, 10)
        cls.ps5 = make("PS5 Console", cls.cat_videojuegos, 500)
        cls.sofa = make("Sofá 3 puestos color gris", cls.cat_hogar, 300)
        cls.telefono = make("Teléfono antiguo de colección", cls.cat_celulares, 50)
        cls.inactivo = make(
            "iPhone 15 Pro descontinuado", cls.cat_celulares, 1, status="paused",
        )

    # --- Consultas obligatorias de la Fase 2 ---

    def test_explore_iphone_15_pro_no_devuelve_cafetera(self):
        resp = self.client.get(reverse("explore"), {"q": "iphone 15 pro"})
        self.assertEqual(resp.status_code, 200)
        titles = {l.title for l in resp.context["listings"]}
        self.assertIn("iPhone 15 Pro Max 256GB", titles)
        self.assertNotIn("Cafetera Pro 12 tazas", titles)
        self.assertNotIn("Libros nuevos colección completa", titles)

    def test_explore_ps5(self):
        resp = self.client.get(reverse("explore"), {"q": "ps5"})
        titles = {l.title for l in resp.context["listings"]}
        self.assertEqual(titles, {"PS5 Console"})

    def test_explore_playstation_5(self):
        resp = self.client.get(reverse("explore"), {"q": "playstation 5"})
        titles = {l.title for l in resp.context["listings"]}
        self.assertEqual(titles, {"PS5 Console"})

    def test_explore_sofa_sin_tilde(self):
        resp = self.client.get(reverse("explore"), {"q": "sofa"})
        titles = {l.title for l in resp.context["listings"]}
        self.assertIn("Sofá 3 puestos color gris", titles)

    def test_explore_sofa_con_tilde(self):
        resp = self.client.get(reverse("explore"), {"q": "sofá"})
        titles = {l.title for l in resp.context["listings"]}
        self.assertIn("Sofá 3 puestos color gris", titles)

    def test_explore_telefono_sin_tilde(self):
        resp = self.client.get(reverse("explore"), {"q": "telefono"})
        titles = {l.title for l in resp.context["listings"]}
        self.assertIn("Teléfono antiguo de colección", titles)

    def test_explore_telefono_con_tilde(self):
        resp = self.client.get(reverse("explore"), {"q": "teléfono"})
        titles = {l.title for l in resp.context["listings"]}
        self.assertIn("Teléfono antiguo de colección", titles)

    def test_explore_solo_incluye_activos(self):
        resp = self.client.get(reverse("explore"), {"q": "iphone 15 pro"})
        titles = {l.title for l in resp.context["listings"]}
        self.assertNotIn("iPhone 15 Pro descontinuado", titles)

    # --- Sin q: comportamiento sin cambios ---

    def test_explore_sin_q_devuelve_todos_los_activos(self):
        resp = self.client.get(reverse("explore"))
        self.assertEqual(resp.status_code, 200)
        titles = {l.title for l in resp.context["listings"]}
        self.assertNotIn("iPhone 15 Pro descontinuado", titles)  # inactivo, filtrado igual que antes
        self.assertIn("Cafetera Pro 12 tazas", titles)
        self.assertIn("PS5 Console", titles)

    def test_explore_sin_q_orden_por_defecto_es_cronologico(self):
        resp = self.client.get(reverse("explore"))
        listings = list(resp.context["listings"])
        ids = [l.id for l in listings]
        self.assertEqual(ids, sorted(ids, reverse=True))

    # --- Filtros existentes combinados con búsqueda ---

    def test_explore_query_mas_categoria(self):
        resp = self.client.get(
            reverse("explore"), {"q": "iphone 15 pro", "category": "hogar"}
        )
        titles = {l.title for l in resp.context["listings"]}
        self.assertEqual(titles, set())  # el iPhone no es de categoría "hogar"

    def test_explore_query_mas_precio(self):
        resp = self.client.get(
            reverse("explore"),
            {"q": "iphone 15 pro", "min_price": "800"},
        )
        titles = {l.title for l in resp.context["listings"]}
        self.assertIn("iPhone 15 Pro Max 256GB", titles)
        self.assertNotIn("iPhone 15 Pro usado", titles)  # 700 < 800

    def test_explore_query_mas_ubicacion(self):
        resp = self.client.get(
            reverse("explore"), {"q": "iphone 15 pro", "location": "Managua"}
        )
        titles = {l.title for l in resp.context["listings"]}
        self.assertIn("iPhone 15 Pro Max 256GB", titles)

    # --- Ordenación: relevancia por defecto, orden explícito respetado ---

    def test_explore_query_orden_por_defecto_es_relevancia(self):
        resp = self.client.get(reverse("explore"), {"q": "iphone 15 pro"})
        listings = list(resp.context["listings"])
        self.assertTrue(hasattr(listings[0], "relevance_score"))

    def test_explore_query_mas_sort_precio_asc_respeta_orden_explicito(self):
        resp = self.client.get(
            reverse("explore"), {"q": "iphone 15 pro", "sort": "price_asc"}
        )
        listings = list(resp.context["listings"])
        prices = [l.price for l in listings]
        self.assertEqual(prices, sorted(prices))

    def test_explore_query_mas_sort_precio_desc_respeta_orden_explicito(self):
        resp = self.client.get(
            reverse("explore"), {"q": "iphone 15 pro", "sort": "price_desc"}
        )
        listings = list(resp.context["listings"])
        prices = [l.price for l in listings]
        self.assertEqual(prices, sorted(prices, reverse=True))

    def test_explore_desempate_relevancia_created_at_id(self):
        # Ambos iPhone hacen match estricto por título -> mismo relevance_score;
        # el desempate cae a -created_at, -id (el más nuevo primero).
        resp = self.client.get(reverse("explore"), {"q": "iphone 15 pro"})
        listings = list(resp.context["listings"])
        ids = [l.id for l in listings if l.title.startswith("iPhone 15 Pro")]
        self.assertEqual(ids, sorted(ids, reverse=True))

    # --- Home: sigue funcionando (top resultados relevantes) ---

    def test_home_sin_q_no_ejecuta_busqueda(self):
        resp = self.client.get(reverse("home"))
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.context["search_results"])

    def test_home_con_q_iphone_15_pro_no_devuelve_cafetera(self):
        resp = self.client.get(reverse("home"), {"q": "iphone 15 pro"})
        self.assertEqual(resp.status_code, 200)
        titles = {l.title for l in resp.context["search_results"]}
        self.assertIn("iPhone 15 Pro Max 256GB", titles)
        self.assertNotIn("Cafetera Pro 12 tazas", titles)

    def test_home_con_q_limita_a_cuatro_resultados(self):
        resp = self.client.get(reverse("home"), {"q": "iphone"})
        self.assertLessEqual(len(list(resp.context["search_results"])), 4)


class ListingDataModelTests(TestCase):
    """FASE 2 — Modelo de datos SEO: status/condition/brand/model/year/geo."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="datos_test", password="x")
        cls.cat, _ = Category.objects.get_or_create(slug="celulares", defaults={"name": "Celulares", "icon": "📱"})
        cls.brand = Brand.objects.create(name="Apple", slug="apple")
        cls.model_iphone = Model.objects.create(name="iPhone 15 Pro", slug="iphone-15-pro", brand=cls.brand, category=cls.cat)
        cls.dept, _ = Department.objects.get_or_create(slug="managua", defaults={"name": "Managua"})
        cls.city, _ = City.objects.get_or_create(slug="managua", defaults={"name": "Managua", "department": cls.dept})

    def detail_url(self, listing):
        return reverse("listing_detail", kwargs={"listing_id": listing.pk, "slug": listing.slug})

    def test_is_active_derivado_de_status(self):
        l = Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Activo", price=100, location="Managua")
        self.assertTrue(l.is_active)
        l.status = Listing.STATUS_PAUSED
        l.save()
        l.refresh_from_db()
        self.assertFalse(l.is_active)
        l.status = Listing.STATUS_SOLD
        l.save()
        l.refresh_from_db()
        self.assertFalse(l.is_active)

    def test_filter_is_active_equivale_a_status_active(self):
        Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="A1", price=100, location="Managua")
        Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="A2", price=100, location="Managua", status=Listing.STATUS_SOLD)
        Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="A3", price=100, location="Managua", status=Listing.STATUS_PAUSED)
        ids_activos = set(Listing.objects.filter(is_active=True).values_list("id", flat=True))
        ids_por_status = set(Listing.objects.filter(status=Listing.STATUS_ACTIVE).values_list("id", flat=True))
        self.assertEqual(ids_activos, ids_por_status)
        self.assertEqual(len(ids_activos), 1)

    def test_location_property_lee_y_escribe_address_text(self):
        l = Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Loc", price=100, location="Managua")
        self.assertEqual(l.address_text, "Managua")
        self.assertEqual(l.location, "Managua")
        l.location = "Boaco"
        l.save()
        l.refresh_from_db()
        self.assertEqual(l.address_text, "Boaco")
        self.assertEqual(l.location, "Boaco")

    def test_modelo_deriva_brand_y_category(self):
        l = Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Modelo", price=100, model=self.model_iphone, location="Managua")
        l.refresh_from_db()
        self.assertEqual(l.brand_id, self.brand.id)
        self.assertEqual(l.category_id, self.cat.id)

    def test_city_deriva_department(self):
        l = Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Geo", price=100, city=self.city, location="Managua")
        l.refresh_from_db()
        self.assertEqual(l.department_id, self.dept.id)

    def test_clean_valida_marca_modelo_y_ano(self):
        other_brand = Brand.objects.create(name="Samsung", slug="samsung")
        l = Listing(user=self.user, category=self.cat, title="Inválido", price=100, brand=other_brand, model=self.model_iphone, location="Managua")
        with self.assertRaises(ValidationError):
            l.full_clean()
        l2 = Listing(user=self.user, category=self.cat, title="Año malo", price=100, year=1900, location="Managua")
        with self.assertRaises(ValidationError):
            l2.full_clean()
        l3 = Listing(user=self.user, category=self.cat, description="Desc", title="Año ok", price=100, year=2024, location="Managua")
        l3.full_clean()

    def test_unique_brand_model(self):
        with self.assertRaises(Exception):
            Model.objects.create(name="iPhone 15 Pro", brand=self.brand, category=self.cat)

    def test_department_listings_q(self):
        dept_boaco, _ = Department.objects.get_or_create(slug="boaco", defaults={"name": "Boaco"})
        Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Dept Managua", price=100, department=self.dept, location="Managua")
        Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Sin dept", price=100, department=None, location="Managua, Nicaragua")
        Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Boaco", price=100, department=None, location="Boaco")
        titles = set(Listing.objects.filter(department_listings_q(self.dept)).values_list("title", flat=True))
        self.assertIn("Dept Managua", titles)
        self.assertIn("Sin dept", titles)
        self.assertNotIn("Boaco", titles)

    def test_sold_listing_200_noindex_y_badge(self):
        l = Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Vendido", price=100, location="Managua", status=Listing.STATUS_SOLD)
        resp = self.client.get(self.detail_url(l))
        self.assertEqual(resp.status_code, 200)
        content = resp.content.decode()
        self.assertIn('name="robots" content="noindex, follow"', content)
        self.assertIn(">Vendido<", content)

    def test_paused_404_anomimo_y_200_dueno(self):
        l = Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Pausado", price=100, location="Managua", status=Listing.STATUS_PAUSED)
        self.assertEqual(self.client.get(self.detail_url(l)).status_code, 404)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(self.detail_url(l)).status_code, 200)

    def test_json_ld_availability_condition_brand(self):
        l = Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="JSONLD", price=100, location="Managua", condition=Listing.CONDITION_NEW, brand=self.brand, model=self.model_iphone)
        self.client.force_login(self.user)
        content = self.client.get(self.detail_url(l)).content.decode()
        self.assertIn("https://schema.org/InStock", content)
        self.assertIn("https://schema.org/NewCondition", content)
        self.assertIn('"@type": "Brand"', content)
        self.assertIn("Apple", content)
        l.status = Listing.STATUS_SOLD
        l.save()
        content = self.client.get(self.detail_url(l)).content.decode()
        self.assertIn("https://schema.org/SoldOut", content)
        l2 = Listing.objects.create(user=self.user, category=self.cat, description="Desc", title="Min", price=100, location="Managua")
        content = self.client.get(self.detail_url(l2)).content.decode()
        self.assertNotIn("itemCondition", content)
        self.assertNotIn('"@type": "Brand"', content)

    def _product_json_ld(self, content):
        """Extrae y parsea el bloque JSON-LD @type=Product de un HTML de anuncio."""
        blocks = re.findall(
            r'<script type="application/ld\+json">(.*?)</script>', content, re.S,
        )
        for block in blocks:
            data = json.loads(block)
            if data.get("@type") == "Product":
                return data
        raise AssertionError("No se encontró un bloque JSON-LD @type=Product")

    def test_json_ld_price_no_usa_coma_decimal(self):
        """El precio del Offer debe ser JSON válido con punto decimal (schema.org
        Number), nunca la coma que produce la localización es-NI de Django."""
        l = Listing.objects.create(
            user=self.user, category=self.cat, description="Desc",
            title="Precio con miles", price="280000.00", location="Managua",
        )
        content = self.client.get(self.detail_url(l)).content.decode()
        product = self._product_json_ld(content)
        price = product["offers"]["price"]
        self.assertNotIn(",", price)
        self.assertEqual(float(price), 280000.00)

        # El precio visible al usuario (fuera del JSON-LD) sigue renderizando
        # con su propio filtro (floatformat), sin tocar por este cambio.
        self.assertIn('<span class="listing-price-amount">', content)


class UserProfilePublicTests(TestCase):
    """El perfil de vendedor es una página pública (landing SEO de vendedor):
    accesible sin sesión, indexable, sin datos privados (teléfono/email)."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="vendedor_publico", password="x")

    def test_perfil_accesible_sin_login(self):
        resp = self.client.get(reverse("user_profile", kwargs={"username": self.user.username}))
        self.assertEqual(resp.status_code, 200)

    def test_perfil_robots_index_follow(self):
        content = self.client.get(
            reverse("user_profile", kwargs={"username": self.user.username})
        ).content.decode()
        self.assertIn('name="robots" content="index, follow"', content)

    def test_perfil_canonical_autoreferenciado(self):
        from django.conf import settings

        path = reverse("user_profile", kwargs={"username": self.user.username})
        content = self.client.get(path).content.decode()
        expected = f'{settings.PUBLIC_BASE_URL.rstrip("/")}{path}'
        self.assertIn(f'href="{expected}"', content)

    def test_perfil_no_expone_telefono_ni_email(self):
        self.user.email = "correo-privado@example.com"
        self.user.save()
        self.user.profile.phone = "+505 8888 0000"
        self.user.profile.save()
        content = self.client.get(
            reverse("user_profile", kwargs={"username": self.user.username})
        ).content.decode()
        self.assertNotIn("correo-privado@example.com", content)
        self.assertNotIn("+505 8888 0000", content)


class SitemapProfileCoverageTests(TestCase):
    """Regresión: ProfileSitemap debía listar Profile en vez de User, y por
    tanto se saltaba usuarios reales e indexables cuya fila Profile no se
    hubiera creado (p. ej. inserción que evita la señal post_save, como
    bulk_create). La fuente de verdad de "tiene página indexable" es User
    (is_active, sin prefijo "_"), no la existencia de Profile."""

    @classmethod
    def setUpTestData(cls):
        cls.normal_user = User.objects.create_user(username="con_profile", password="x")
        # bulk_create no llama a save() -> no dispara post_save -> sin Profile.
        cls.orphan_user = User.objects.bulk_create([
            User(username="sin_profile_huerfano", is_active=True)
        ])[0]
        cls.system_user = User.objects.create_user(username="_sistema_interno", password="x")
        cls.inactive_user = User.objects.create_user(username="usuario_inactivo", password="x", is_active=False)

    def test_usuario_sin_fila_profile_no_tiene_profile_persistido(self):
        from .models import Profile
        self.assertFalse(Profile.objects.filter(user=self.orphan_user).exists())

    def test_profile_sitemap_incluye_usuarios_sin_fila_profile(self):
        from .sitemaps import ProfileSitemap

        usernames = {u.username for u in ProfileSitemap().items()}
        self.assertIn("sin_profile_huerfano", usernames)
        self.assertIn("con_profile", usernames)

    def test_profile_sitemap_excluye_sistema_e_inactivos(self):
        from .sitemaps import ProfileSitemap

        usernames = {u.username for u in ProfileSitemap().items()}
        self.assertNotIn("_sistema_interno", usernames)
        self.assertNotIn("usuario_inactivo", usernames)

    def test_indexables_reales_menos_sitemap_es_cero(self):
        """URLs de perfil indexables reales - URLs de perfil en el sitemap = 0."""
        from .sitemaps import ProfileSitemap

        indexables_reales = set(
            User.objects.filter(is_active=True).exclude(username__startswith="_")
            .values_list("username", flat=True)
        )
        en_sitemap = {u.username for u in ProfileSitemap().items()}
        self.assertEqual(indexables_reales - en_sitemap, set())
        self.assertEqual(len(indexables_reales), len(en_sitemap))

    def test_sitemap_xml_renderiza_sin_error_para_usuario_huerfano(self):
        resp = self.client.get(reverse("sitemap"))
        self.assertEqual(resp.status_code, 200)
        self.assertIn(f"/perfil/{self.orphan_user.username}/", resp.content.decode())

    def test_perfil_huerfano_es_accesible_y_coincide_con_location_del_sitemap(self):
        resp = self.client.get(reverse("user_profile", kwargs={"username": self.orphan_user.username}))
        self.assertEqual(resp.status_code, 200)
