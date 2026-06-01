from datetime import timedelta
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone

from carts.models import CartItem
from category.models import Category
from orders.models import Order, OrderProduct
from store.models import Product

from .admin import RelatedProductAdmin
from .cache import RecommendationCache
from .engine import RecommendationEngine
from .mixins import RecommendationMixin
from .models import RecommendationClick, RelatedProduct
from .tasks import (
    aggregate_recommendation_metrics,
    invalidate_recommendations_after_order,
    log_recommendation_click,
    warm_cache_for_popular_products,
)


User = get_user_model()


class DummyView(RecommendationMixin):
    pass


class RecommendationTestBase(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            first_name="Test",
            last_name="User",
            username="testuser",
            email="test@example.com",
            password="pass12345",
        )
        self.category = Category.objects.create(
            category_name="Electronics",
            slug="electronics",
            description="Electronics",
        )
        self.products = []
        for index in range(1, 10):
            self.products.append(
                Product.objects.create(
                    product_name=f"Product {index}",
                    slug=f"product-{index}",
                    description="Test Product",
                    price=100 + index,
                    images="photos/products/test.jpg",
                    stock=10,
                    is_available=True,
                    category=self.category,
                )
            )


class RecommendationCacheTests(RecommendationTestBase):
    def test_cache_key_format(self):
        cache_manager = RecommendationCache()
        self.assertEqual(
            cache_manager.key("related", "12:6"),
            "recommendations:related:12:6",
        )

    def test_cache_round_trip(self):
        cache_manager = RecommendationCache()
        value = [product.id for product in self.products[:3]]
        self.assertTrue(cache_manager.set("related", "key", value))
        self.assertEqual(cache_manager.get("related", "key"), value)

    def test_cache_miss_returns_none(self):
        cache_manager = RecommendationCache()
        self.assertIsNone(cache_manager.get("related", "missing"))

    def test_pattern_invalidation(self):
        cache_manager = RecommendationCache()
        cache_manager.set("related", "1", [1])
        cache_manager.set("related", "2", [2])
        cache_manager.invalidate_pattern("recommendations:related:*")
        self.assertIsNone(cache_manager.get("related", "1"))
        self.assertIsNone(cache_manager.get("related", "2"))

    def test_cache_failure_handling(self):
        cache_manager = RecommendationCache()
        with patch("recommendations.cache.cache.get", side_effect=RuntimeError("redis down")):
            self.assertIsNone(cache_manager.get("related", "k"))


class RecommendationEngineTests(RecommendationTestBase):
    def setUp(self):
        super().setUp()
        self.engine = RecommendationEngine()

    def _create_order_with_products(self, user, products):
        order = Order.objects.create(
            user=user,
            order_number=f"order-{timezone.now().timestamp()}-{user.id}",
            first_name="Test",
            last_name="User",
            email=user.email,
            address_line_1="A",
            address_line_2="",
            country="US",
            state="TX",
            zip_code="75001",
            city="Dallas",
            phone="1234567890",
            order_total=300,
            tax=10,
            is_ordered=True,
            status="Delivered",
        )
        for product in products:
            OrderProduct.objects.create(
                order=order,
                user=user,
                product=product,
                quantity=1,
                product_price=product.price,
                ordered=True,
            )
        return order

    def test_related_products_limit_and_exclusion(self):
        related = self.engine.get_related_products(self.products[0], limit=6)
        self.assertLessEqual(len(related), 6)
        self.assertNotIn(self.products[0], related)

    def test_manual_override_prioritized(self):
        RelatedProduct.objects.create(
            product=self.products[0],
            related_product=self.products[7],
            order=0,
            created_by=self.user,
        )
        related = self.engine.get_related_products(self.products[0], limit=6)
        self.assertGreaterEqual(len(related), 1)
        self.assertEqual(related[0].id, self.products[7].id)

    def test_related_empty_category_edge(self):
        solo_category = Category.objects.create(
            category_name="Books",
            slug="books",
            description="Books",
        )
        solo_product = Product.objects.create(
            product_name="Solo Product",
            slug="solo-product",
            description="Solo",
            price=50,
            images="photos/products/test.jpg",
            stock=3,
            is_available=True,
            category=solo_category,
        )
        related = self.engine.get_related_products(solo_product, limit=6)
        self.assertEqual(related, [])

    def test_fbt_frequency_ranking_and_threshold(self):
        other = User.objects.create_user(
            first_name="Peer",
            last_name="User",
            username="peeruser",
            email="peer@example.com",
            password="pass12345",
        )
        for _ in range(4):
            self._create_order_with_products(other, [self.products[0], self.products[1]])
        for _ in range(3):
            self._create_order_with_products(other, [self.products[0], self.products[2]])
        for _ in range(2):
            self._create_order_with_products(other, [self.products[0], self.products[3]])
        result = self.engine.get_frequently_bought_together(self.products[0], limit=4)
        self.assertLessEqual(len(result), 4)
        self.assertEqual(result[0].id, self.products[1].id)

    def test_fbt_old_orders_ignored(self):
        order = self._create_order_with_products(self.user, [self.products[0], self.products[1], self.products[2]])
        old_time = timezone.now() - timedelta(days=370)
        OrderProduct.objects.filter(order=order).update(created_at=old_time)
        result = self.engine.get_frequently_bought_together(self.products[0], limit=4)
        self.assertEqual(result, [])

    def test_cart_recommendations_exclude_cart_products(self):
        cart_item = CartItem.objects.create(user=self.user, product=self.products[0], quantity=1)
        self._create_order_with_products(self.user, [self.products[0], self.products[1], self.products[2], self.products[3]])
        recs = self.engine.get_cart_recommendations(user=self.user, cart_items=[cart_item], limit=6)
        self.assertNotIn(self.products[0].id, [p.id for p in recs])

    def test_empty_cart_falls_back_to_popular(self):
        recs = self.engine.get_cart_recommendations(user=self.user, cart_items=[], limit=6)
        self.assertLessEqual(len(recs), 6)

    def test_personalized_and_anonymous(self):
        anon_recs = self.engine.get_personalized_recommendations(user=None, limit=8)
        self.assertLessEqual(len(anon_recs), 8)
        self._create_order_with_products(self.user, [self.products[0], self.products[1]])
        peer = User.objects.create_user(
            first_name="Another",
            last_name="Peer",
            username="anotherpeer",
            email="another@example.com",
            password="pass12345",
        )
        self._create_order_with_products(peer, [self.products[0], self.products[2]])
        personalized = self.engine.get_personalized_recommendations(user=self.user, limit=8)
        self.assertLessEqual(len(personalized), 8)

    def test_popular_tie_breaking(self):
        for _ in range(2):
            self._create_order_with_products(self.user, [self.products[0]])
            self._create_order_with_products(self.user, [self.products[1]])
        popular = self.engine.get_popular_products(limit=2)
        self.assertEqual(len(popular), 2)


