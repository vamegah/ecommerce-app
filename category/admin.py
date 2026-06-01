from django.contrib import admin
from .models import Category  # Import the Category model from the current directory's models.py file

# Register your models here.

class CategoryAdmin(admin.ModelAdmin):

    prepopulated_fields = {'slug': ('category_name',)}  # Automatically populate the slug field from category_name
    list_display = ('category_name', 'slug')  # Display these fields in the admin list view


admin.site.register(Category, CategoryAdmin)  # Register the Category model with the admin site
# This allows you to manage Category objects through the Django admin interface.
