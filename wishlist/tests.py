from django.contrib.auth import get_user_model
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse
from hypothesis import given, settings, strategies as st
from hypothesis.extra.django import TestCase as HypothesisTestCase

from carts.models import CartItem
from category.models import Category
from store.models import Product, Variation
from wishlist.context_processors import wishlist_count
from wishlist.models import Wishlist, WishlistItem


User = get_user_model()


class WishlistBase:
    def create_user(self, suffix="1"):
        unique = str(__import__("time").time_ns())
        user = User.objects.create_user(
            first_name="User",
            last_name="Test",
            username=f"user_{suffix}_{unique}",
            email=f"user_{suffix}_{unique}@test.com",
            password="pass12345",
        )
        user.is_active = True
        user.save(update_fields=["is_active"])
        return user

    def create_product(self, category, idx=1, stock=10, available=True):
        unique = str(__import__("time").time_ns())
        return Product.objects.create(
            product_name=f"Product {idx} {unique}",
            slug=f"product-{idx}-{available}-{stock}-{unique}",
            description="Description",
            price=100 + idx,
            images="photos/products/test.jpg",
            stock=stock,
            is_available=available,
            category=category,
        )


class WishlistPropertyTests(HypothesisTestCase, WishlistBase):
    def setUp(self):
        self.client = Client()
        unique = str(__import__("time").time_ns())
        self.user = self.create_user(f"prop_{unique}")
        self.category = Category.objects.create(
            category_name=f"Wishlist Category {unique}",
            slug=f"wishlist-category-{unique}",
            description="Category",
        )
        self.product = self.create_product(self.category, idx=1)

    @settings(max_examples=100)
    @given(iterations=st.integers(min_value=1, max_value=5))
    def test_property_1_wishlist_item_creation(self, iterations):
        wishlist, _ = Wishlist.objects.get_or_create(user=self.user)
        for _ in range(iterations):
            WishlistItem.objects.get_or_create(wishlist=wishlist, product=self.product)
        self.assertEqual(WishlistItem.objects.filter(wishlist=wishlist, product=self.product).count(), 1)

    @settings(max_examples=100)
    @given(iterations=st.integers(min_value=1, max_value=10))
    def test_property_2_idempotent_add_operations(self, iterations):
        self.client.force_login(self.user)
        for _ in range(iterations):
            self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        wishlist = Wishlist.objects.get(user=self.user)
        self.assertEqual(wishlist.get_items_count(), 1)

    @settings(max_examples=100)
    @given(extra_products=st.integers(min_value=0, max_value=6))
    def test_property_3_wishlist_count_accuracy(self, extra_products):
        wishlist, _ = Wishlist.objects.get_or_create(user=self.user)
        products = [self.product]
        for idx in range(extra_products):
            products.append(self.create_product(self.category, idx=idx + 20))
        for product in products:
            WishlistItem.objects.get_or_create(wishlist=wishlist, product=product)
        self.assertEqual(wishlist.get_items_count(), len(products))

    def test_property_5_wishlist_page_completeness(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        response = self.client.get(reverse("wishlist"))
        self.assertContains(response, self.product.product_name)
        self.assertContains(response, "Remove")
        self.assertContains(response, "Add to Cart")

    def test_property_6_product_availability_display(self):
        out_stock = self.create_product(self.category, idx=99, stock=0, available=False)
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[out_stock.id]))
        response = self.client.get(reverse("wishlist"))
        self.assertContains(response, "Out of stock")

    def test_property_7_remove_button_presence(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        response = self.client.get(reverse("wishlist"))
        self.assertContains(response, "wishlist-remove-btn")

    def test_property_8_wishlist_icon_state_reflects_membership(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        response = self.client.get(self.product.get_slug_url())
        self.assertContains(response, "wishlist-toggle-btn active")

    def test_property_9_toggle_add_remove_behavior(self):
        self.client.force_login(self.user)
        add_resp = self.client.post(reverse("add_to_wishlist", args=[self.product.id])).json()
        remove_resp = self.client.post(reverse("remove_from_wishlist", args=[self.product.id])).json()
        self.assertTrue(add_resp["in_wishlist"])
        self.assertFalse(remove_resp["in_wishlist"])

    def test_property_10_add_to_cart_from_wishlist(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        self.client.post(reverse("add_to_cart", args=[self.product.id]))
        self.assertTrue(CartItem.objects.filter(user=self.user, product=self.product).exists())

    def test_property_11_wishlist_persistence_after_cart_addition(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        self.client.post(reverse("add_to_cart", args=[self.product.id]))
        wishlist = Wishlist.objects.get(user=self.user)
        self.assertTrue(wishlist.contains_product(self.product))

    def test_property_12_wishlist_persistence_across_sessions(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        self.client.logout()
        self.client.force_login(self.user)
        response = self.client.get(reverse("wishlist"))
        self.assertContains(response, self.product.product_name)

    def test_property_13_product_deletion_cascade(self):
        self.assertEqual(WishlistItem._meta.get_field("product").remote_field.on_delete.__name__, "CASCADE")

    def test_property_14_user_deletion_cascade(self):
        self.assertEqual(Wishlist._meta.get_field("user").remote_field.on_delete.__name__, "CASCADE")

    def test_property_15_wishlist_isolation(self):
        user2 = self.create_user("second")
        wishlist1, _ = Wishlist.objects.get_or_create(user=self.user)
        wishlist2, _ = Wishlist.objects.get_or_create(user=user2)
        WishlistItem.objects.create(wishlist=wishlist1, product=self.product)
        self.assertFalse(wishlist2.contains_product(self.product))


class WishlistViewAndContextTests(TestCase, WishlistBase):
    def setUp(self):
        self.client = Client()
        unique = str(__import__("time").time_ns())
        self.user = self.create_user(f"unit_{unique}")
        self.category = Category.objects.create(
            category_name=f"Wishlist Unit Category {unique}",
            slug=f"wishlist-unit-category-{unique}",
            description="Category",
        )
        self.product = self.create_product(self.category, idx=2)

    def test_unauthenticated_wishlist_page_redirects(self):
        response = self.client.get(reverse("wishlist"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response.url)

    def test_unauthenticated_api_calls_return_401(self):
        response = self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        self.assertEqual(response.status_code, 401)

    def test_nonexistent_product_returns_404(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("add_to_wishlist", args=[999999]))
        self.assertEqual(response.status_code, 404)

    def test_duplicate_add_message(self):
        self.client.force_login(self.user)
        first = self.client.post(reverse("add_to_wishlist", args=[self.product.id])).json()
        second = self.client.post(reverse("add_to_wishlist", args=[self.product.id])).json()
        self.assertIn("Added", first["message"])
        self.assertIn("already", second["message"])

    def test_remove_and_count_updates(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        payload = self.client.post(reverse("remove_from_wishlist", args=[self.product.id])).json()
        self.assertEqual(payload["wishlist_count"], 0)

    def test_check_wishlist_status(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_wishlist", args=[self.product.id]))
        payload = self.client.get(reverse("check_wishlist_status", args=[self.product.id])).json()
        self.assertTrue(payload["in_wishlist"])
        self.assertEqual(payload["wishlist_count"], 1)

    def test_empty_wishlist_state(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("wishlist"))
        self.assertContains(response, "Your wishlist is empty")

    def test_out_of_stock_indicator(self):
        self.client.force_login(self.user)
        out_stock = self.create_product(self.category, idx=77, stock=0, available=False)
        self.client.post(reverse("add_to_wishlist", args=[out_stock.id]))
        response = self.client.get(reverse("wishlist"))
        self.assertContains(response, "Out of stock")

    def test_context_processor_authenticated(self):
        wishlist, _ = Wishlist.objects.get_or_create(user=self.user)
        WishlistItem.objects.create(wishlist=wishlist, product=self.product)
        request = RequestFactory().get("/")
        request.user = self.user
        context = wishlist_count(request)
        self.assertEqual(context["wishlist_count"], 1)

    def test_context_processor_unauthenticated(self):
        request = RequestFactory().get("/")
        request.user = type("Anon", (), {"is_authenticated": False})()
        context = wishlist_count(request)
        self.assertEqual(context["wishlist_count"], 0)

    def test_variation_product_requires_redirect_behavior_signal(self):
        self.client.force_login(self.user)
        product = self.create_product(self.category, idx=88)
        Variation.objects.create(
            product=product,
            variation_category="color",
            variation_value="Red",
            is_active=True,
        )
        self.client.post(reverse("add_to_wishlist", args=[product.id]))
        response = self.client.get(reverse("wishlist"))
        self.assertContains(response, 'data-has-variations="true"')

    def test_login_next_redirect_path_for_wishlist_action(self):
        response = self.client.post(
            reverse("login"),
            data={"email": self.user.email, "password": "pass12345"},
            HTTP_REFERER=f"http://testserver/accounts/login/?next=/store/&wishlist_action=add&product_id={self.product.id}",
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "/store/")
        wishlist = Wishlist.objects.get(user=self.user)
        self.assertTrue(wishlist.contains_product(self.product))
