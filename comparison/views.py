import json
from uuid import uuid4

from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from store.models import Product

from .models import SavedComparison, SharedComparison


MAX_PRODUCTS = 4


def _iso_now():
    return timezone.now().isoformat().replace("+00:00", "Z")


def _image_url(product):
    try:
        return product.images.url if product.images else "/static/images/items/1.jpg"
    except ValueError:
        return "/static/images/items/1.jpg"


def _attribute(name, value, category, attribute_type):
    return {
        "name": name,
        "value": value,
        "category": category,
        "type": attribute_type,
    }


def product_to_payload(product):
    colors = list(
        product.variation_set.filter(
            variation_category="color",
            is_active=True,
        ).values_list("variation_value", flat=True)
    )
    sizes = list(
        product.variation_set.filter(
            variation_category="size",
            is_active=True,
        ).values_list("variation_value", flat=True)
    )
    rating = product.average_review() or 0
    review_count = product.count_review() or 0
    price = float(product.price)
    available = product.is_available and product.stock > 0
    attributes = [
        _attribute("Price", price, "PRICING", "CURRENCY"),
        _attribute("Rating", float(rating), "GENERAL", "RATING"),
        _attribute("Reviews", int(review_count), "GENERAL", "NUMBER"),
        _attribute("Category", product.category.category_name, "GENERAL", "TEXT"),
        _attribute("Stock", product.stock, "SHIPPING", "NUMBER"),
        _attribute("Available", available, "GENERAL", "BOOLEAN"),
    ]

    if product.description:
        attributes.append(_attribute("Description", product.description, "GENERAL", "TEXT"))
    if colors:
        attributes.append(_attribute("Color", ", ".join(colors), "SPECIFICATIONS", "TEXT"))
    if sizes:
        attributes.append(_attribute("Size", ", ".join(sizes), "SPECIFICATIONS", "TEXT"))

    return {
        "id": str(product.id),
        "name": product.product_name,
        "price": price,
        "imageUrl": _image_url(product),
        "attributes": attributes,
        "available": available,
    }


def _empty_comparison():
    now = _iso_now()
    return {
        "id": str(uuid4()),
        "products": [],
        "createdAt": now,
        "updatedAt": now,
    }


def _comparison_from_product_ids(product_ids, existing=None):
    product_map = {
        str(product.id): product
        for product in Product.objects.filter(id__in=product_ids).select_related("category")
    }
    products = [
        product_to_payload(product_map[str(product_id)])
        for product_id in product_ids
        if str(product_id) in product_map
    ][:MAX_PRODUCTS]
    now = _iso_now()
    return {
        "id": (existing or {}).get("id", str(uuid4())),
        "products": products,
        "createdAt": (existing or {}).get("createdAt", now),
        "updatedAt": now,
    }


def _normalize_comparison_payload(payload):
    comparison = payload.get("comparison") if isinstance(payload, dict) else None
    product_ids = payload.get("productIds") if isinstance(payload, dict) else None

    if product_ids is not None:
        return _comparison_from_product_ids([str(product_id) for product_id in product_ids], comparison)

    if not isinstance(comparison, dict):
        comparison = _empty_comparison()

    products = comparison.get("products") or []
    products = products[:MAX_PRODUCTS]
    product_ids = [str(product.get("id")) for product in products if product.get("id")]
    if product_ids:
        comparison = _comparison_from_product_ids(product_ids, comparison)
    else:
        now = _iso_now()
        comparison = {
            "id": comparison.get("id", str(uuid4())),
            "products": [],
            "createdAt": comparison.get("createdAt", now),
            "updatedAt": now,
        }
    return comparison


def _read_json(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return None


def _ensure_session_key(request):
    if not request.session.session_key:
        request.session.save()
    return request.session.session_key


def _owner_filter(request):
    if request.user.is_authenticated:
        return {"user": request.user}
    return {"session_key": _ensure_session_key(request)}


def _load_saved_comparison(request):
    return SavedComparison.objects.filter(**_owner_filter(request)).first()


def _save_comparison(request, comparison):
    product_ids = [str(product["id"]) for product in comparison["products"]]
    owner = _owner_filter(request)
    saved = SavedComparison.objects.filter(**owner).first()

    if saved is None:
        saved = SavedComparison(**owner)

    saved.product_ids = product_ids
    saved.snapshot = comparison
    saved.save()
    return saved


@require_GET
def comparison_page(request, share_id=None):
    return render(
        request,
        "comparison/comparison.html",
        {
            "share_id": share_id or "",
            "max_comparison_products": MAX_PRODUCTS,
        },
    )


@require_http_methods(["GET", "POST", "DELETE"])
def api_comparison(request):
    if request.method == "GET":
        saved = _load_saved_comparison(request)
        return JsonResponse({"comparison": saved.snapshot if saved else None})

    if request.method == "DELETE":
        saved = _load_saved_comparison(request)
        if saved:
            saved.delete()
        return JsonResponse({"comparison": None})

    payload = _read_json(request)
    if payload is None:
        return JsonResponse({"error": "Malformed comparison JSON.", "code": "PERSISTENCE_FAILED"}, status=400)

    comparison = _normalize_comparison_payload(payload)
    _save_comparison(request, comparison)
    return JsonResponse({"comparison": comparison})


@require_http_methods(["POST"])
def api_products(request):
    payload = _read_json(request)
    if payload is None:
        return JsonResponse({"error": "Malformed product JSON.", "code": "PRODUCT_NOT_FOUND"}, status=400)

    product_ids = [str(product_id) for product_id in payload.get("productIds", [])][:MAX_PRODUCTS]
    comparison = _comparison_from_product_ids(product_ids)
    return JsonResponse({"products": comparison["products"]})


@require_http_methods(["POST"])
def api_shared_comparison(request):
    payload = _read_json(request)
    if payload is None:
        return JsonResponse({"error": "Malformed comparison JSON.", "code": "PERSISTENCE_FAILED"}, status=400)

    comparison = _normalize_comparison_payload(payload)
    shared = SharedComparison.objects.create(comparison_snapshot=comparison)
    share_path = reverse("comparison:shared_comparison_page", kwargs={"share_id": shared.share_id})
    return JsonResponse(
        {
            "shareId": shared.share_id,
            "url": request.build_absolute_uri(share_path),
        },
        status=201,
    )


@require_GET
def api_shared_detail(request, share_id):
    try:
        shared = SharedComparison.objects.get(share_id=share_id)
    except SharedComparison.DoesNotExist:
        return JsonResponse(
            {
                "error": "This shared comparison link is invalid.",
                "code": "INVALID_SHARE_ID",
            },
            status=404,
        )

    if shared.is_expired:
        return JsonResponse(
            {
                "error": "This shared comparison link has expired.",
                "code": "SHARE_EXPIRED",
            },
            status=410,
        )

    return JsonResponse({"comparison": shared.comparison_snapshot})
