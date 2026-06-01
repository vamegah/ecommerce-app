from django.test import TestCase
from hypothesis import given, settings, strategies as st
from hypothesis.extra.django import TestCase as HypothesisTestCase
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from accounts.models import Account
from .models import Coupon, Redemption
from .validators import CouponValidator
from orders.models import Order


class CouponValidatorPropertyTests(HypothesisTestCase):
    @settings(max_examples=100)
    @given(st.text(min_size=1, max_size=50))
    def test_invalid_code_rejection(self, invalid_code):
        """Feature: discount-codes, Property 5: Invalid Code Rejection"""
        result = CouponValidator.validate(invalid_code, Decimal('100'))
        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_message, 'Invalid coupon code')

    def test_inactive_coupon_rejection(self):
        """Feature: discount-codes, Property 6: Inactive Coupon Rejection"""
        coupon = Coupon.objects.create(
            code='INACTIVE',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30),
            is_active=False
        )
        
        result = CouponValidator.validate('INACTIVE', Decimal('100'))
        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_message, 'This coupon is not active')

    def test_date_range_validation(self):
        """Feature: discount-codes, Property 7: Date Range Validation"""
        coupon = Coupon.objects.create(
            code='EXPIRED',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now() - timedelta(days=60),
            valid_to=timezone.now() - timedelta(days=30)
        )
        
        result = CouponValidator.validate('EXPIRED', Decimal('100'))
        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_message, 'This coupon has expired')

    @settings(max_examples=100)
    @given(
        cart_total=st.decimals(min_value='0.01', max_value='100', places=2),
        min_order=st.decimals(min_value='100.01', max_value='500', places=2)
    )
    def test_minimum_order_value_enforcement(self, cart_total, min_order):
        """Feature: discount-codes, Property 8: Minimum Order Value Enforcement"""
        coupon = Coupon.objects.create(
            code='MINORDER',
            discount_type='percentage',
            discount_value=10,
            minimum_order_value=min_order,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        result = CouponValidator.validate('MINORDER', cart_total)
        self.assertFalse(result.is_valid)
        self.assertIn('Minimum order value', result.error_message)

    def test_maximum_usage_limit_enforcement(self):
        """Feature: discount-codes, Property 9: Maximum Usage Limit Enforcement"""
        coupon = Coupon.objects.create(
            code='MAXUSE',
            discount_type='percentage',
            discount_value=10,
            max_usage_limit=1,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        user = Account.objects.create_user(email='max@test.com', username='maxuser', password='test')
        order = Order.objects.create(user=user, order_total=100, tax=2, order_number='MAXUSE1')
        Redemption.objects.create(coupon=coupon, user=user, order=order, discount_amount=Decimal('10.00'))

        result = CouponValidator.validate('MAXUSE', Decimal('100'), user)

        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_message, 'This coupon has reached its usage limit')

    def test_per_user_usage_limit_enforcement(self):
        """Feature: discount-codes, Property 10: Per-User Usage Limit Enforcement"""
        coupon = Coupon.objects.create(
            code='USERUSE',
            discount_type='percentage',
            discount_value=10,
            max_usage_per_user=1,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        user = Account.objects.create_user(email='per@test.com', username='peruser', password='test')
        order = Order.objects.create(user=user, order_total=100, tax=2, order_number='USERUSE1')
        Redemption.objects.create(coupon=coupon, user=user, order=order, discount_amount=Decimal('10.00'))

        result = CouponValidator.validate('USERUSE', Decimal('100'), user)

        self.assertFalse(result.is_valid)
        self.assertEqual(
            result.error_message,
            'You have already used this coupon the maximum number of times'
        )

    def test_validation_result_completeness(self):
        """Feature: discount-codes, Property 11: Validation Result Completeness"""
        coupon = Coupon.objects.create(
            code='VALID',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        result = CouponValidator.validate('VALID', Decimal('100'))
        self.assertTrue(result.is_valid)
        self.assertIsNotNone(result.coupon)
        self.assertEqual(result.error_message, '')


class CouponValidatorUnitTests(TestCase):
    def test_error_messages(self):
        coupon = Coupon.objects.create(
            code='TEST',
            discount_type='percentage',
            discount_value=10,
            minimum_order_value=Decimal('50'),
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        result = CouponValidator.validate('TEST', Decimal('30'))
        self.assertIn('$50', result.error_message)
