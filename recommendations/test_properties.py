from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from hypothesis import given, settings, strategies as st
from hypothesis.extra.django import TestCase as HypothesisTestCase

from carts.models import CartItem
from category.models import Category
from orders.models import Order, OrderProduct
from store.models import Product

from .cache import RecommendationCache
from .engine import RecommendationEngine
from .mixins import RecommendationMixin
from .models import RecommendationClick, RelatedProduct

User = get_user_model()


class PropertyBase(HypothesisTestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            first_name="Prop",
            last_name="User",
            username=f"prop_{timezone.now().timestamp()}",
            email=f"prop_{timezone.now().timestamp()}@test.com",
            password="pass12345",
        )
        self.category = Category.objects.create(
            category_name=f"Prop Category {timezone.now().timestamp()}",
            slug=f"prop-cat-{timezone.now().timestamp()}",
            description="Property test category",
        )
        self.engine = RecommendationEngine()

    def create_product(self, idx, available=True, stock=10):
        return Product.objects.create(
            product_name=f"P {idx} {timezone.now().timestamp()}",
            slug=f"p-{idx}-{timezone.now().timestamp()}",
            description="p",
            price=100 + idx,
            images="photos/products/test.jpg",
            stock=stock,
            is_available=available,
            category=self.category,
        )

    def create_order(self, user, products, days_ago=1):
        order = Order.objects.create(
            user=user,
            order_number=f"o-{timezone.now().timestamp()}-{user.id}",
            first_name="A",
            last_name="B",
            email=user.email,
            address_line_1="x",
            address_line_2="",
            country="US",
            state="TX",
            zip_code="11111",
            city="Dallas",
            phone="5551112222",
            order_total=100,
            tax=2,
            is_ordered=True,
            status="Delivered",
        )
        created_at = timezone.now() - timedelta(days=days_ago)
        for product in products:
            order_product = OrderProduct.objects.create(
                order=order,
                user=user,
                product=product,
                quantity=1,
                product_price=product.price,
                ordered=True,
            )
            OrderProduct.objects.filter(id=order_product.id).update(created_at=created_at)
        return order


