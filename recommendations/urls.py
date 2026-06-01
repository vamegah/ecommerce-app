from django.urls import path

from . import views

app_name = "recommendations"

urlpatterns = [
    path("track-click/", views.track_recommendation_click, name="track_click"),
    path("analytics/", views.recommendation_analytics, name="analytics"),
]
