import re
import unicodedata

from django.db.models import Q


def normalize_listing_ordering(value: str | None) -> str:
    mapping = {
        "newest": "-created_at",
        "price_asc": "price",
        "price_desc": "-price",
    }
    return mapping.get(value or "", "-created_at")


def normalize_search_text(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip().lower()
    return "".join(
        ch for ch in unicodedata.normalize("NFD", value)
        if unicodedata.category(ch) != "Mn"
    )


def levenshtein_distance(left: str, right: str, max_distance: int = 2) -> int:
    if abs(len(left) - len(right)) > max_distance:
        return max_distance + 1
    if len(left) > len(right):
        left, right = right, left

    previous = list(range(len(left) + 1))
    for right_index, right_char in enumerate(right, 1):
        current = [right_index]
        row_min = current[0]
        for left_index, left_char in enumerate(left, 1):
            insert_cost = current[left_index - 1] + 1
            delete_cost = previous[left_index] + 1
            replace_cost = previous[left_index - 1] + (left_char != right_char)
            value = min(insert_cost, delete_cost, replace_cost)
            current.append(value)
            row_min = min(row_min, value)
        if row_min > max_distance:
            return max_distance + 1
        previous = current
    return previous[-1]


def expand_search_terms(query: str) -> set[str]:
    synonyms = {
        "movil": ["telefono", "celular", "smartphone"],
        "telefono": ["movil", "celular", "smartphone"],
        "celular": ["movil", "telefono", "smartphone"],
        "coche": ["carro", "auto", "vehiculo"],
        "carro": ["coche", "auto", "vehiculo"],
        "auto": ["coche", "carro", "vehiculo"],
        "ropa": ["moda", "camisa", "pantalon"],
        "camisa": ["ropa", "moda"],
        "pantalon": ["ropa", "moda"],
        "tablet": ["tecnologia", "computadora"],
        "pc": ["tecnologia", "computadora", "laptop"],
        "computadora": ["tecnologia", "pc", "laptop"],
        "laptop": ["tecnologia", "computadora", "pc"],
        "juego": ["videojuegos", "consola", "gamer"],
        "consola": ["videojuegos", "juego", "gamer"],
        "casa": ["inmuebles", "apartamento", "terreno"],
        "pelota": ["deporte", "deportes", "futbol"],
        "balon": ["deporte", "deportes", "futbol"],
        "mueble": ["hogar", "decoracion", "sofa", "cama"],
        "bomba": ["motor", "electro", "herramienta"],
    }
    normalized = normalize_search_text(query)
    terms = {normalized} if normalized else set()
    vocabulary = set(synonyms.keys())
    for values in synonyms.values():
        vocabulary.update(values)

    for token in re.split(r"\s+", normalized):
        if not token:
            continue
        terms.add(token)
        terms.update(synonyms.get(token, []))
        if len(token) >= 4:
            for word in vocabulary:
                max_distance = 1 if len(token) <= 4 else 2
                if levenshtein_distance(token, word, max_distance=max_distance) <= max_distance:
                    terms.add(word)
                    terms.update(synonyms.get(word, []))
    return {term for term in terms if term}


def build_listing_search_q(terms: set[str]) -> Q:
    search_q = Q()
    for term in terms:
        search_q |= (
            Q(title__icontains=term)
            | Q(description__icontains=term)
            | Q(category__name__icontains=term)
            | Q(category__keywords__icontains=term)
            | Q(subcategory__name__icontains=term)
            | Q(subcategory__description__icontains=term)
            | Q(subcategory__keywords__icontains=term)
            | Q(location__icontains=term)
        )
    return search_q


def listing_matches_fuzzy(listing, query_terms: set[str]) -> bool:
    if not query_terms:
        return False
    haystack = " ".join(
        str(value or "")
        for value in (
            listing.title,
            listing.description,
            listing.location,
            getattr(listing.category, "name", ""),
            getattr(listing.category, "keywords", ""),
            getattr(listing.subcategory, "name", "") if listing.subcategory else "",
            getattr(listing.subcategory, "keywords", "") if listing.subcategory else "",
        )
    )
    normalized_haystack = normalize_search_text(haystack)
    words = {word for word in re.split(r"[^a-z0-9]+", normalized_haystack) if len(word) >= 3}
    for term in query_terms:
        if len(term) < 3:
            continue
        if term in normalized_haystack:
            return True
        max_distance = 1 if len(term) <= 4 else 2
        if any(levenshtein_distance(term, word, max_distance=max_distance) <= max_distance for word in words):
            return True
    return False


def search_listing_queryset(queryset, query: str | None, fuzzy_limit: int = 60):
    if not query or not query.strip():
        return queryset, True

    normalized = normalize_search_text(query)
    original_terms = {normalized, *[token for token in re.split(r"\s+", normalized) if token]}
    if not original_terms:
        return queryset, True

    exact_queryset = queryset.filter(build_listing_search_q(original_terms)).distinct()
    if exact_queryset.exists():
        return exact_queryset, True

    terms = expand_search_terms(query)
    expanded_queryset = queryset.filter(build_listing_search_q(terms)).distinct()
    if expanded_queryset.exists():
        return expanded_queryset, False

    candidates = queryset.select_related("category", "subcategory").order_by("-created_at")[:fuzzy_limit]
    matched_ids = [listing.id for listing in candidates if listing_matches_fuzzy(listing, terms)]
    if matched_ids:
        return queryset.filter(id__in=matched_ids), False

    return queryset.none(), False


def apply_listing_search(queryset, query: str | None):
    return search_listing_queryset(queryset, query)[0]
