from django.db.models import Q


def normalize_listing_ordering(value: str | None) -> str:
    mapping = {
        "newest": "-created_at",
        "price_asc": "price",
        "price_desc": "-price",
    }
    return mapping.get(value or "", "-created_at")


def apply_listing_search(queryset, query: str | None):
    if not query:
        return queryset

    cleaned = query.strip()
    if not cleaned:
        return queryset

    terms = {cleaned}
    for token in cleaned.split():
        if token:
            terms.add(token)

    search_q = Q()
    for term in terms:
        search_q |= (
            Q(title__icontains=term)
            | Q(description__icontains=term)
            | Q(category__name__icontains=term)
            | Q(category__keywords__icontains=term)
            | Q(subcategory__name__icontains=term)
            | Q(subcategory__keywords__icontains=term)
            | Q(location__icontains=term)
        )

    return queryset.filter(search_q)
