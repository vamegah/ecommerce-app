from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from .models import Coupon, Redemption
from .tracker import RedemptionTracker
from orders.models import Order

Account = get_user_model()


class RedemptionTrackerTests(TestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="tracker@test.com", username="trackeruser", password="password"
        )
        self.coupon = Coupon.objects.create(
            code="TRACKER",
            discount_type="percentage",
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30),
        )
        # Mock order creation
        self.order = Order.objects.create(
            user=self.user, order_total=100, tax=0, order_number="TRACK1"
        )

    def test_redemption_recording(self):
        """Feature: discount-codes, Property 13: Redemption Record Creation"""
        tracker = RedemptionTracker()
        redemption = tracker.record_redemption(
            self.coupon, self.order, self.user, Decimal("10.00")
        )

        self.assertIsInstance(redemption, Redemption)
        self.assertEqual(redemption.coupon, self.coupon)
        self.assertEqual(redemption.order, self.order)
        self.assertEqual(redemption.user, self.user)
        self.assertEqual(redemption.discount_amount, Decimal("10.00"))

    def test_usage_counting(self):
        """Feature: discount-codes, Property 14: Usage Count Accuracy"""
        tracker = RedemptionTracker()

        # Initial count
        self.assertEqual(tracker.get_total_usage(self.coupon), 0)
        self.assertEqual(tracker.get_user_usage(self.coupon, self.user), 0)

        # Record redemption
        tracker.record_redemption(self.coupon, self.order, self.user, Decimal("10.00"))

        # Check counts
        self.assertEqual(tracker.get_total_usage(self.coupon), 1)
        self.assertEqual(tracker.get_user_usage(self.coupon, self.user), 1)

        second_order = Order.objects.create(
            user=self.user, order_total=100, tax=0, order_number="TRACK2"
        )

        # Verify count increments for same coupon with a different order
        tracker.record_redemption(
            self.coupon, second_order, self.user, Decimal("10.00")
        )
        self.assertEqual(tracker.get_total_usage(self.coupon), 2)
