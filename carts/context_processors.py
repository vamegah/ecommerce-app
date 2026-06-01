from .models import Cart, CartItem
from .views import _cart_id  # Import the _cart_id function to get the cart ID from the request


def counter(request):
    """Count the number of items in the cart."""
    if 'admin' in request.path:
        return {}  # Return an empty dictionary for admin paths
    else:
        try:
            cart = Cart.objects.filter(cart_id=_cart_id(request))  # Retrieve the cart object based on the cart ID
            if request.user.is_authenticated:
                cart_items = CartItem.objects.all().filter(user=request.user)  # Get all cart items for the authenticated user
            else:
                cart_items = CartItem.objects.all().filter(cart=cart[:1])  # Get all cart items for the first cart object
            
            cart_item_count = 0  # Initialize the cart item count
            for cart_item in cart_items:
                cart_item_count += cart_item.quantity  # Add the quantity of each cart item to the count
        except Cart.DoesNotExist:
            cart_item_count = 0  # Set count to 0 if no cart exists

    return dict(cart_item_count=cart_item_count)  # Return the count as a dictionary for use in templates