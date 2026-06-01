import json

from django.http import JsonResponse
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from inventory_alerts.admin_interface.interface import AdminInterface
from inventory_alerts.errors import InventoryAlertError, NotFoundError
from inventory_alerts.subscription.manager import SubscriptionManager


@csrf_exempt
@require_http_methods(["POST"])
def create_subscription(request):
    manager = SubscriptionManager()
    try:
        data = _json_body(request)
        user = request.user if request.user.is_authenticated else data.get("userId")
        subscription = manager.create_subscription(
            user_id=user,
            product_id=data.get("productId") or data.get("product_id"),
            email=data.get("email"),
        )
        return JsonResponse({"subscription": _subscription_payload(subscription)}, status=201)
    except InventoryAlertError as exc:
        return JsonResponse(exc.to_dict(), status=exc.status_code)


@csrf_exempt
@require_http_methods(["DELETE"])
def remove_subscription(request, subscription_id):
    manager = SubscriptionManager()
    removed = manager.remove_subscription(subscription_id)
    return JsonResponse({"removed": removed})


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def unsubscribe_token(request, token):
    manager = SubscriptionManager()
    try:
        manager.unsubscribe_by_token(token)
        return JsonResponse({"removed": True})
    except InventoryAlertError as exc:
        return JsonResponse(exc.to_dict(), status=exc.status_code)


@require_http_methods(["GET"])
def admin_subscriptions(request):
    denied = _require_admin(request)
    if denied:
        return denied
    interface = AdminInterface()
    try:
        return JsonResponse(interface.get_subscriptions(_query_filters(request)))
    except InventoryAlertError as exc:
        return JsonResponse(exc.to_dict(), status=exc.status_code)


@csrf_exempt
@require_http_methods(["DELETE"])
def admin_cancel_subscription(request, subscription_id):
    denied = _require_admin(request)
    if denied:
        return denied
    data = _json_body(request, required=False)
    reason = data.get("reason") or "admin_cancelled"
    try:
        AdminInterface().cancel_subscription(subscription_id, reason)
    except Exception as exc:
        if exc.__class__.__name__ == "DoesNotExist":
            error = NotFoundError("Subscription was not found.")
            return JsonResponse(error.to_dict(), status=error.status_code)
        if isinstance(exc, InventoryAlertError):
            return JsonResponse(exc.to_dict(), status=exc.status_code)
        raise
    return JsonResponse({"cancelled": True})


@require_http_methods(["GET"])
def admin_statistics(request):
    denied = _require_admin(request)
    if denied:
        return denied
    return JsonResponse(AdminInterface().get_statistics(_query_filters(request)))


@require_http_methods(["GET"])
def admin_health(request):
    denied = _require_admin(request)
    if denied:
        return denied
    return JsonResponse(AdminInterface().get_system_health())


def _json_body(request, *, required=True):
    if not request.body:
        return {} if not required else {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def _query_filters(request):
    start = request.GET.get("startDate") or request.GET.get("start_date")
    end = request.GET.get("endDate") or request.GET.get("end_date")
    filters = {
        "product_id": request.GET.get("productId") or request.GET.get("product_id"),
        "email": request.GET.get("email"),
        "status": request.GET.get("status"),
        "limit": request.GET.get("limit", 50),
        "offset": request.GET.get("offset", 0),
    }
    if start:
        filters["start_date"] = parse_datetime(start)
    if end:
        filters["end_date"] = parse_datetime(end)
    return {key: value for key, value in filters.items() if value not in (None, "")}


def _require_admin(request):
    if not request.user.is_authenticated or not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({"error": "Administrator access is required."}, status=403)
    return None


def _subscription_payload(subscription):
    return {
        "id": str(subscription.id),
        "productId": subscription.product_id,
        "email": subscription.email,
        "status": subscription.status,
        "createdAt": subscription.created_at,
        "unsubscribeToken": str(subscription.unsubscribe_token),
    }
