from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from .models import Product, ReviewRating, ProductGallery
from category.models import Category
from carts.models import CartItem
from carts.views import _cart_id
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q
from .forms import ReviewForm
from django.contrib import messages
from orders.models import OrderProduct
from recommendations.engine import RecommendationEngine
from wishlist.models import Wishlist


def store(request, category_slug=None):
    """Render the store page."""
    categories = None
    products = None
    if category_slug is not None:
        categories = get_object_or_404(Category, slug=category_slug)
        products = Product.objects.filter(category=categories, is_available=True)
        paginator = Paginator(products, 6)
        page = request.GET.get('page')
        paged_products = paginator.get_page(page)
        product_count = products.count()
    else:
        products = Product.objects.all().filter(is_available=True).order_by('id')
        paginator = Paginator(products, 6)
        page = request.GET.get('page')
        paged_products = paginator.get_page(page)
        product_count = products.count()

    context = {
        'products': paged_products,
        'product_count': product_count,
    }
    if request.user.is_authenticated:
        wishlist = Wishlist.objects.filter(user=request.user).first()
        context['wishlist_product_ids'] = set(
            wishlist.items.values_list('product_id', flat=True)
        ) if wishlist else set()
    else:
        context['wishlist_product_ids'] = set()
    return render(request, 'store/store.html', context)


def product_detail(request, category_slug, product_slug):
    """Render the product detail page."""
    try:
        single_product = Product.objects.get(
            category__slug=category_slug, slug=product_slug
        )
        in_cart = CartItem.objects.filter(
            cart__cart_id=_cart_id(request), product=single_product
        ).exists()
    except Exception as e:
        raise e

    if request.user.is_authenticated:
        try:
            order_product = OrderProduct.objects.filter(
                user=request.user, product=single_product
            ).exists()
        except OrderProduct.DoesNotExist:
            order_product = None
    else:
        order_product = None

    product_gallery = ProductGallery.objects.filter(product_id=single_product.id)
    reviews = ReviewRating.objects.filter(product_id=single_product.id, status=True)

    recommendation_engine = RecommendationEngine()
    related_products = recommendation_engine.get_related_products(single_product, limit=6)
    frequently_bought_together = recommendation_engine.get_frequently_bought_together(single_product, limit=4)
    fbt_combined_price = sum(item.price for item in frequently_bought_together)

    context = {
        'single_product': single_product,
        'in_cart': in_cart,
        'order_product': order_product,
        'reviews': reviews,
        'product_gallery': product_gallery,
        'related_products': related_products,
        'frequently_bought_together': frequently_bought_together,
        'fbt_combined_price': fbt_combined_price,
    }
    if request.user.is_authenticated:
        wishlist = Wishlist.objects.filter(user=request.user).first()
        context['in_wishlist'] = wishlist.contains_product(single_product) if wishlist else False
    else:
        context['in_wishlist'] = False
    return render(request, 'store/product_detail.html', context)


def search(request):
    """Render the search results page."""
    context = {'products': Product.objects.none(), 'product_count': 0}
    if 'keyword' in request.GET:
        keyword = request.GET['keyword']
        if keyword:
            products = Product.objects.order_by('-created_date').filter(
                Q(description__icontains=keyword) | Q(product_name__icontains=keyword)
            )
            context = {
                'products': products,
                'product_count': products.count(),
            }
    return render(request, 'store/store.html', context)


def submit_review(request, product_id):
    """Submit a review for a product."""
    product = get_object_or_404(Product, id=product_id)

    if request.method == 'POST':
        try:
            reviews = ReviewRating.objects.get(
                user__id=request.user.id, product__id=product_id
            )
            form = ReviewForm(request.POST, instance=reviews)
            form.save()
            messages.success(request, 'Thank you! Your review has been updated.')
            return redirect(
                'product_detail',
                category_slug=product.category.slug,
                product_slug=product.slug,
            )
        except ReviewRating.DoesNotExist:
            form = ReviewForm(request.POST)
            if form.is_valid():
                data = ReviewRating()
                data.subject = form.cleaned_data['subject']
                data.review = form.cleaned_data['review']
                data.rating = form.cleaned_data['rating']
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                if x_forwarded_for:
                    data.ip = x_forwarded_for.split(',')[0]
                else:
                    data.ip = request.META.get('REMOTE_ADDR')
                data.product = product
                data.user = request.user
                data.save()
                messages.success(request, 'Thank you! Your review has been submitted.')
                return redirect(
                    'product_detail',
                    category_slug=product.category.slug,
                    product_slug=product.slug,
                )

    return redirect(
        'product_detail', category_slug=product.category.slug, product_slug=product.slug
    )
