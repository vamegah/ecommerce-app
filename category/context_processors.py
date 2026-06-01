from .models import Category

def menu_links(request):
    """This function returns all category links for the menu."""
    # Fetch all categories from the database
    links = Category.objects.all()
    return dict(links=links) # This will be available in the template context as 'links'.
