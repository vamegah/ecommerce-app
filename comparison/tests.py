from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from category.models import Category
from store.models import Product

from .models import SavedComparison, SharedComparison


class ComparisonApiTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(
            category_name="Shoes",
            slug="shoes",
            description="Footwear",
        )
        self.product = Product.objects.create(
            product_name="Trail Shoe",
            slug="trail-shoe",
            description="A durable trail shoe.",
            price=120,
            images="photos/products/trail.jpg",
            stock=5,
            is_available=True,
            category=self.category,
        )

    def test_product_payload_endpoint_returns_comparison_ready_products(self):
        response = self.client.post(
            reverse("comparison:api_products"),
            data={"productIds": [self.product.id]},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["products"][0]["id"], str(self.product.id))
        self.assertEqual(payload["products"][0]["attributes"][0]["name"], "Price")

    def test_save_and_load_session_comparison(self):
        response = self.client.post(
            reverse("comparison:api_comparison"),
            data={"productIds": [self.product.id]},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(SavedComparison.objects.count(), 1)

        response = self.client.get(reverse("comparison:api_comparison"))
        payload = response.json()
        self.assertEqual(payload["comparison"]["products"][0]["id"], str(self.product.id))

    def test_shared_comparison_round_trip_and_expiration(self):
        response = self.client.post(
            reverse("comparison:api_shared_comparison"),
            data={"productIds": [self.product.id]},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        share_id = response.json()["shareId"]

        response = self.client.get(reverse("comparison:api_shared_detail", args=[share_id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["comparison"]["products"][0]["id"], str(self.product.id))

        shared = SharedComparison.objects.get(share_id=share_id)
        shared.expires_at = timezone.now() - timedelta(seconds=1)
        shared.save(update_fields=["expires_at"])

        response = self.client.get(reverse("comparison:api_shared_detail", args=[share_id]))
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()["code"], "SHARE_EXPIRED")

    def test_invalid_share_id_returns_json_error(self):
        response = self.client.get(reverse("comparison:api_shared_detail", args=["missing"]))

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], "INVALID_SHARE_ID")

    def test_comparison_page_renders_indicator_and_mount_point(self):
        response = self.client.get(reverse("comparison:comparison_page"))

        self.assertContains(response, "Product Comparison")
        self.assertContains(response, "data-compare-indicator")
        self.assertContains(response, 'id="comparison-page"')
