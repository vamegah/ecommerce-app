from django.test import TestCase, Client
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from accounts.models import Account
from coupons.models import Coupon


class SessionRestorationTests(TestCase):
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

    def test_valid_coupon_restored(self):
        coupon = Coupon.objects.create(
            code='VALID',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        session = self.client.session
        session['coupon_code'] = 'VALID'
        session['discount_amount'] = '10.00'
        session.save()
        
        response = self.client.get('/cart/checkout/')
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('coupon_code', self.client.session)

    def test_invalid_coupon_cleared(self):
        coupon = Coupon.objects.create(
            code='EXPIRED',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now() - timedelta(days=60),
            valid_to=timezone.now() - timedelta(days=30)
        )
        
        session = self.client.session
        session['coupon_code'] = 'EXPIRED'
        session['discount_amount'] = '10.00'
        session.save()
        
        response = self.client.get('/cart/checkout/')
        
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('coupon_code', self.client.session)

    def test_discount_displayed_on_load(self):
        coupon = Coupon.objects.create(
            code='DISPLAY',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        session = self.client.session
        session['coupon_code'] = 'DISPLAY'
        session['discount_amount'] = '10.00'
        session.save()
        
        response = self.client.get('/cart/checkout/')
        
        self.assertContains(response, 'DISPLAY')
