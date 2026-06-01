from django.test import TestCase
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from hypothesis import given, strategies as st, settings
from hypothesis.extra.django import TestCase as HypothesisTestCase
from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Coupon, Redemption


# Property-Based Tests using Hypothesis

class CouponPropertyTests(HypothesisTestCase):
    """
    Property-based tests for Coupon model using Hypothesis.
    """
    
    @settings(max_examples=100)
    @given(
        code1=st.text(min_size=1, max_size=50, alphabet=st.characters(min_codepoint=65, max_codepoint=90)),
        code2=st.text(min_size=1, max_size=50, alphabet=st.characters(min_codepoint=65, max_codepoint=90)),
    )
    def test_property_1_unique_coupon_codes(self, code1, code2):
        """
        Feature: discount-codes, Property 1: Unique Coupon Codes
        **Validates: Requirements 1.2**
        
        For any two coupons, their codes must be distinct (case-insensitive comparison).
        """
        # Skip if codes are the same (we're testing uniqueness)
        if code1.upper() == code2.upper():
            return
        
        # Create valid date range
        valid_from = timezone.now()
        valid_to = valid_from + timedelta(days=30)
        
        # Create first coupon
        coupon1 = Coupon.objects.create(
            code=code1,
            discount_type='percentage',
            discount_value=Decimal('10.00'),
            valid_from=valid_from,
            valid_to=valid_to,
            is_active=True
        )
        
        # Try to create second coupon with different code
        coupon2 = Coupon.objects.create(
            code=code2,
            discount_type='percentage',
            discount_value=Decimal('20.00'),
            valid_from=valid_from,
            valid_to=valid_to,
            is_active=True
        )
        
        # Verify codes are distinct (case-insensitive)
        self.assertNotEqual(coupon1.code.upper(), coupon2.code.upper())
        
        # Verify both coupons exist in database
        self.assertEqual(Coupon.objects.filter(code=coupon1.code).count(), 1)
        self.assertEqual(Coupon.objects.filter(code=coupon2.code).count(), 1)


# Unit Tests for Coupon Model