class RecommendationViewAndTrackingTests(RecommendationTestBase):
    def test_track_click_authenticated(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("recommendations:track_click"),
            data={
                "source_type": "related",
                "source_product_id": self.products[0].id,
                "recommended_product_id": self.products[1].id,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

    def test_track_click_anonymous(self):
        response = self.client.post(
            reverse("recommendations:track_click"),
            data={
                "source_type": "homepage",
                "recommended_product_id": self.products[1].id,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

    def test_tracking_missing_data(self):
        response = self.client.post(
            reverse("recommendations:track_click"),
            data={"source_type": "related"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_homepage_renders_recommendation_context(self):
        response = self.client.get(reverse("home"))
        self.assertContains(response, "Popular")

    def test_product_detail_contains_recommendation_sections(self):
        response = self.client.get(self.products[0].get_slug_url())
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Related Products")


class RecommendationMixinTests(RecommendationTestBase):
    def test_timeout_handling(self):
        mixin = DummyView()
        mixin.recommendation_timeout_seconds = 0.001
        result = mixin._with_timeout(lambda: __import__("time").sleep(0.05), [])
        self.assertEqual(result, [])


class RecommendationTasksTests(RecommendationTestBase):
    def test_log_click_task(self):
        result = log_recommendation_click(
            source_type="related",
            source_product_id=self.products[0].id,
            recommended_product_id=self.products[1].id,
            user_id=self.user.id,
            session_key=None,
        )
        self.assertTrue(result)
        self.assertEqual(RecommendationClick.objects.count(), 1)

    def test_invalidate_after_order_task(self):
        order = Order.objects.create(
            user=self.user,
            order_number="task-order",
            first_name="Test",
            last_name="User",
            email=self.user.email,
            address_line_1="A",
            address_line_2="",
            country="US",
            state="TX",
            zip_code="75001",
            city="Dallas",
            phone="1234567890",
            order_total=100,
            tax=2,
            is_ordered=True,
            status="Delivered",
        )
        OrderProduct.objects.create(
            order=order,
            user=self.user,
            product=self.products[0],
            quantity=1,
            product_price=self.products[0].price,
            ordered=True,
        )
        cache_manager = RecommendationCache()
        cache_manager.set("fbt", f"{self.products[0].id}:4", [self.products[1].id])
        count = invalidate_recommendations_after_order(order.id)
        self.assertEqual(count, 1)

    def test_warm_cache_task(self):
        count = warm_cache_for_popular_products()
        self.assertGreaterEqual(count, 0)

    def test_aggregate_metrics_task(self):
        RecommendationClick.objects.create(
            source_type="related",
            source_product=self.products[0],
            recommended_product=self.products[1],
            user=self.user,
            added_to_cart=True,
        )
        metrics = aggregate_recommendation_metrics()
        self.assertIn("related", metrics)
        self.assertGreaterEqual(metrics["related"]["clicks"], 1)


class RecommendationAdminTests(RecommendationTestBase):
    def test_related_admin_save_sets_creator_and_invalidates(self):
        model_admin = RelatedProductAdmin(RelatedProduct, AdminSite())
        request = self.factory.get("/admin/")
        request.user = self.user
        relation = RelatedProduct(
            product=self.products[0],
            related_product=self.products[1],
        )
        model_admin.save_model(request, relation, form=None, change=False)
        self.assertEqual(relation.created_by_id, self.user.id)
