from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from store.models import Product, ReviewRating
from recommendations.engine import RecommendationEngine
try:
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
except Exception:  # pragma: no cover
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4"
    generate_latest = None

# Create your views here.
def home(request):
    products = Product.objects.all().filter(is_available=True)  # Fetch only available products
    recommendation_engine = RecommendationEngine()
    homepage_recommendations = recommendation_engine.get_personalized_recommendations(
        request.user, limit=8
    )
    for product in products:
        reviews = ReviewRating.objects.filter(product_id=product.id, status=True)  # Fetch reviews for the product
    context = {
        'products': products,
        'reviews': reviews,
        'homepage_recommendations': homepage_recommendations,
        'recommendation_heading': 'Recommended For You' if request.user.is_authenticated else 'Popular Picks',
        } # Pass products to the template
    return render(request, 'home.html', context) # Render the home.html template with the context


def healthz(request):
    return JsonResponse({"status": "ok"})


def metrics(request):
    if generate_latest is None:
        return JsonResponse({"detail": "prometheus client unavailable"}, status=503)
    return HttpResponse(generate_latest(), content_type=CONTENT_TYPE_LATEST)

