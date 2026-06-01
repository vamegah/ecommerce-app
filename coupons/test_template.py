from django.test import TestCase, Client
from django.utils import timezone
from datetime import timedelta
from accounts.models import Account
from .models import Coupon
from category.models import Category
from store.models import Product
from carts.models import CartItem


class CheckoutTemplateTests(TestCase):
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
        category = Category.objects.create(category_name='Template Category', slug='template-category')
        product = Product.objects.create(
            product_name='Template Product',
            slug='template-product',
            price=100,
            images='test.jpg',
            stock=5,
            category=category,
            is_available=True,
        )
        CartItem.objects.create(user=self.user, product=product, quantity=1, is_active=True)

    def test_coupon_input_present(self):
        response = self.client.get('/cart/checkout/')
        
        self.assertContains(response, 'coupon-code')
        self.assertContains(response, 'apply-coupon')

    def test_discount_line_with_coupon(self):
        Coupon.objects.create(
            code='TEST10',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        session = self.client.session
        session['coupon_code'] = 'TEST10'
        session['discount_amount'] = '10.00'
        session.save()
        
        response = self.client.get('/cart/checkout/')
        
        self.assertContains(response, 'TEST10')
        self.assertContains(response, '10.00')

    def test_remove_option_with_coupon(self):
        Coupon.objects.create(
            code='TEST10',
            discount_type='percentage',
            discount_value=10,
            valid_from=timezone.now(),
            valid_to=timezone.now() + timedelta(days=30)
        )
        session = self.client.session
        session['coupon_code'] = 'TEST10'
        session.save()
        
        response = self.client.get('/cart/checkout/')
        
        self.assertContains(response, 'remove-coupon')
