from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("store", "0008_alter_productgallery_options"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["category", "is_available"], name="store_prod_cat_avail_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["is_available", "stock"], name="store_prod_avail_stock_idx"
            ),
        ),
    ]
