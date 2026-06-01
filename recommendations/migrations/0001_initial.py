# Generated migration for recommendations app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('store', '0008_alter_productgallery_options'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='RelatedProduct',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=0, help_text='Display order (lower numbers first)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='manual_related_from', to='store.product')),
                ('related_product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='manual_related_to', to='store.product')),
            ],
            options={
                'db_table': 'related_products',
                'ordering': ['order', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RecommendationClick',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_key', models.CharField(blank=True, help_text='Session key for anonymous users', max_length=40, null=True)),
                ('source_type', models.CharField(choices=[('related', 'Related Products'), ('fbt', 'Frequently Bought Together'), ('cart', 'Cart Recommendations'), ('homepage', 'Homepage Recommendations')], max_length=20)),
                ('clicked_at', models.DateTimeField(auto_now_add=True)),
                ('added_to_cart', models.BooleanField(default=False, help_text='Whether user added product to cart after click')),
                ('recommended_product', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recommendation_target', to='store.product')),
                ('source_product', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recommendation_source', to='store.product')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'recommendation_clicks',
            },
        ),
        migrations.AddIndex(
            model_name='relatedproduct',
            index=models.Index(fields=['product', 'order'], name='related_pro_product_c8e8e5_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='relatedproduct',
            unique_together={('product', 'related_product')},
        ),
        migrations.AddIndex(
            model_name='recommendationclick',
            index=models.Index(fields=['source_type', 'clicked_at'], name='recommendat_source__e8f8a5_idx'),
        ),
        migrations.AddIndex(
            model_name='recommendationclick',
            index=models.Index(fields=['user', 'clicked_at'], name='recommendat_user_id_a5e8f5_idx'),
        ),
        migrations.AddIndex(
            model_name='recommendationclick',
            index=models.Index(fields=['recommended_product', 'clicked_at'], name='recommendat_recomme_b8f8a5_idx'),
        ),
    ]
