from django.db import models
from django.core.exceptions import ValidationError
from accounts.models import Account
from orders.models import Order


class Coupon(models.Model):
    """
    Coupon model for discount codes/coupons system.
    Stores coupon configuration and rules.
    """
    DISCOUNT_TYPE_CHOICES = [
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    ]
    
    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    minimum_order_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_usage_limit = models.IntegerField(null=True, blank=True)
    max_usage_per_user = models.IntegerField(null=True, blank=True)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def clean(self):
        """
        Validates discount_value based on discount_type.
        - Percentage discounts: 0 < discount_value <= 100
        - Fixed discounts: discount_value > 0
        """
        super().clean()
        
        if self.discount_type == 'percentage':
            if self.discount_value <= 0 or self.discount_value > 100:
                raise ValidationError({
                    'discount_value': 'Percentage discount must be between 0 and 100.'
                })
        elif self.discount_type == 'fixed':
            if self.discount_value <= 0:
                raise ValidationError({
                    'discount_value': 'Fixed discount must be greater than 0.'
                })
        
        # Validate date range
        if self.valid_from and self.valid_to and self.valid_from >= self.valid_to:
            raise ValidationError({
                'valid_to': 'Valid to date must be after valid from date.'
            })
    
    def save(self, *args, **kwargs):
        """
        Converts code to uppercase before saving.
        """
        self.code = self.code.upper()
        self.full_clean()  # Run validation
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.code


class Redemption(models.Model):
    """
    Redemption model for tracking coupon usage history.
    Records each instance of a coupon being applied to an order.
    """
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='redemptions')
    user = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True)
    order = models.OneToOneField(Order, on_delete=models.CASCADE)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    redeemed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-redeemed_at']
        indexes = [
            models.Index(fields=['coupon', 'user']),
            models.Index(fields=['coupon']),
        ]
    
    def __str__(self):
        return f"{self.coupon.code} - {self.order.order_number}"
