from django.contrib import admin
from django.urls import path, include, re_path
import greatkart.views as views
from django.conf.urls.static import static
from django.conf import settings
import importlib


urlpatterns = [
    re_path(r'^secret/', admin.site.urls),
    path('', views.home, name='home'),
    path('healthz/', views.healthz, name='healthz'),
    path('metrics/', views.metrics, name='metrics'),
    path('store/', include('store.urls')),
    path('cart/', include('carts.urls')),
    path('accounts/', include('accounts.urls')),
    path('orders/', include('orders.urls')),
    path('coupons/', include('coupons.urls')),
    path('wishlist/', include('wishlist.urls')),
    path('recommendations/', include('recommendations.urls')),
    path('filters/', include('filters.urls')),
    path('inventory-alerts/', include('inventory_alerts.urls')),
    path('comparison/', include('comparison.urls')),
    path('', include('addresses.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

try:
    importlib.import_module('admin_honeypot.urls')
except ModuleNotFoundError:
    pass
else:
    urlpatterns.insert(0, re_path(r'admin/', include('admin_honeypot.urls', namespace='admin_honeypot')))
