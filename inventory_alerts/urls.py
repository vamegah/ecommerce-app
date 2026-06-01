from django.urls import path

from . import views

app_name = "inventory_alerts"

urlpatterns = [
    path("subscriptions/", views.create_subscription, name="create_subscription"),
    path("subscriptions/<uuid:subscription_id>/", views.remove_subscription, name="remove_subscription"),
    path("subscriptions/unsubscribe/<uuid:token>/", views.unsubscribe_token, name="unsubscribe_token"),
    path("admin/subscriptions/", views.admin_subscriptions, name="admin_subscriptions"),
    path(
        "admin/subscriptions/<uuid:subscription_id>/",
        views.admin_cancel_subscription,
        name="admin_cancel_subscription",
    ),
    path("admin/statistics/", views.admin_statistics, name="admin_statistics"),
    path("admin/health/", views.admin_health, name="admin_health"),
]
