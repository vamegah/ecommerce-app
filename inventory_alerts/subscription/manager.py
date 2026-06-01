from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from inventory_alerts.errors import DuplicateError, NotFoundError, ValidationError
from inventory_alerts.models import AuditLog, Subscription
from inventory_alerts.validators import get_product_or_error, normalize_email, sanitize_input, validate_status


class SubscriptionManager:
    def create_subscription(self, user_id=None, product_id=None, email=None, *, user=None, send_confirmation=True):
        product = get_product_or_error(product_id)
        normalized_email = normalize_email(email)
        account = self._resolve_user(user if user is not None else user_id)

        duplicate_query = Subscription.objects.filter(
            product=product,
            email=normalized_email,
            status=Subscription.STATUS_ACTIVE,
        )
        if account:
            duplicate_query = duplicate_query | Subscription.objects.filter(
                product=product,
                user=account,
                status=Subscription.STATUS_ACTIVE,
            )
        if duplicate_query.exists():
            raise DuplicateError("An active subscription already exists for this product.")

        try:
            with transaction.atomic():
                subscription = Subscription.objects.create(
                    user=account,
                    product=product,
                    email=normalized_email,
                    status=Subscription.STATUS_ACTIVE,
                )
                self._audit(
                    AuditLog.EVENT_SUBSCRIPTION_CREATED,
                    subscription.id,
                    email=subscription.email,
                    product_id=product.id,
                    user_id=account.id if account else None,
                )
        except IntegrityError as exc:
            raise DuplicateError("An active subscription already exists for this product.") from exc

        if send_confirmation:
            from inventory_alerts.notification.service import NotificationService

            NotificationService().send_confirmation(subscription, event="created")
        return subscription

    def remove_subscription(self, subscription_id, *, send_confirmation=True, reason="user_unsubscribe"):
        try:
            subscription = Subscription.objects.select_related("product").get(pk=subscription_id)
        except (Subscription.DoesNotExist, ValueError, TypeError):
            return False
        email = subscription.email
        product = subscription.product
        subscription.delete()
        self._audit(
            AuditLog.EVENT_SUBSCRIPTION_CANCELLED,
            subscription_id,
            email=email,
            product_id=product.id,
            reason=reason,
        )
        if send_confirmation:
            from inventory_alerts.notification.service import NotificationService

            NotificationService().send_unsubscribe_confirmation(email=email, product=product)
        return True

    def unsubscribe_by_token(self, token):
        try:
            subscription = Subscription.objects.get(unsubscribe_token=token)
        except (Subscription.DoesNotExist, ValueError, TypeError) as exc:
            raise NotFoundError("Subscription was not found.") from exc
        return self.remove_subscription(subscription.id, send_confirmation=True, reason="unsubscribe_link")

    def get_subscriptions_by_product(self, product_id, status=Subscription.STATUS_ACTIVE):
        product = get_product_or_error(product_id)
        queryset = Subscription.objects.filter(product=product)
        cleaned_status = validate_status(status, {choice[0] for choice in Subscription.STATUS_CHOICES})
        if cleaned_status:
            queryset = queryset.filter(status=cleaned_status)
        return queryset.select_related("product", "user").order_by("-created_at")

    def get_subscriptions_by_user(self, user_id):
        user = self._resolve_user(user_id)
        if user is None:
            raise NotFoundError("User was not found.")
        return Subscription.objects.filter(user=user).select_related("product", "user").order_by("-created_at")

    def subscription_exists(self, user_id=None, product_id=None, email=None):
        product = get_product_or_error(product_id)
        queryset = Subscription.objects.filter(product=product, status=Subscription.STATUS_ACTIVE)
        if email:
            queryset = queryset.filter(email=normalize_email(email))
        if user_id:
            user = self._resolve_user(user_id)
            queryset = queryset.filter(user=user)
        return queryset.exists()

    def mark_as_notified(self, subscription_id, notification_id=None):
        try:
            subscription = Subscription.objects.get(pk=subscription_id)
        except (Subscription.DoesNotExist, ValueError, TypeError) as exc:
            raise NotFoundError("Subscription was not found.") from exc
        subscription.mark_notified(notification_id=notification_id)
        return subscription

    def complete_subscription(self, subscription_id):
        return self.mark_as_notified(subscription_id)

    def archive_completed_subscriptions(self, *, older_than_days=30):
        cutoff = timezone.now() - timedelta(days=older_than_days)
        queryset = Subscription.objects.filter(
            status__in=(Subscription.STATUS_NOTIFIED, Subscription.STATUS_COMPLETED),
            completed_at__lt=cutoff,
        )
        count = queryset.count()
        for subscription in queryset.iterator():
            self._audit(AuditLog.EVENT_SUBSCRIPTION_ARCHIVED, subscription.id, email=subscription.email)
        queryset.update(status=Subscription.STATUS_ARCHIVED)
        return count

    def cancel_discontinued_product(self, product_id, *, reason="product_discontinued"):
        product = get_product_or_error(product_id)
        subscriptions = list(
            Subscription.objects.filter(product=product, status=Subscription.STATUS_ACTIVE).select_related("product")
        )
        from inventory_alerts.notification.service import NotificationService

        notification_service = NotificationService()
        for subscription in subscriptions:
            subscription.mark_cancelled()
            self._audit(
                AuditLog.EVENT_SUBSCRIPTION_CANCELLED,
                subscription.id,
                email=subscription.email,
                product_id=product.id,
                reason=reason,
            )
            notification_service.send_cancellation(subscription, reason=reason)
        return len(subscriptions)

    def _resolve_user(self, user_or_id):
        if user_or_id is None or user_or_id == "":
            return None
        user_model = get_user_model()
        if isinstance(user_or_id, user_model):
            return user_or_id
        try:
            return user_model.objects.get(pk=user_or_id)
        except (user_model.DoesNotExist, ValueError, TypeError):
            raise NotFoundError("User was not found.", details={"user_id": sanitize_input(user_or_id)})

    def _audit(self, event_type, entity_id, **details):
        AuditLog.objects.create(event_type=event_type, entity_id=str(entity_id), details=details)

    createSubscription = create_subscription
    removeSubscription = remove_subscription
    getSubscriptionsByProduct = get_subscriptions_by_product
    getSubscriptionsByUser = get_subscriptions_by_user
    subscriptionExists = subscription_exists
    markAsNotified = mark_as_notified
