from django.urls import path
from . import views

urlpatterns = [
    path("", views.wishlist, name="wishlist"),
    path("add/<int:product_id>/", views.add_to_wishlist, name="add_to_wishlist"),
    path("remove/<int:product_id>/", views.remove_from_wishlist, name="remove_from_wishlist"),
    path("check/<int:product_id>/", views.check_wishlist_status, name="check_wishlist_status"),
]
