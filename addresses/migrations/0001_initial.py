import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ShippingAddress",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("street", models.CharField(max_length=255)),
                ("apartment", models.CharField(blank=True, max_length=100)),
                ("city", models.CharField(max_length=100)),
                ("state", models.CharField(blank=True, max_length=100)),
                ("postal_code", models.CharField(max_length=20)),
                ("country", models.CharField(max_length=80)),
                ("company_name", models.CharField(blank=True, max_length=120)),
                ("phone_number", models.CharField(blank=True, max_length=30)),
                ("is_default", models.BooleanField(default=False)),
                ("version", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="shipping_addresses", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("-is_default", "-created_at", "id"),
            },
        ),
        migrations.AddIndex(
            model_name="shippingaddress",
            index=models.Index(fields=["user", "is_default"], name="addr_user_default"),
        ),
        migrations.AddIndex(
            model_name="shippingaddress",
            index=models.Index(fields=["user", "created_at"], name="addr_user_created"),
        ),
        migrations.AddConstraint(
            model_name="shippingaddress",
            constraint=models.UniqueConstraint(condition=models.Q(("is_default", True)), fields=("user",), name="unique_default_shipping_address"),
        ),
    ]
