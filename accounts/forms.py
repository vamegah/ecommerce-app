from django import forms
from .models import Account, UserProfile

class RegistrationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput(attrs={
        'class': 'form-control',
        'placeholder': 'Enter Password'
    }))

    confirm_password = forms.CharField(widget=forms.PasswordInput(attrs={
        'class': 'form-control',
        'placeholder': 'Confirm Password'
    }))

    class Meta:
        model = Account
        fields = ['first_name', 'last_name', 'phone_number', 'email', 'password']

    def __init__(self, *args, **kwargs):
        super(RegistrationForm, self).__init__(*args, **kwargs)
        self.fields['first_name'].widget.attrs['placeholder'] = 'Enter First Name'
        self.fields['last_name'].widget.attrs['placeholder'] = 'Enter Last Name'
        self.fields['email'].widget.attrs['placeholder'] = 'Enter Email'
        self.fields['phone_number'].widget.attrs['placeholder'] = 'Enter Phone Number'
        for field in self.fields:
            self.fields[field].widget.attrs['class'] = 'form-control'

    def clean(self):
        cleaned_data = super(RegistrationForm, self).clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")

        if password != confirm_password:
            raise forms.ValidationError(
                "Password does not match!"
            )


# # List of states (You can modify or extend this list as needed)
# STATE_CHOICES = [
#     ('', 'Select a State'),  # Default placeholder option
#     ('AL', 'Alabama'),
#     ('AK', 'Alaska'),
#     ('AZ', 'Arizona'),
#     ('AR', 'Arkansas'),
#     ('CA', 'California'),
#     ('CO', 'Colorado'),
#     ('CT', 'Connecticut'),
#     ('DE', 'Delaware'),
#     ('FL', 'Florida'),
#     ('GA', 'Georgia'),
#     ('HI', 'Hawaii'),
#     ('ID', 'Idaho'),
#     ('IL', 'Illinois'),
#     ('IN', 'Indiana'),
#     ('IA', 'Iowa'),
#     ('KS', 'Kansas'),
#     ('KY', 'Kentucky'),
#     ('LA', 'Louisiana'),
#     ('ME', 'Maine'),
#     ('MD', 'Maryland'),
#     ('MA', 'Massachusetts'),
#     ('MI', 'Michigan'),
#     ('MN', 'Minnesota'),
#     ('MS', 'Mississippi'),
#     ('MO', 'Missouri'),
#     ('MT', 'Montana'),
#     ('NE', 'Nebraska'),
#     ('NV', 'Nevada'),
#     ('NH', 'New Hampshire'),
#     ('NJ', 'New Jersey'),
#     ('NM', 'New Mexico'),
#     ('NY', 'New York'),
#     ('NC', 'North Carolina'),
#     ('ND', 'North Dakota'),
#     ('OH', 'Ohio'),
#     ('OK', 'Oklahoma'),
#     ('OR', 'Oregon'),
#     ('PA', 'Pennsylvania'),
#     ('RI', 'Rhode Island'),
#     ('SC', 'South Carolina'),
#     ('SD', 'South Dakota'),
#     ('TN', 'Tennessee'),
#     ('TX', 'Texas'),
#     ('UT', 'Utah'),
#     ('VT', 'Vermont'),
#     ('VA', 'Virginia'),
#     ('WA', 'Washington'),
#     ('WV', 'West Virginia'),
#     ('WI', 'Wisconsin'),
#     ('WY', 'Wyoming'),
# ]

class UserForm(forms.ModelForm):
    class Meta:
        model = Account
        fields = ('first_name', 'last_name', 'phone_number')
    
    def __init__(self, *args, **kwargs):
        super(UserForm, self).__init__(*args, **kwargs)
        for field in self.fields:
            self.fields[field].widget.attrs['class'] = 'form-control'
            self.fields[field].widget.attrs['readonly'] = True
            self.fields[field].widget.attrs['style'] = 'background-color: #eee'
            self.fields['phone_number'].widget.attrs['readonly'] = True
            self.fields['phone_number'].widget.attrs['style'] = 'background-color: #eee'
            self.fields['first_name'].widget.attrs['readonly'] = True
            self.fields['first_name'].widget.attrs['style'] = 'background-color: #eee'
            self.fields['last_name'].widget.attrs['readonly'] = True
            self.fields['last_name'].widget.attrs['style'] = 'background-color: #eee'

class UserProfileForm(forms.ModelForm):
    profile_picture = forms.ImageField(required=False, error_messages = {'invalid':("Image files only")}, widget=forms.FileInput)
    #state = forms.ChoiceField(choices=STATE_CHOICES, required=True, widget=forms.Select(attrs={'class': 'form-control'})) # This is how you can add a dropdown list of states to the form
    class Meta:
        model = UserProfile
        fields = ('address_line_1', 'address_line_2', 'profile_picture', 'city', 'state', 'country', 'zip_code')
    
    def __init__(self, *args, **kwargs):
        super(UserProfileForm, self).__init__(*args, **kwargs)
        for field in self.fields:
            self.fields[field].widget.attrs['class'] = 'form-control'
            self.fields['address_line_1'].widget.attrs['placeholder'] = 'Enter Address Line 1'
            self.fields['address_line_2'].widget.attrs['placeholder'] = 'Enter Address Line 2'
            self.fields['city'].widget.attrs['placeholder'] = 'Enter City'
            self.fields['state'].widget.attrs['placeholder'] = 'Enter State'
            self.fields['country'].widget.attrs['placeholder'] = 'Enter Country'
            self.fields['zip_code'].widget.attrs['placeholder'] = 'Enter Zipcode'