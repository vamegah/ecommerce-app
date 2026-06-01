from django import forms
from .models import ReviewRating



class ReviewForm(forms.ModelForm):
    """
    A form for users to submit reviews for products.
    """

    class Meta:
        model = ReviewRating
        fields = ['subject', 'review', 'rating']
        # This line specifies the fields that should be included in the form.
        # In this case, the form includes the 'subject', 'review', and 'rating' fields.
        # These fields correspond to the fields in the ReviewRating model.
        # The form will be used to collect user input for these fields when submitting a review.