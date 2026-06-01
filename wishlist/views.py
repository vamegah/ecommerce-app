from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_GET, require_POST

from store.models import Product

from .models import Wishlist, WishlistItem


def _auth_json_required(request):
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "message": "Authentication required."}, status=401)
    return None


def _wishlist_count_for(user):
    wishlist = Wishlist.objects.filter(user=user).first()
    return wishlist.get_items_count() if wishlist else 0


@login_required(login_url="login")
def wishlist(request):
    user_wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
    wishlist_items = user_wishlist.items.select_related("product").all()
    return render(
        request,
        "wishlist/wishlist.html",
        {
            "wishlist_items": wishlist_items,
            "wishlist_count": user_wishlist.get_items_count(),
        },
    )


@require_POST
def add_to_wishlist(request, product_id):
    auth_error = _auth_json_required(request)
    if auth_error:
        return auth_error
    product = get_object_or_404(Product, id=product_id)
    user_wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
    item, created = WishlistItem.objects.get_or_create(
        wishlist=user_wishlist,
        product=product,
    )
    return JsonResponse(
        {
            "success": True,
            "in_wishlist": True,
            "message": "Added to wishlist." if created else "Product already in wishlist.",
            "wishlist_count": user_wishlist.get_items_count(),
        }
    )


@require_POST
def remove_from_wishlist(request, product_id):
    auth_error = _auth_json_required(request)
    if auth_error:
        return auth_error
    product = get_object_or_404(Product, id=product_id)
    user_wishlist = Wishlist.objects.filter(user=request.user).first()
    if not user_wishlist:
        return JsonResponse({"success": True, "in_wishlist": False, "message": "Item removed.", "wishlist_count": 0})
    WishlistItem.objects.filter(wishlist=user_wishlist, product=product).delete()
    return JsonResponse(
        {
            "success": True,
            "in_wishlist": False,
            "message": "Removed from wishlist.",
            "wishlist_count": user_wishlist.get_items_count(),
        }
    )


@require_GET
def check_wishlist_status(request, product_id):
    if not request.user.is_authenticated:
        return JsonResponse({"in_wishlist": False, "wishlist_count": 0})
    product = get_object_or_404(Product, id=product_id)
    user_wishlist = Wishlist.objects.filter(user=request.user).first()
    if not user_wishlist:
        return JsonResponse({"in_wishlist": False, "wishlist_count": 0})
    return JsonResponse(
        {
            "in_wishlist": user_wishlist.contains_product(product),
            "wishlist_count": user_wishlist.get_items_count(),
        }
    )
