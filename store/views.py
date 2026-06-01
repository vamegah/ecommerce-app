from django.shortcuts import (
    render,
    redirect,
    get_object_or_404,
)  # Import the render and redirect functions to render templates and redirect to URLs
from django.http import JsonResponse
import json
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from .models import (
    Product,
    ReviewRating,
    ProductGallery,
    Subscription,
    Notification,
)  # Import the Product and Variation models to access product data
from category.models import Category
from carts.models import CartItem
from carts.views import (
    _cart_id,
)  # Import the _cart_id function to get the cart ID from the request
from django.core.paginator import (
    Paginator,
    EmptyPage,
    PageNotAnInteger,
)  # Import Paginator and exceptions for pagination
from django.db.models import Q
from .forms import ReviewForm  # Import the ReviewForm to handle review submissions
from django.contrib import (
    messages,
)  # Import the messages module to display messages to the user
from orders.models import (
    OrderProduct,
)  # Import the OrderProduct model to check if a product is in an order
from recommendations.engine import RecommendationEngine
from wishlist.models import Wishlist

# This code defines the views for the store application. It includes functions to render the store page, product detail page, search results, and submit reviews.

# Create your store views here.


def store(request, category_slug=None):
    """Render the store page."""
    # This function handles the request to display the store page of the application.
    categories = None  # Initialize the categories variable to None
    products = None  # Initialize the products variable to None
    if category_slug != None:
        categories = get_object_or_404(
            Category, slug=category_slug
        )  # Retrieve the category object based on the slug
        products = Product.objects.filter(
            category=categories, is_available=True
        )  # Retrieve products belonging to the category
        paginator = Paginator(
            products, 6
        )  # Create a paginator object with 6 products per page
        page = request.GET.get("page")  # Get the current page number from the request
        paged_products = paginator.get_page(
            page
        )  # Get the products for the current page
        product_count = products.count()  # Count the number of products

    else:
        products = (
            Product.objects.all().filter(is_available=True).order_by("id")
        )  # Retrieve all products from the database
        paginator = Paginator(
            products, 6
        )  # Create a paginator object with 6 products per page
        page = request.GET.get("page")  # Get the current page number from the request
        paged_products = paginator.get_page(
            page
        )  # Get the products for the current page
        product_count = products.count()  # Count the number of products

    context = {
        "products": paged_products,  # Add the products to the context dictionary
        "product_count": product_count,  # Add the product count to the context dictionary
    }
    if request.user.is_authenticated:
        wishlist = Wishlist.objects.filter(user=request.user).first()
        context["wishlist_product_ids"] = set(
            wishlist.items.values_list("product_id", flat=True)
        ) if wishlist else set()
    else:
        context["wishlist_product_ids"] = set()
    return render(
        request, "store/store.html", context
    )  # Render the store.html template with the context


def product_detail(request, category_slug, product_slug):
    """Render the product detail page."""
    try:
        single_product = Product.objects.get(
            category__slug=category_slug, slug=product_slug
        )  # Retrieve the product based on category and product slugs
        in_cart = CartItem.objects.filter(
            cart__cart_id=_cart_id(request), product=single_product
        ).exists()  # Check if the product is in the cart

    except Exception as e:
        raise e  # Raise the exception if an error occurs

    if request.user.is_authenticated:

        try:
            order_product = OrderProduct.objects.filter(
                user=request.user, product=single_product
            ).exists()  # Check if the product is in the order
        except OrderProduct.DoesNotExist:
            order_product = (
                None  # Set order_product to None if the product is not in the order
            )
    else:
        order_product = (
            None  # Set order_product to None if the user is not authenticated
        )

    # Get the product gallery images
    product_gallery = ProductGallery.objects.filter(
        product_id=single_product.id
    )  # Get the product gallery images for the product

    reviews = ReviewRating.objects.filter(
        product_id=single_product.id, status=True
    )  # Get the reviews for the product

    recommendation_engine = RecommendationEngine()
    related_products = recommendation_engine.get_related_products(single_product, limit=6)
    frequently_bought_together = recommendation_engine.get_frequently_bought_together(single_product, limit=4)
    fbt_combined_price = sum(item.price for item in frequently_bought_together)

    context = {
        "single_product": single_product,  # Add the single product to the context dictionary
        "in_cart": in_cart,  # Add the in_cart flag to the context dictionary
        "order_product": order_product,  # Add the order_product flag to the context dictionary
        "reviews": reviews,  # Add the reviews to the context dictionary
        "product_gallery": product_gallery,  # Add the product gallery images to the context dictionary
        "related_products": related_products,
        "frequently_bought_together": frequently_bought_together,
        "fbt_combined_price": fbt_combined_price,
    }
    if request.user.is_authenticated:
        wishlist = Wishlist.objects.filter(user=request.user).first()
        context["in_wishlist"] = wishlist.contains_product(single_product) if wishlist else False
    else:
        context["in_wishlist"] = False
    return render(
        request, "store/product_detail.html", context
    )  # Render the product_detail.html template with the context


