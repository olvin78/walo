"""Filtros y ordenación de la API de anuncios (P1 — Fase 3).

La búsqueda textual ya no se implementa aquí: la API delega en el motor
único de búsqueda compartido con la Web (applications/core/search.py).
Este módulo solo conserva la normalización de la ordenación y el pegamento
que la view necesita para mantener su contrato (queryset + exact_matches).
"""

from applications.core.search import search_listings_with_metadata


def normalize_listing_ordering(value: str | None) -> str:
    mapping = {
        "newest": "-created_at",
        "price_asc": "price",
        "price_desc": "-price",
    }
    return mapping.get(value or "", "-created_at")


def search_listing_queryset(queryset, query: str | None):
    """Conecta la API al motor único de búsqueda.

    Devuelve siempre (queryset, exact_matches):
    - Sin query: queryset sin filtrar y exact_matches=True (comportamiento
      previo de la API intacto).
    - Con query: el queryset del motor (perezoso, ordenado por relevancia)
      y exact_matches=False si los resultados vienen del fallback por
      trigramas.
    """
    return search_listings_with_metadata(queryset, query)


def apply_listing_search(queryset, query: str | None):
    return search_listing_queryset(queryset, query)[0]