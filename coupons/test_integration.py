from django.test import TestCase, Client, RequestFactory
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from .models import Coupon, Redemption
from orders.models import Order
from .services import CouponSessionService

Account = get_user_model()


class OrderIntegrationTests(TestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="integ@test.com", username="integuser", password="password"
        )
        self.coupon = Coupon.objects.create(
            code="INTEG10",
            discount_type="percentage",
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30),
        )
        self.client = Client()
        self.client.login(email="integ@test.com", password="password")
        self.factory = RequestFactory()

    def test_order_placement_with_coupon(self):
        """Feature: discount-codes, Property 16: Order Record Persistence"""
        # 1. Simulate applying coupon in session
        session = self.client.session
        session["applied_coupon_code"] = "INTEG10"
        session.save()

        # 2. Simulate Order Creation Logic (Service Integration)
        # Create a request object with the session
        request = self.factory.get("/")
        request.user = self.user
        request.session = session

        service = CouponSessionService(request)

        cart_total = Decimal("100.00")
        coupon, discount, error = service.get_applied_coupon(cart_total)

        self.assertEqual(coupon, self.coupon)
        self.assertEqual(discount, Decimal("10.00"))

        # Create Order
        order = Order.objects.create(
            user=self.user,
            order_total=cart_total - discount,
            tax=0,
            order_number="ORD-INTEG",
            coupon_code=coupon.code,
            discount_amount=discount,
        )

        # 3. Verify Order Persistence (Task 4.1 / 9.1)
        order.refresh_from_db()
        self.assertEqual(order.coupon_code, "INTEG10")
        self.assertEqual(order.discount_amount, Decimal("10.00"))