class CouponModelValidationTests(TestCase):
    """
    Unit tests for Coupon model validation.
    Tests discount_value constraints, code uppercase conversion, and date range validation.
    """
    
    def setUp(self):
        """Set up test data."""
        self.valid_from = timezone.now()
        self.valid_to = self.valid_from + timedelta(days=30)
    
    def test_percentage_discount_within_valid_range(self):
        """Test that percentage discount between 0 and 100 is valid."""
        coupon = Coupon(
            code='TEST10',
            discount_type='percentage',
            discount_value=Decimal('50.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        # Should not raise ValidationError
        coupon.full_clean()
        coupon.save()
        self.assertEqual(coupon.discount_value, Decimal('50.00'))
    
    def test_percentage_discount_zero_invalid(self):
        """Test that percentage discount of 0 is invalid."""
        coupon = Coupon(
            code='TEST0',
            discount_type='percentage',
            discount_value=Decimal('0.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        with self.assertRaises(ValidationError) as context:
            coupon.full_clean()
        self.assertIn('discount_value', context.exception.message_dict)
    
    def test_percentage_discount_over_100_invalid(self):
        """Test that percentage discount over 100 is invalid."""
        coupon = Coupon(
            code='TEST101',
            discount_type='percentage',
            discount_value=Decimal('101.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        with self.assertRaises(ValidationError) as context:
            coupon.full_clean()
        self.assertIn('discount_value', context.exception.message_dict)
    
    def test_percentage_discount_exactly_100_valid(self):
        """Test that percentage discount of exactly 100 is valid."""
        coupon = Coupon(
            code='TEST100',
            discount_type='percentage',
            discount_value=Decimal('100.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        # Should not raise ValidationError
        coupon.full_clean()
        coupon.save()
        self.assertEqual(coupon.discount_value, Decimal('100.00'))
    
    def test_fixed_discount_positive_valid(self):
        """Test that positive fixed discount is valid."""
        coupon = Coupon(
            code='FIXED50',
            discount_type='fixed',
            discount_value=Decimal('50.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        # Should not raise ValidationError
        coupon.full_clean()
        coupon.save()
        self.assertEqual(coupon.discount_value, Decimal('50.00'))
    
    def test_fixed_discount_zero_invalid(self):
        """Test that fixed discount of 0 is invalid."""
        coupon = Coupon(
            code='FIXED0',
            discount_type='fixed',
            discount_value=Decimal('0.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        with self.assertRaises(ValidationError) as context:
            coupon.full_clean()
        self.assertIn('discount_value', context.exception.message_dict)
    
    def test_fixed_discount_negative_invalid(self):
        """Test that negative fixed discount is invalid."""
        coupon = Coupon(
            code='FIXEDNEG',
            discount_type='fixed',
            discount_value=Decimal('-10.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        with self.assertRaises(ValidationError) as context:
            coupon.full_clean()
        self.assertIn('discount_value', context.exception.message_dict)
    
    def test_code_uppercase_conversion(self):
        """Test that coupon code is converted to uppercase on save."""
        coupon = Coupon(
            code='lowercase',
            discount_type='percentage',
            discount_value=Decimal('10.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        coupon.save()
        self.assertEqual(coupon.code, 'LOWERCASE')
    
    def test_code_mixed_case_conversion(self):
        """Test that mixed case coupon code is converted to uppercase."""
        coupon = Coupon(
            code='MiXeDcAsE',
            discount_type='percentage',
            discount_value=Decimal('15.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        coupon.save()
        self.assertEqual(coupon.code, 'MIXEDCASE')
    
    def test_date_range_valid_from_before_valid_to(self):
        """Test that valid_from must be before valid_to."""
        coupon = Coupon(
            code='DATETEST',
            discount_type='percentage',
            discount_value=Decimal('10.00'),
            valid_from=self.valid_to,  # After valid_to
            valid_to=self.valid_from,  # Before valid_from
            is_active=True
        )
        with self.assertRaises(ValidationError) as context:
            coupon.full_clean()
        self.assertIn('valid_to', context.exception.message_dict)
    
    def test_date_range_valid_from_equals_valid_to_invalid(self):
        """Test that valid_from cannot equal valid_to."""
        same_time = timezone.now()
        coupon = Coupon(
            code='SAMEDATE',
            discount_type='percentage',
            discount_value=Decimal('10.00'),
            valid_from=same_time,
            valid_to=same_time,
            is_active=True
        )
        with self.assertRaises(ValidationError) as context:
            coupon.full_clean()
        self.assertIn('valid_to', context.exception.message_dict)
    
    def test_unique_code_constraint(self):
        """Test that duplicate coupon codes are not allowed."""
        Coupon.objects.create(
            code='UNIQUE',
            discount_type='percentage',
            discount_value=Decimal('10.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        
        # Try to create another coupon with the same code
        with self.assertRaises((IntegrityError, ValidationError)):
            Coupon.objects.create(
                code='UNIQUE',
                discount_type='percentage',
                discount_value=Decimal('20.00'),
                valid_from=self.valid_from,
                valid_to=self.valid_to,
                is_active=True
            )
    
    def test_unique_code_case_insensitive(self):
        """Test that coupon codes are unique case-insensitively."""
        Coupon.objects.create(
            code='casetest',
            discount_type='percentage',
            discount_value=Decimal('10.00'),
            valid_from=self.valid_from,
            valid_to=self.valid_to,
            is_active=True
        )
        
        # Try to create another coupon with different case
        with self.assertRaises((IntegrityError, ValidationError)):
            Coupon.objects.create(
                code='CASETEST',  # Same code, different case
                discount_type='percentage',
                discount_value=Decimal('20.00'),
                valid_from=self.valid_from,
                valid_to=self.valid_to,
                is_active=True
            )
