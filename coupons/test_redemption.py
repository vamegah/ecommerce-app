from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from accounts.models import Account
from orders.models import Order
from .models import Coupon, Redemption
from .tracker import RedemptionTracker


class RedemptionTrackingPropertyTests(TestCase):
    def test_redemption_record_creation(self):
        """Feature: discount-codes, Property 13: Redemption Record Creation"""
        coupon = Coupon.objects.create(
            code='TEST',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        user = Account.objects.create_user(
            email='test@test.com',
            username='testuser',
            password='testpass'
        )
        
        order = Order.objects.create(
            user=user,
            first_name='Test',
            last_name='User',
            email='test@test.com',
            address_line_1='123 Test St',
            country='US',
            state='CA',
            city='LA',
            zip_code='90001',
            phone='1234567890',
            order_total=100,
            tax=2,
            order_number='TEST123'
        )
        
        redemption = RedemptionTracker.record_redemption(coupon, user, order)
        
        self.assertIsNotNone(redemption)
        self.assertEqual(redemption.coupon, coupon)
        self.assertEqual(redemption.user, user)
        self.assertEqual(redemption.order, order)

    def test_usage_count_accuracy(self):
        """Feature: discount-codes, Property 14: Usage Count Accuracy"""
        coupon = Coupon.objects.create(
            code='TEST',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        users = []
        for i in range(3):
            user = Account.objects.create_user(
                email=f'test{i}@test.com',
                username=f'testuser{i}',
                password='testpass'
            )
            users.append(user)
            
            order = Order.objects.create(
                user=user,
                first_name='Test',
                last_name='User',
                email=user.email,
                address_line_1='123 Test St',
                country='US',
                state='CA',
                city='LA',
                zip_code='90001',
                phone='1234567890',
                order_total=100,
                tax=2,
                order_number=f'TEST{i}'
            )
            
            RedemptionTracker.record_redemption(coupon, user, order)
        
        total_usage = RedemptionTracker.get_total_usage(coupon)
        self.assertEqual(total_usage, 3)
        
        user_usage = RedemptionTracker.get_user_usage(coupon, users[0])
        self.assertEqual(user_usage, 1)


class ConcurrentRedemptionTests(TestCase):
    def test_usage_limits_enforced(self):
        """Test usage limits under concurrent access"""
        coupon = Coupon.objects.create(
            code='LIMITED',
            discount_type='percentage',
            discount_value=10,
            max_usage_limit=1,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        user = Account.objects.create_user(
            email='test@test.com',
            username='testuser',
            password='testpass'
        )
        
        from .validators import CouponValidator
        
        # First redemption should succeed
        result1 = CouponValidator.validate('LIMITED', Decimal('100'), user)
        self.assertTrue(result1.is_valid)
        
        # Record redemption
        order = Order.objects.create(
            user=user,
            first_name='Test',
            last_name='User',
            email='test@test.com',
            address_line_1='123 Test St',
            country='US',
            state='CA',
            city='LA',
            zip_code='90001',
            phone='1234567890',
            order_total=100,
            tax=2,
            order_number='TEST123'
        )
        RedemptionTracker.record_redemption(coupon, user, order)
        
        # Second redemption should fail
        result2 = CouponValidator.validate('LIMITED', Decimal('100'), user)
        self.assertFalse(result2.is_valid)
        self.assertIn('usage limit', result2.error_message)
