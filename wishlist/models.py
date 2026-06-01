from django.db import models

from accounts.models import Account
from store.models import Product


class Wishlist(models.Model):
    user = models.OneToOneField(Account, on_delete=models.CASCADE, related_name="wishlist")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wishlist({self.user.email})"

    def get_items_count(self):
        return self.items.count()

    def contains_product(self, product):
        return self.items.filter(product=product).exists()


class WishlistItem(models.Model):
    wishlist = models.ForeignKey(Wishlist, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="wishlist_items")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("wishlist", "product")
        ordering = ["-added_at"]
        indexes = [
            models.Index(fields=["wishlist", "product"], name="wishlist_item_pair_idx"),
            models.Index(fields=["added_at"], name="wishlist_item_added_idx"),
        ]

    def __str__(self):
        return f"{self.wishlist.user.email} -> {self.product.product_name}"
