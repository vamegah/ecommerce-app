from django.test import TestCase, Client
from django.urls import reverse
from store.models import Product
from category.models import Category


class FilterProductsTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.category = Category.objects.create(
            category_name='Test Category',
            slug='test-category'
        )
        
        self.product1 = Product.objects.create(
            product_name='Product 1',
            slug='product-1',
            price=100,
            stock=10,
            is_available=True,
            category=self.category
        )
        
        self.product2 = Product.objects.create(
            product_name='Product 2',
            slug='product-2',
            price=200,
            stock=0,
            is_available=True,
            category=self.category
        )

    def test_price_filter(self):
        response = self.client.get(reverse('filter_products'), {'price_min': '150'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['products'][0]['name'], 'Product 2')

    def test_availability_filter(self):
        response = self.client.get(reverse('filter_products'), {'in_stock': '1'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['products'][0]['name'], 'Product 1')
