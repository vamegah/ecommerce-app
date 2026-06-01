from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0005_order_coupon_fields"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="orderproduct",
            index=models.Index(
                fields=["product", "order"], name="orders_prod_order_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="orderproduct",
            index=models.Index(
                fields=["order", "product"], name="orders_order_prod_idx"
            ),
        ),
    ]
