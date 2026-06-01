import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class ShippingAddress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shipping_addresses",
    )
    street = models.CharField(max_length=255)
    apartment = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=80)
    company_name = models.CharField(max_length=120, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    is_default = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-is_default", "-created_at", "id")
        indexes = (
            models.Index(fields=("user", "is_default"), name="addr_user_default"),
            models.Index(fields=("user", "created_at"), name="addr_user_created"),
        )
        constraints = (
            models.UniqueConstraint(
                fields=("user",),
                condition=Q(is_default=True),
                name="unique_default_shipping_address",
            ),
        )

    def __str__(self):
        return f"{self.street}, {self.city} ({self.user_id})"

    def to_dict(self):
        return {
            "id": str(self.id),
            "userId": str(self.user_id),
            "street": self.street,
            "apartment": self.apartment,
            "city": self.city,
            "state": self.state,
            "postalCode": self.postal_code,
            "country": self.country,
            "companyName": self.company_name,
            "phoneNumber": self.phone_number,
            "isDefault": self.is_default,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }
