from django.urls import path
from . import views

urlpatterns = [
    path('apply/', views.apply_coupon, name='apply_coupon_legacy'),
    path('remove/', views.remove_coupon, name='remove_coupon_legacy'),
]
