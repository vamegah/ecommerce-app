from django.urls import path
from . import views

urlpatterns = [
    path('api/products/', views.filter_products, name='filter_products'),
]
