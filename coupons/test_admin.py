from django.test import TestCase
from django.contrib.admin.sites import AdminSite
from .models import Coupon, Redemption
from .admin import CouponAdmin, RedemptionAdmin


class AdminTest(TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.coupon_admin = CouponAdmin(Coupon, self.site)
        self.redemption_admin = RedemptionAdmin(Redemption, self.site)

    def test_coupon_admin_list_display(self):
        """Task 11.1: Test Coupon admin configuration"""
        expected_fields = [
            "code",
            "discount_type",
            "discount_value",
            "is_active",
            "valid_from",
            "valid_to",
        ]
        for field in expected_fields:
            self.assertIn(field, self.coupon_admin.list_display)

    def test_coupon_admin_search_fields(self):
        self.assertIn("code", self.coupon_admin.search_fields)

    def test_redemption_admin_list_display(self):
        """Task 11.1: Test Redemption admin configuration"""
        expected_fields = ["coupon", "user", "order", "discount_amount", "redeemed_at"]
        for field in expected_fields:
            self.assertIn(field, self.redemption_admin.list_display)

    def test_redemption_admin_filters(self):
        self.assertIn("coupon", self.redemption_admin.list_filter)
        self.assertIn("redeemed_at", self.redemption_admin.list_filter)
