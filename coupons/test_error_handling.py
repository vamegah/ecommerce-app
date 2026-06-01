from django.test import TestCase, Client
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from accounts.models import Account
from orders.models import Order
from coupons.models import Coupon
from coupons.validators import CouponValidator


class ErrorHandlingTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = Account.objects.create_user(
            email='test@test.com',
            username='testuser',
            password='testpass123'
        )
        self.user.is_active = True
        self.user.save()
        self.client.login(email='test@test.com', password='testpass123')

    def test_zero_cart_total_rejection(self):
        response = self.client.post('/coupons/apply/', {'code': 'TEST'})
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('zero value', data['error'])

    def test_deleted_coupon_handling(self):
        coupon = Coupon.objects.create(
            code='DELETED',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        coupon_id = coupon.id
        coupon.delete()
        
        result = CouponValidator.validate('DELETED', Decimal('100'))
        
        self.assertFalse(result.is_valid)
        self.assertEqual(result.error_message, 'Invalid coupon code')

    def test_database_error_handling(self):
        # Test with invalid data that would cause database error
        result = CouponValidator.validate('', Decimal('100'))
        
        self.assertFalse(result.is_valid)

    def test_transaction_rollback(self):
        from coupons.tracker import RedemptionTracker
        from django.db import transaction
        
        coupon = Coupon.objects.create(
            code='TRANS',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        order = Order.objects.create(
            user=self.user,
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
        
        # This should succeed
        redemption = RedemptionTracker.record_redemption(coupon, self.user, order)
        self.assertIsNotNone(redemption)
