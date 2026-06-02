from django.urls import path

from . import views


app_name = "admin_honeypot"

urlpatterns = [
    path("", views.honeypot_login, name="login"),
]
