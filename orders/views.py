from django.shortcuts import render, redirect
from carts.models import CartItem
from .forms import OrderForm
from .models import Order, OrderProduct, Payment
import datetime
import logging
from django.http import JsonResponse
import json
from decimal import Decimal
from store.models import Product
from django.template.loader import render_to_string
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import F
try:
    from celery import shared_task
except ImportError:
    def shared_task(func):
        return func

logger = logging.getLogger(__name__)


def payments(request):
    body = json.loads(request.body)
    order = Order.objects.get(user=request.user, is_ordered=False, order_number=body['orderID'])

    with transaction.atomic():
        payment = Payment.objects.create(
            user=request.user,
            payment_id=body['transID'],
            payment_method=body['payment_method'],
            amount_paid=order.order_total,
            status=body['status'],
        )

        Order.objects.filter(id=order.id).update(
            payment=payment,
            is_ordered=True,
        )

        # Create OrderProduct records, decrement stock, and clear the cart
        cart_items = CartItem.objects.filter(user=request.user).select_related('product')
        for item in cart_items:
            order_product = OrderProduct.objects.create(
                order=order,
                payment=payment,
                user=request.user,
                product=item.product,
                quantity=item.quantity,
                product_price=item.product.price,
                ordered=True,
            )
            order_product.variations.set(item.variations.all())
            Product.objects.filter(id=item.product_id).update(
                stock=F('stock') - item.quantity
            )
        cart_items.delete()

        # Record coupon redemption after the order is marked paid
        if order.coupon_code:
            from coupons.models import Coupon
            from coupons.tracker import RedemptionTracker
            try:
                coupon = Coupon.objects.get(code=order.coupon_code)
                RedemptionTracker.record_redemption(
                    coupon,
                    order,
                    request.user,
                    Decimal(str(order.discount_amount or 0)),
                )
            except Coupon.DoesNotExist:
                pass

        # Clear coupon from session
        from coupons.services import CouponSessionService
        CouponSessionService(request).clear_coupon()

    # Send order confirmation email asynchronously
    email_kwargs = {
        'subject': 'Thank you for your order!',
        'template': 'orders/order_recieved_email.html',
        'context': {
            'user': {
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'email': request.user.email,
            },
            'order': {
                'order_number': order.order_number,
                'first_name': order.first_name,
                'last_name': order.last_name,
                'phone': order.phone,
                'email': order.email,
                'address_line_1': order.address_line_1,
                'address_line_2': order.address_line_2,
                'city': order.city,
                'state': order.state,
                'country': order.country,
                'order_total': float(order.order_total),
                'tax': float(order.tax),
                'status': order.status,
            }
        },
        'recipient': request.user.email,
    }
    if hasattr(send_order_email, 'delay'):
        send_order_email.delay(**email_kwargs)
    else:
        send_order_email(**email_kwargs)

    return JsonResponse({
        'order_number': order.order_number,
        'transID': payment.payment_id,
    })


@shared_task
def send_order_email(subject, template, context, recipient):
    message = render_to_string(template, context)
    email = EmailMessage(subject, message, to=[recipient])
    return email.send()


