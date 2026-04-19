# IGUALO Mobile API

Base URL: `https://igualo.com/api/v1/`

## Auth

Header:
```http
Authorization: Bearer <access_token>
```

JWT endpoints:
- `POST /auth/register/`
- `POST /auth/login/`
- `POST /auth/refresh/`
- `POST /auth/logout/`

## Público

### GET `/categories/`
Lista de categorías.

### GET `/listings/`
Lista de anuncios activos.

Query params:
- `q`
- `category`
- `location`
- `sort=newest|price_asc|price_desc`

### GET `/search/`
Alias de búsqueda pública.

### GET `/listings/{id}/`
Detalle de anuncio.

### GET `/home/`
Bloques iniciales para la app móvil.

## Autenticado

### GET `/me/`
Perfil del usuario autenticado.

### GET `/me/listings/`
Mis anuncios.

### GET `/me/favorites/`
Mis favoritos.

### POST `/listings/`
Crear anuncio.

Content-Type:
- `application/json`
- `multipart/form-data` para imágenes

### PATCH `/listings/{id}/`
Editar anuncio propio.

### DELETE `/listings/{id}/`
Eliminar o desactivar anuncio propio.

### POST `/listings/{id}/favorite/`
Agregar favorito.

### DELETE `/listings/{id}/favorite/`
Quitar favorito.

## Ejemplo de login

```bash
curl -X POST https://igualo.com/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"login":"usuario","password":"tu-password"}'
```

## Ejemplo de listar anuncios

```bash
curl https://igualo.com/api/v1/listings/
```

## Ejemplo de crear anuncio

```bash
curl -X POST https://igualo.com/api/v1/listings/ \
  -H "Authorization: Bearer <access_token>" \
  -F "title=Samsung A54" \
  -F "description=Teléfono en buen estado" \
  -F "price=12000" \
  -F "category=1" \
  -F "location=Managua" \
  -F "main_image=@/ruta/foto1.jpg"
```

## Ejemplo de favorito

```bash
curl -X POST https://igualo.com/api/v1/listings/15/favorite/ \
  -H "Authorization: Bearer <access_token>"
```

## Errores comunes

- `401` token ausente o inválido
- `403` sin permisos para editar un anuncio ajeno
- `404` anuncio no encontrado o no público
- `400` validación de datos o imágenes
