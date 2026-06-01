from hypothesis import given, settings, strategies as st
from hypothesis.extra.django import TestCase
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from .models import Coupon
from .utils import DiscountEngine, money


class DiscountEnginePropertyTests(TestCase):
    @settings(max_examples=100)
    @given(
        cart_total=st.decimals(min_value='0.01', max_value='10000', places=2),
        discount_value=st.decimals(min_value='0', max_value='100', places=2),
        tax_rate=st.decimals(min_value='0', max_value='0.5', places=2)
    )
    def test_order_total_calculation(self, cart_total, discount_value, tax_rate):
        """Feature: discount-codes, Property 2: Order Total Calculation Correctness"""
        coupon = Coupon(
            code='TEST',
            discount_type='percentage',
            discount_value=discount_value,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        result = DiscountEngine.calculate_order_total(cart_total, coupon, tax_rate)
        
        expected_discount = money(cart_total * (discount_value / Decimal('100')))
        expected_subtotal = money(cart_total - expected_discount)
        expected_tax = money(expected_subtotal * tax_rate)
        expected_total = money(expected_subtotal + expected_tax)

        self.assertEqual(result['discount'], expected_discount)
        self.assertEqual(result['total'], expected_total)

    @settings(max_examples=100)
    @given(
        cart_total=st.decimals(min_value='0.01', max_value='10000', places=2),
        discount_value=st.decimals(min_value='0.01', max_value='20000', places=2)
    )
    def test_fixed_discount_capping(self, cart_total, discount_value):
        """Feature: discount-codes, Property 3: Fixed Discount Capping"""
        coupon = Coupon(
            code='TEST',
            discount_type='fixed',
            discount_value=discount_value,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        discount = DiscountEngine.calculate_discount(cart_total, coupon)
        
        self.assertLessEqual(discount, cart_total)
        self.assertLessEqual(discount, discount_value)

    @settings(max_examples=100)
    @given(
        cart_total=st.decimals(min_value='0.01', max_value='10000', places=2),
        discount_value=st.decimals(min_value='0', max_value='100', places=2),
        tax_rate=st.decimals(min_value='0.01', max_value='0.5', places=2)
    )
    def test_tax_applied_after_discount(self, cart_total, discount_value, tax_rate):
        """Feature: discount-codes, Property 4: Tax Applied After Discount"""
        coupon = Coupon(
            code='TEST',
            discount_type='percentage',
            discount_value=discount_value,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        result = DiscountEngine.calculate_order_total(cart_total, coupon, tax_rate)
        
        expected_tax = money(result['subtotal_after_discount'] * tax_rate)
        self.assertEqual(result['tax'], expected_tax)
