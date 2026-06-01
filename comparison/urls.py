from django.urls import path
from . import views

urlpatterns = [
    path("", views.comparison_page, name="comparison_page"),
    path("shared/<str:share_id>/", views.comparison_page, name="shared_comparison_page"),
    path("api/", views.api_comparison, name="api_comparison"),
    path("api/products/", views.api_products, name="api_products"),
    path("api/shared/", views.api_shared_comparison, name="api_shared_comparison"),
    path("api/shared/<str:share_id>/", views.api_shared_detail, name="api_shared_detail"),
]

app_name = "comparison"
