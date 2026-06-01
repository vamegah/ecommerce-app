from django.db.models import Avg, Q
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from store.models import Product


def _parse_non_negative_number(value):
    if value in (None, ""):
        return None

    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None

    return parsed if parsed >= 0 else None


def _parse_rating(value):
    parsed = _parse_non_negative_number(value)
    if parsed is None:
        return None

    return parsed if 1 <= parsed <= 5 else None


def _parse_availability(request):
    availability = request.GET.get("availability")
    if availability:
        values = {item.strip() for item in availability.split(",") if item.strip()}
        return "inStock" in values, "outOfStock" in values

    return (
        request.GET.get("in_stock") in ("1", "true"),
        request.GET.get("out_of_stock") in ("1", "true"),
    )


@require_http_methods(["GET"])
def filter_products(request):
    products = Product.objects.filter(is_available=True).annotate(
        rating=Avg("reviewrating__rating", filter=Q(reviewrating__status=True))
    )

    price_min = _parse_non_negative_number(
        request.GET.get("minPrice", request.GET.get("price_min"))
    )
    price_max = _parse_non_negative_number(
        request.GET.get("maxPrice", request.GET.get("price_max"))
    )

    if price_min is not None and price_max is not None and price_min > price_max:
        price_min = None
        price_max = None

    if price_min is not None:
        products = products.filter(price__gte=price_min)

    if price_max is not None:
        products = products.filter(price__lte=price_max)

    rating = _parse_rating(request.GET.get("minRating", request.GET.get("rating")))
    if rating is not None:
        products = products.filter(rating__isnull=False, rating__gte=rating)

    in_stock, out_of_stock = _parse_availability(request)
    if in_stock and not out_of_stock:
        products = products.filter(stock__gt=0)
    elif out_of_stock and not in_stock:
        products = products.filter(stock=0)

    products_data = [
        {
            "id": product.id,
            "name": product.product_name,
            "price": float(product.price),
            "rating": float(product.rating) if product.rating is not None else None,
            "inventoryCount": product.stock,
            "stock": product.stock,
            "category": product.category.category_name if product.category else "",
            "image": product.images.url if product.images else "",
        }
        for product in products
    ]

    return JsonResponse({
        "products": products_data,
        "count": len(products_data),
    })
