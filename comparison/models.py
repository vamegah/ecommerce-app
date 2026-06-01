import secrets
from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone


def shared_expiration():
    return timezone.now() + timedelta(days=30)


def generate_share_id():
    return secrets.token_urlsafe(24)[:32]


class SavedComparison(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="saved_comparisons",
    )
    session_key = models.CharField(max_length=64, blank=True, db_index=True)
    product_ids = models.JSONField(default=list)
    snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "-updated_at"]),
            models.Index(fields=["session_key", "-updated_at"]),
        ]

    def __str__(self):
        owner = self.user.email if self.user_id else self.session_key or "anonymous"
        return f"Comparison for {owner}"


class SharedComparison(models.Model):
    share_id = models.CharField(
        max_length=32,
        primary_key=True,
        default=generate_share_id,
        editable=False,
    )
    comparison_snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=shared_expiration, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()

    def __str__(self):
        return self.share_id