def search(request):
    """Render the search results page."""
    # This function handles the request to display the search results based on the user's query.
    if "keyword" in request.GET:
        keyword = request.GET["keyword"]  # Get the search keyword from the request
        if keyword:
            products = Product.objects.order_by("-created_date").filter(
                Q(description__icontains=keyword) | Q(product_name__icontains=keyword)
            )  # Search for products based on the keyword
            product_count = products.count()  # Count the number of products found
            context = {
                "products": products,  # Add the products to the context dictionary
                "product_count": product_count,  # Add the product count to the context dictionary
            }
    return render(
        request, "store/store.html", context
    )  # Render the store.html template with the context


def submit_review(request, product_id):
    """Submit a review for a product."""
    # This function handles the request to submit a review for a product.

    # Fetch product first to ensure we can redirect back to it safely
    product = get_object_or_404(Product, id=product_id)

    if request.method == "POST":
        try:
            reviews = ReviewRating.objects.get(
                user__id=request.user.id, product__id=product_id
            )  # Check if the user has already submitted a review
            form = ReviewForm(
                request.POST, instance=reviews
            )  # Create a form instance with the existing review
            form.save()  # Save the form data
            messages.success(
                request, "Thank you! Your review has been updated."
            )  # Display a success message
            return redirect(
                "product_detail",
                category_slug=product.category.slug,
                product_slug=product.slug,
            )
        except ReviewRating.DoesNotExist:
            form = ReviewForm(request.POST)  # Create a new form instance
            if form.is_valid():
                data = ReviewRating()  # Create a new ReviewRating object
                data.subject = form.cleaned_data[
                    "subject"
                ]  # Get the subject from the form data
                data.review = form.cleaned_data[
                    "review"
                ]  # Get the review from the form data
                data.rating = form.cleaned_data[
                    "rating"
                ]  # Get the rating from the form data

                # Get real IP if behind proxy
                x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
                if x_forwarded_for:
                    data.ip = x_forwarded_for.split(",")[0]
                else:
                    data.ip = request.META.get("REMOTE_ADDR")

                data.product = product  # Set the product for the review
                data.user = request.user  # Set the user for the review
                data.save()  # Save the review data
                messages.success(request, "Thank you! Your review has been submitted.")
                return redirect(
                    "product_detail",
                    category_slug=product.category.slug,
                    product_slug=product.slug,
                )

    return redirect(
        "product_detail", category_slug=product.category.slug, product_slug=product.slug
    )


# --- Inventory Alerts API Endpoints ---


def create_subscription(request):
    """API endpoint to create a new subscription."""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            product_id = data.get("productId")
            email = data.get("email")

            if not product_id or not email:
                return JsonResponse(
                    {"error": "Product ID and Email are required"}, status=400
                )

            product = get_object_or_404(Product, id=product_id)
            user = request.user if request.user.is_authenticated else None

            # Check for duplicate active subscription
            if Subscription.objects.filter(
                product=product, email=email, status="active"
            ).exists():
                return JsonResponse(
                    {"error": "Subscription already exists"}, status=409
                )

            subscription = Subscription.objects.create(
                user=user, product=product, email=email, status="active"
            )

            return JsonResponse(
                {
                    "message": "Subscription created successfully",
                    "subscriptionId": str(subscription.id),
                },
                status=201,
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)


def delete_subscription(request, subscription_id):
    """API endpoint to remove a subscription."""
    if request.method == "DELETE":
        try:
            subscription = get_object_or_404(Subscription, id=subscription_id)

            # Security check: ensure user owns subscription or is admin
            if request.user.is_authenticated:
                if (
                    not request.user.is_superuser
                    and subscription.user
                    and subscription.user != request.user
                ):
                    return JsonResponse({"error": "Unauthorized"}, status=403)
            else:
                # Require authentication for the management endpoint
                return JsonResponse({"error": "Unauthorized"}, status=401)

            subscription.delete()
            return JsonResponse(
                {"message": "Subscription removed successfully"}, status=200
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def unsubscribe_public(request, subscription_id):
    """API endpoint to unsubscribe via email link (public)."""
    if request.method == "POST":
        try:
            subscription = get_object_or_404(Subscription, id=subscription_id)
            subscription.delete()
            return JsonResponse({"message": "Unsubscribed successfully"}, status=200)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)


def get_user_subscriptions(request, user_id):
    """API endpoint to get subscriptions for a user."""
    if request.method == "GET":
        if not request.user.is_authenticated or str(request.user.id) != str(user_id):
            return JsonResponse({"error": "Unauthorized"}, status=403)

        subscriptions = Subscription.objects.filter(user__id=user_id)
        data = []
        for sub in subscriptions:
            data.append(
                {
                    "id": str(sub.id),
                    "productId": sub.product.id,
                    "productName": sub.product.product_name,
                    "email": sub.email,
                    "status": sub.status,
                    "createdAt": sub.created_at,
                }
            )
        return JsonResponse({"subscriptions": data}, status=200)
    return JsonResponse({"error": "Method not allowed"}, status=405)


# --- Admin API Endpoints ---


def admin_subscriptions(request):
    """Admin API to list and filter subscriptions."""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    if request.method == "GET":
        status = request.GET.get("status")
        email = request.GET.get("email")
        product_id = request.GET.get("productId")

        queryset = Subscription.objects.all()
        if status:
            queryset = queryset.filter(status=status)
        if email:
            queryset = queryset.filter(email__icontains=email)
        if product_id:
            queryset = queryset.filter(product__id=product_id)

        data = list(
            queryset.values(
                "id", "email", "status", "created_at", "product__product_name"
            )
        )
        return JsonResponse(
            {"subscriptions": data, "count": queryset.count()}, status=200
        )

    return JsonResponse({"error": "Method not allowed"}, status=405)


def admin_statistics(request):
    """Admin API to get notification statistics."""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    if request.method == "GET":
        total_sent = Notification.objects.filter(status="sent").count()
        total_failed = Notification.objects.filter(status="failed").count()
        total_pending = Notification.objects.filter(status="pending").count()

        stats = {
            "totalSent": total_sent,
            "totalFailed": total_failed,
            "totalPending": total_pending,
            "successRate": (
                (total_sent / (total_sent + total_failed + total_pending) * 100)
                if (total_sent + total_failed + total_pending) > 0
                else 0
            ),
        }
        return JsonResponse(stats, status=200)
    return JsonResponse({"error": "Method not allowed"}, status=405)


def admin_health(request):
    """Admin API to check system health."""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    if request.method == "GET":
        db_status = False
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            db_status = True
        except Exception:
            db_status = False

        return JsonResponse(
            {
                "databaseConnected": db_status,
                "status": "healthy" if db_status else "unhealthy",
            },
            status=200,
        )
    return JsonResponse({"error": "Method not allowed"}, status=405)