def place_order(request, total=0, quantity=0):
    current_user = request.user

    cart_items = CartItem.objects.filter(user=current_user)
    if cart_items.count() <= 0:
        return redirect('store')

    discount_amount = Decimal('0.00')
    coupon_code = None

    for cart_item in cart_items:
        total += (cart_item.product.price * cart_item.quantity)
        quantity += cart_item.quantity

    from coupons.services import CouponSessionService

    coupon_service = CouponSessionService(request)
    applied_coupon, calculated_discount, coupon_error = coupon_service.get_applied_coupon(Decimal(str(total)))
    if coupon_error:
        from django.contrib import messages
        messages.warning(request, coupon_error)
    elif applied_coupon:
        coupon_code = applied_coupon.code
        discount_amount = calculated_discount

    discounted_total = max(Decimal(str(total)) - discount_amount, Decimal('0.00'))
    tax = Decimal('0.02') * discounted_total
    grand_total = discounted_total + tax

    if request.method == 'POST':
        post_data = request.POST.copy()
        selected_address_id = post_data.get('selected_address_id')
        selected_checkout_address = None
        if selected_address_id:
            try:
                from addresses.services import CheckoutAddressService
                selected_checkout_address = CheckoutAddressService().select_address_for_order(
                    current_user, 'pending', selected_address_id,
                )
                post_data['address_line_1'] = selected_checkout_address.street
                post_data['address_line_2'] = selected_checkout_address.apartment
                post_data['country'] = selected_checkout_address.country
                post_data['state'] = selected_checkout_address.state
                post_data['city'] = selected_checkout_address.city
                post_data['zip_code'] = selected_checkout_address.postal_code
                if selected_checkout_address.phone_number and not post_data.get('phone'):
                    post_data['phone'] = selected_checkout_address.phone_number
            except Exception:
                pass

        form = OrderForm(post_data)
        if form.is_valid():
            data = Order()
            data.user = current_user
            data.first_name = form.cleaned_data['first_name']
            data.last_name = form.cleaned_data['last_name']
            data.phone = form.cleaned_data['phone']
            data.email = form.cleaned_data['email']
            data.address_line_1 = form.cleaned_data['address_line_1']
            data.address_line_2 = form.cleaned_data['address_line_2']
            data.country = form.cleaned_data['country']
            data.state = form.cleaned_data['state']
            data.city = form.cleaned_data['city']
            data.zip_code = form.cleaned_data['zip_code']
            data.order_total = float(grand_total)
            data.tax = float(tax)
            data.coupon_code = coupon_code
            data.discount_amount = discount_amount
            data.ip = request.META.get('REMOTE_ADDR')
            data.save()

            if not selected_checkout_address and form.cleaned_data.get('save_checkout_address'):
                try:
                    from addresses.services import CheckoutAddressService
                    CheckoutAddressService().save_new_checkout_address(
                        current_user,
                        {
                            'street': form.cleaned_data['address_line_1'],
                            'apartment': form.cleaned_data['address_line_2'],
                            'city': form.cleaned_data['city'],
                            'state': form.cleaned_data['state'],
                            'postal_code': form.cleaned_data['zip_code'],
                            'country': form.cleaned_data['country'],
                            'phone_number': form.cleaned_data['phone'],
                        },
                        save_for_future=True,
                    )
                except Exception:
                    pass

            current_date = datetime.date.today().strftime('%Y%m%d')
            order_number = current_date + str(data.id)
            data.order_number = order_number
            data.save()

            order = Order.objects.get(user=current_user, is_ordered=False, order_number=order_number)
            from django.conf import settings as django_settings
            context = {
                'order': order,
                'cart_items': cart_items,
                'total': total,
                'discount_amount': discount_amount,
                'tax': float(tax),
                'grand_total': float(grand_total),
                'PAYPAL_CLIENT_ID': django_settings.PAYPAL_CLIENT_ID,
            }
            return render(request, 'orders/payments.html', context)
        else:
            logger.debug('Order form errors: %s', form.errors)

    return redirect('checkout')


def order_complete(request):
    order_number = request.GET.get('order_number')
    transID = request.GET.get('payment_id')

    try:
        order = Order.objects.get(order_number=order_number, is_ordered=True)
        ordered_products = OrderProduct.objects.filter(order_id=order.id)

        subtotal = 0
        for i in ordered_products:
            subtotal += i.product_price * i.quantity

        payment = Payment.objects.get(payment_id=transID)

        context = {
            'order': order,
            'ordered_products': ordered_products,
            'order_number': order.order_number,
            'transID': payment.payment_id,
            'payment': payment,
            'subtotal': subtotal,
        }
        return render(request, 'orders/order_complete.html', context)
    except (Payment.DoesNotExist, Order.DoesNotExist):
        return redirect('home')
