# IGUALO Mobile API Plan

## 1. Modelos de anuncios

El modelo principal de anuncios es `Listing` en `applications.core.models`.

Campos relevantes:
- `title`
- `description`
- `price`
- `location`
- `category`
- `subcategory`
- `image` (imagen principal)
- `images` vía `ListingImage` (imágenes extra)
- `user` (propietario)
- `favorites` (relación M2M con usuarios)
- `is_active`
- `created_at`
- `latitude` y `longitude`
- `payment_methods`

## 2. Modelos de categorías

- `Category` es la categoría principal.
- `Subcategory` existe como nivel secundario ligado a `Category`.

`Category` incluye `name`, `slug`, `icon`, `description`, `keywords`, `order` e `image`.

## 3. Imagen de anuncios

- `Listing.image` representa la imagen principal.
- `ListingImage` representa imágenes adicionales.
- El proyecto ya genera variantes `thumb`, `medium` y `large` en WebP.

## 4. Usuario y perfil

- El usuario técnico es `django.contrib.auth.models.User`.
- El perfil público está en `Profile` con avatar, cover, phone, bio, location e `is_verified`.
- El perfil se crea automáticamente por señal al crear un usuario.
- La web sigue usando sesión/allauth.
- La app móvil usará JWT sobre DRF.

## 5. Endpoints web existentes

Rutas web relevantes ya existentes:
- `/` inicio
- `/explorar/` búsqueda y listado
- `/categoria/<slug>/` detalle de categoría
- `/anuncio/<id>-<slug>/` detalle de anuncio
- `/publicar/` crear anuncio
- `/anuncio/<id>/editar/` editar anuncio
- `/favoritos/` favoritos
- `/perfil/<username>/` perfil público
- `/mensajes/` inbox

## 6. Librerías API

Antes de esta preparación no había DRF configurado.

Se añadió:
- `djangorestframework`
- `djangorestframework-simplejwt`
- `django-cors-headers`

## 7. Nombres internos vs marca pública

Internamente siguen existiendo nombres técnicos como:
- `applications.core`
- `config`
- modelos `Listing`, `Category`, `Subcategory`, `Profile`

De cara a documentación, payloads, ejemplos y dominio público se usa:
- marca: `IGUALO`
- dominio: `https://igualo.com`
