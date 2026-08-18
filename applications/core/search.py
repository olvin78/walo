"""Motor de búsqueda de anuncios — Fase 1.

Capa compartida (a futuro) entre Web y App: por ahora NO está conectada a
ningún endpoint ni vista (ver applications/core/views.py::build_search_query
y applications/api/filters.py, que siguen siendo los que se usan en
producción). Este módulo se valida de forma aislada mediante
tests/test_search.py antes de conectarse.

Arquitectura aprobada (P1 — Fase 1):
- Normalización: minúsculas + limpieza de espacios. Sin stemming manual.
- Stop-words en español, conservando siempre números y acrónimos técnicos.
- Sinónimos multi-palabra tratados como grupos OR (ej. "ps5" == "playstation 5").
- Recuperación primaria: AND estricto entre grupos (cada grupo debe cumplirse).
- Campos: título y categoría, con unaccent + icontains en ambos lados.
- Score simple: título > categoría; orden -relevance_score, -created_at, -id.
- Si la búsqueda estricta no da resultados: fallback con TrigramSimilarity
  sobre la consulta completa (título).
- Devuelve siempre un QuerySet, nunca listas Python.
- Radio/ubicación quedan fuera de esta fase.
"""
from __future__ import annotations

import re
import unicodedata

from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Case, CharField, IntegerField, Q, QuerySet, Transform, Value, When

# --- Lookup `__unaccent` reutilizando la extensión `unaccent` de PostgreSQL ---
# (activada en la migración 0059_enable_search_extensions). Se registra una
# sola vez al importar este módulo.


class Unaccent(Transform):
    lookup_name = "unaccent"
    function = "UNACCENT"


CharField.register_lookup(Unaccent)

# Umbral de similitud para el fallback por trigramas. 0.2 es más permisivo que
# el 0.3 por defecto de pg_trgm: a este volumen de catálogo preferimos algo de
# recall extra a perder errores tipográficos leves.
TRIGRAM_FALLBACK_THRESHOLD = 0.2

STOPWORDS = {
    "a", "al", "con", "de", "del", "el", "en", "es", "la", "las", "lo",
    "los", "o", "para", "por", "que", "un", "una", "unas", "unos", "y",
}

# Grupos de sinónimos. Cada grupo es un conjunto de variantes equivalentes
# (palabra suelta o frase de varias palabras) — dentro de un grupo se
# combinan con OR; entre grupos, con AND estricto.
SYNONYM_GROUPS: list[set[str]] = [
    {"ps5", "playstation 5"},
    {"ps4", "playstation 4"},
    {"movil", "celular", "telefono", "smartphone"},
    {"tv", "television", "televisor"},
    {"pc", "computadora", "ordenador"},
]

# Variantes multi-palabra, ordenadas de más larga a más corta para que la
# detección de frases no se coma primero un fragmento más corto por error.
_MULTI_WORD_VARIANTS = sorted(
    (variant for group in SYNONYM_GROUPS for variant in group if " " in variant),
    key=len,
    reverse=True,
)

SEARCH_FIELDS = ["title", "category__name"]


def _normalize(text: str) -> str:
    """minúsculas + espacios colapsados. El acento se resuelve en la
    consulta SQL vía UNACCENT(), no aquí — pero también lo quitamos aquí
    para poder comparar la consulta del usuario contra el diccionario de
    sinónimos/stopwords de forma consistente."""
    text = text.strip().lower()
    text = "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def _is_technical_token(token: str) -> bool:
    """Números y acrónimos técnicos (ej. "15", "ps5", "4k") nunca se tratan
    como stop-word, aunque sean cortos."""
    return any(ch.isdigit() for ch in token)


def _extract_groups(normalized_query: str) -> list[set[str]]:
    """Convierte la consulta ya normalizada en una lista de grupos
    (uno por concepto de búsqueda): frases multi-palabra de sinónimos
    primero, y el resto como palabras sueltas (expandidas por sinónimo si
    aplica)."""
    remaining = f" {normalized_query} "
    groups: list[set[str]] = []

    for variant in _MULTI_WORD_VARIANTS:
        spaced = f" {variant} "
        if spaced in remaining:
            group = next(g for g in SYNONYM_GROUPS if variant in g)
            groups.append(set(group))
            remaining = remaining.replace(spaced, " ", 1)

    for token in remaining.split():
        if not token:
            continue
        if token in STOPWORDS and not _is_technical_token(token):
            continue
        group = next((g for g in SYNONYM_GROUPS if token in g), {token})
        groups.append(set(group))

    return groups


def _group_q(group: set[str], fields: list[str]) -> Q:
    q = Q()
    for term in group:
        for field in fields:
            q |= Q(**{f"{field}__unaccent__icontains": term})
    return q


def _strict_q(groups: list[set[str]], fields: list[str]) -> Q | None:
    """AND estricto entre grupos. None si no hay grupos (consulta vacía o
    solo stop-words)."""
    if not groups:
        return None
    q = _group_q(groups[0], fields)
    for group in groups[1:]:
        q &= _group_q(group, fields)
    return q


def search_listings_with_metadata(queryset: QuerySet, query: str | None) -> tuple[QuerySet, bool]:
    """Punto de entrada único del motor de búsqueda. Devuelve siempre un
    QuerySet (perezoso, nunca una lista de Python), ordenado por relevancia,
    junto con un booleano que indica si los resultados son coincidencias
    estrictas (True) o provienen del fallback por trigramas (False).

    - exact_matches=True  -> la consulta se resolvió con AND estricto.
    - exact_matches=False -> resultados del fallback (typos/variantes) o
      ausencia de resultados.
    """
    if not query or not query.strip():
        return queryset, True

    normalized = _normalize(query)
    groups = _extract_groups(normalized)
    strict_q = _strict_q(groups, SEARCH_FIELDS)

    if strict_q is not None:
        strict_results = queryset.filter(strict_q).distinct()
        title_q = _strict_q(groups, ["title"])
        category_q = _strict_q(groups, ["category__name"])
        strict_results = strict_results.annotate(
            relevance_score=Case(
                When(title_q, then=Value(2)),
                When(category_q, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ).order_by("-relevance_score", "-created_at", "-id")

        if strict_results.exists():
            return strict_results, True

    # Fallback: nada coincidió de forma estricta (o la consulta era solo
    # stop-words) -> similitud por trigramas sobre la consulta completa.
    return (
        queryset.annotate(similarity=TrigramSimilarity("title", normalized))
        .filter(similarity__gt=TRIGRAM_FALLBACK_THRESHOLD)
        .order_by("-similarity", "-created_at", "-id"),
        False,
    )


def search_listings(queryset: QuerySet, query: str | None) -> QuerySet:
    """API pública de compatibilidad (Web y tests): devuelve solo el
    queryset ya ordenado por relevancia."""
    return search_listings_with_metadata(queryset, query)[0]
