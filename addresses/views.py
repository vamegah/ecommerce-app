import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .errors import AddressError
from .services import AddressManager, CheckoutAddressService


@csrf_exempt
@login_required(login_url="login")
@require_http_methods(["GET", "POST"])
def address_collection(request):
    manager = AddressManager()
    if request.method == "GET":
        addresses = [address.to_dict() for address in manager.get_addresses(request.user)]
        return JsonResponse({"success": True, "addresses": addresses})

    try:
        address = manager.create_address(request.user, _json_body(request))
    except AddressError as exc:
        return JsonResponse(exc.to_response(), status=exc.status_code)
    return JsonResponse({"success": True, "address": address.to_dict()}, status=201)


@csrf_exempt
@login_required(login_url="login")
@require_http_methods(["GET", "PUT", "DELETE"])
def address_detail(request, address_id):
    manager = AddressManager()
    try:
        if request.method == "GET":
            address = manager.get_address(request.user, address_id)
            return JsonResponse({"success": True, "address": address.to_dict()})
        if request.method == "PUT":
            address = manager.update_address(request.user, address_id, _json_body(request))
            return JsonResponse({"success": True, "address": address.to_dict()})
        manager.delete_address(request.user, address_id)
        return JsonResponse({"success": True})
    except AddressError as exc:
        return JsonResponse(exc.to_response(), status=exc.status_code)


@csrf_exempt
@login_required(login_url="login")
@require_http_methods(["PUT", "POST"])
def set_default_address(request, address_id):
    try:
        address = AddressManager().set_default_address(request.user, address_id)
    except AddressError as exc:
        return JsonResponse(exc.to_response(), status=exc.status_code)
    return JsonResponse({"success": True, "address": address.to_dict()})


@login_required(login_url="login")
@require_http_methods(["GET"])
def checkout_addresses(request):
    selection = CheckoutAddressService().get_available_addresses(request.user)
    return JsonResponse(
        {
            "success": True,
            "addresses": [address.to_dict() for address in selection["addresses"]],
            "defaultAddressId": selection["defaultAddressId"],
        }
    )


def _json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}
