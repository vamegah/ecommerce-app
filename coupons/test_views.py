from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from accounts.models import Account
from .models import Coupon
from category.models import Category
from store.models import Product
from carts.models import CartItem


class CheckoutViewPropertyTests(TestCase):
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

    def test_single_coupon_enforcement(self):
        """Feature: discount-codes, Property 12: Single Coupon Enforcement"""
        coupon1 = Coupon.objects.create(
            code='FIRST',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        session = self.client.session
        session['coupon_code'] = 'FIRST'
        session.save()
        
        response = self.client.post('/coupons/apply/', {'code': 'SECOND'})
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('Only one coupon', data['error'])

    def test_session_persistence(self):
        """Feature: discount-codes, Property 15: Session Persistence"""
        coupon = Coupon.objects.create(
            code='SESSION',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        session = self.client.session
        session['coupon_code'] = 'SESSION'
        session['discount_amount'] = '10.00'
        session.save()
        
        self.assertEqual(self.client.session.get('coupon_code'), 'SESSION')

    def test_case_insensitive_matching(self):
        """Feature: discount-codes, Property 17: Case-Insensitive Code Matching"""
        coupon = Coupon.objects.create(
            code='TESTCODE',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        
        from .validators import CouponValidator
        result = CouponValidator.validate('testcode', Decimal('100'))
        
        self.assertTrue(result.is_valid)
        self.assertEqual(result.coupon.code, 'TESTCODE')



class CheckoutViewUnitTests(TestCase):
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
        
        self.coupon = Coupon.objects.create(
            code='VALID',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        category = Category.objects.create(category_name='Coupon Test', slug='coupon-test')
        product = Product.objects.create(
            product_name='Coupon Product',
            slug='coupon-product',
            price=100,
            images='test.jpg',
            stock=10,
            category=category,
            is_available=True,
        )
        CartItem.objects.create(user=self.user, product=product, quantity=1, is_active=True)

    def test_apply_coupon_success(self):
        response = self.client.post('/coupons/apply/', {'code': 'VALID'})
        data = response.json()
        
        self.assertTrue(data['success'])
        self.assertIn('discount', data)
        self.assertEqual(data['code'], 'VALID')

    def test_apply_coupon_invalid_code(self):
        response = self.client.post('/coupons/apply/', {'code': 'INVALID'})
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('Invalid coupon code', data['error'])

    def test_apply_coupon_inactive(self):
        self.coupon.is_active = False
        self.coupon.save()
        
        response = self.client.post('/coupons/apply/', {'code': 'VALID'})
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('not active', data['error'])

    def test_remove_coupon_clears_session(self):
        session = self.client.session
        session['coupon_code'] = 'VALID'
        session.save()
        
        response = self.client.post('/coupons/remove/')
        data = response.json()
        
        self.assertTrue(data['success'])
        self.assertNotIn('coupon_code', self.client.session)

    def test_single_coupon_enforcement_error(self):
        session = self.client.session
        session['coupon_code'] = 'FIRST'
        session.save()
        
        response = self.client.post('/coupons/apply/', {'code': 'VALID'})
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('Only one coupon', data['error'])
