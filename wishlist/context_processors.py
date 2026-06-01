from .models import Wishlist


def wishlist_count(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return {"wishlist_count": 0}
    wishlist = Wishlist.objects.filter(user=request.user).first()
    return {"wishlist_count": wishlist.get_items_count() if wishlist else 0}
