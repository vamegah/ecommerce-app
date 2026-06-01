from django.urls import path

from . import views

app_name = "addresses"

urlpatterns = [
    path("api/addresses/", views.address_collection, name="address_collection"),
    path("api/addresses/<uuid:address_id>/", views.address_detail, name="address_detail"),
    path("api/addresses/<uuid:address_id>/default/", views.set_default_address, name="set_default_address"),
    path("api/checkout/addresses/", views.checkout_addresses, name="checkout_addresses"),
]