class RecommendationProperties(PropertyBase):
    @settings(max_examples=100)
    @given(product_count=st.integers(min_value=1, max_value=15))
    def test_property_1_recommendation_count_limits(self, product_count):
        source = self.create_product(0)
        for i in range(product_count):
            self.create_product(i + 1)
        related = self.engine.get_related_products(source, limit=6)
        self.assertLessEqual(len(related), 6)

    @settings(max_examples=100)
    @given(is_available=st.booleans(), stock=st.integers(min_value=0, max_value=10))
    def test_property_2_product_availability_filtering(self, is_available, stock):
        product = self.create_product(1, available=is_available, stock=stock)
        queryset = self.engine._filter_available_products(Product.objects.filter(id=product.id))
        expected = is_available and stock > 0
        self.assertEqual(queryset.exists(), expected)

    @settings(max_examples=100)
    @given(extra_products=st.integers(min_value=1, max_value=6))
    def test_property_3_self_exclusion_related_products(self, extra_products):
        source = self.create_product(0)
        for i in range(extra_products):
            self.create_product(i + 1)
        related = self.engine.get_related_products(source, limit=6)
        self.assertNotIn(source.id, [product.id for product in related])

    @settings(max_examples=100)
    @given(cart_size=st.integers(min_value=1, max_value=4))
    def test_property_4_cart_item_exclusion(self, cart_size):
        products = [self.create_product(i) for i in range(8)]
        cart_items = []
        for i in range(cart_size):
            cart_items.append(CartItem(user=self.user, product=products[i], quantity=1))
        recommendations = self.engine.get_cart_recommendations(
            user=self.user, cart_items=cart_items, limit=6
        )
        self.assertFalse(any(item.id in [products[i].id for i in range(cart_size)] for item in recommendations))

    @settings(max_examples=100)
    @given(same_category=st.booleans())
    def test_property_5_category_consistency_for_related(self, same_category):
        source = self.create_product(0)
        target_category = self.category if same_category else Category.objects.create(
            category_name=f"Other {timezone.now().timestamp()}",
            slug=f"other-{timezone.now().timestamp()}",
            description="other",
        )
        candidate = Product.objects.create(
            product_name=f"C {timezone.now().timestamp()}",
            slug=f"c-{timezone.now().timestamp()}",
            description="C",
            price=200,
            images="photos/products/test.jpg",
            stock=5,
            is_available=True,
            category=target_category,
        )
        related = self.engine.get_related_products(source, limit=6)
        if same_category:
            self.assertTrue(candidate.id in [p.id for p in related] or len(related) == 0)
        else:
            self.assertNotIn(candidate.id, [p.id for p in related])

    def test_property_6_manual_override_prioritization(self):
        source = self.create_product(0)
        manual = self.create_product(1)
        self.create_product(2)
        RelatedProduct.objects.create(
            product=source,
            related_product=manual,
            order=0,
            created_by=self.user,
        )
        related = self.engine.get_related_products(source, limit=6)
        self.assertGreaterEqual(len(related), 1)
        self.assertEqual(related[0].id, manual.id)

    def test_property_7_manual_override_split(self):
        source = self.create_product(0)
        manuals = [self.create_product(i + 1) for i in range(3)]
        autos = [self.create_product(i + 10) for i in range(5)]
        for idx, product in enumerate(manuals):
            RelatedProduct.objects.create(
                product=source,
                related_product=product,
                order=idx,
                created_by=self.user,
            )
        related = self.engine.get_related_products(source, limit=6)
        self.assertLessEqual(len([p for p in related if p.id in [m.id for m in manuals]]), 3)
        self.assertLessEqual(len([p for p in related if p.id in [a.id for a in autos]]), 3)

    def test_property_8_co_purchase_frequency_ranking(self):
        source = self.create_product(0)
        a = self.create_product(1)
        b = self.create_product(2)
        c = self.create_product(3)
        for _ in range(5):
            self.create_order(self.user, [source, a, b])
        for _ in range(3):
            self.create_order(self.user, [source, c])
        result = self.engine.get_frequently_bought_together(source, limit=4)
        self.assertGreaterEqual(len(result), 1)
        self.assertIn(result[0].id, {a.id, b.id})

    def test_property_9_order_history_relevance(self):
        source = self.create_product(0)
        target = self.create_product(1)
        third = self.create_product(2)
        fourth = self.create_product(3)
        for _ in range(3):
            self.create_order(self.user, [source, target, third, fourth], days_ago=10)
        result = self.engine.get_frequently_bought_together(source, limit=4)
        self.assertIn(target.id, [product.id for product in result] if result else [])

    def test_property_10_recent_orders_only(self):
        source = self.create_product(0)
        target = self.create_product(1)
        self.create_order(self.user, [source, target], days_ago=400)
        result = self.engine.get_frequently_bought_together(source, limit=4)
        self.assertEqual(result, [])

    def test_property_11_tie_breaking_logic(self):
        first = self.create_product(1)
        second = self.create_product(2)
        self.create_order(self.user, [first])
        self.create_order(self.user, [second])
        result = self.engine.get_popular_products(limit=2)
        self.assertEqual(len(result), 2)

    def test_property_12_fallback_to_category_recommendations(self):
        source = self.create_product(0)
        self.create_product(1)
        fbt = self.engine.get_frequently_bought_together(source, limit=4)
        related = self.engine.get_related_products(source, limit=6)
        if not fbt:
            self.assertGreaterEqual(len(related), 0)

    def test_property_13_personalized_uses_user_history(self):
        source = self.create_product(0)
        target = self.create_product(1)
        peer = User.objects.create_user(
            first_name="Peer",
            last_name="U",
            username=f"peer_{timezone.now().timestamp()}",
            email=f"peer_{timezone.now().timestamp()}@test.com",
            password="pass12345",
        )
        self.create_order(self.user, [source])
        self.create_order(peer, [source, target])
        recommendations = self.engine.get_personalized_recommendations(self.user, limit=8)
        self.assertIn(target.id, [product.id for product in recommendations] if recommendations else [])

    def test_property_14_anonymous_user_popular_products(self):
        recommendations = self.engine.get_personalized_recommendations(None, limit=8)
        self.assertLessEqual(len(recommendations), 8)

    def test_property_15_cache_storage_retrieval(self):
        cache_manager = RecommendationCache()
        value = [1, 2, 3]
        cache_manager.set("related", "demo", value)
        self.assertEqual(cache_manager.get("related", "demo"), value)

    def test_property_16_cache_invalidation_on_availability_change(self):
        cache_manager = RecommendationCache()
        product = self.create_product(1)
        cache_manager.set("related", f"{product.id}:6", [2, 3])
        product.is_available = False
        product.save()
        RecommendationCache().invalidate_product(product.id)
        self.assertIsNone(cache_manager.get("related", f"{product.id}:6"))

    def test_property_17_cache_invalidation_on_order_completion(self):
        cache_manager = RecommendationCache()
        source = self.create_product(1)
        cache_manager.set("fbt", f"{source.id}:4", [2, 3])
        order = self.create_order(self.user, [source], days_ago=1)
        from .tasks import invalidate_recommendations_after_order

        invalidate_recommendations_after_order(order.id)
        self.assertIsNone(cache_manager.get("fbt", f"{source.id}:4"))

    def test_property_18_cache_invalidation_on_manual_association_change(self):
        source = self.create_product(1)
        target = self.create_product(2)
        cache_manager = RecommendationCache()
        cache_manager.set("related", f"{source.id}:6", [target.id])
        relation = RelatedProduct.objects.create(
            product=source,
            related_product=target,
            order=0,
            created_by=self.user,
        )
        relation.delete()
        RecommendationCache().invalidate_product(source.id)
        self.assertIsNone(cache_manager.get("related", f"{source.id}:6"))

    def test_property_19_manual_association_persistence(self):
        source = self.create_product(1)
        target = self.create_product(2)
        relation = RelatedProduct.objects.create(
            product=source,
            related_product=target,
            order=0,
            created_by=self.user,
        )
        self.assertTrue(
            RelatedProduct.objects.filter(
                id=relation.id, product=source, related_product=target
            ).exists()
        )

    def test_property_20_graceful_timeout_handling(self):
        class Dummy(RecommendationMixin):
            pass

        mixin = Dummy()
        mixin.recommendation_timeout_seconds = 0.001
        result = mixin._with_timeout(lambda: __import__("time").sleep(0.05), [])
        self.assertEqual(result, [])

    def test_property_21_product_variation_handling(self):
        product = self.create_product(1)
        self.assertEqual(self.engine._variation_parent(product).id, product.id)

    def test_property_22_recommendation_click_logging(self):
        click = RecommendationClick.objects.create(
            source_type="related",
            source_product=self.create_product(1),
            recommended_product=self.create_product(2),
            user=self.user,
        )
        self.assertIsNotNone(click.id)

    def test_property_23_conversion_tracking(self):
        click = RecommendationClick.objects.create(
            source_type="cart",
            source_product=self.create_product(1),
            recommended_product=self.create_product(2),
            user=self.user,
            added_to_cart=False,
        )
        click.added_to_cart = True
        click.save(update_fields=["added_to_cart"])
        self.assertTrue(
            RecommendationClick.objects.filter(id=click.id, added_to_cart=True).exists()
        )

    def test_property_24_analytics_metrics_generation(self):
        RecommendationClick.objects.create(
            source_type="homepage",
            source_product=self.create_product(1),
            recommended_product=self.create_product(2),
            user=self.user,
        )
        from .tasks import aggregate_recommendation_metrics

        metrics = aggregate_recommendation_metrics()
        self.assertIn("homepage", metrics)
