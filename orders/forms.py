from django import forms
from .models import Order


class OrderForm(forms.ModelForm):
    selected_address_id = forms.UUIDField(required=False)
    save_checkout_address = forms.BooleanField(required=False)
    state = forms.CharField(required=False)

    class Meta:
         model = Order
         fields = ['first_name', 'last_name', 'phone', 'email', 'address_line_1', 'address_line_2', 'country', 'zip_code', 'state', 'city']
