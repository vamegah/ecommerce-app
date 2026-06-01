from django.db import transaction
from django.db.models import F

from .errors import AddressNotFoundError, AddressValidationError
from .models import ShippingAddress
from .validators import AddressValidator


class DatabaseAddressDataStore:
    def save(self, user, address):
        address.user = user
        address.save()
        return address

    def find_by_id(self, user, address_id):
        return ShippingAddress.objects.filter(user=user, id=address_id).first()

    def find_by_user_id(self, user):
        return ShippingAddress.objects.filter(user=user).order_by("-is_default", "-created_at", "id")

    def update(self, user, address_id, values):
        address = self.find_by_id(user, address_id)
        if not address:
            raise AddressNotFoundError(address_id)
        for field, value in values.items():
            setattr(address, field, value)
        address.version = F("version") + 1
        address.save()
        address.refresh_from_db()
        return address

    def delete(self, user, address_id):
        address = self.find_by_id(user, address_id)
        if not address:
            raise AddressNotFoundError(address_id)
        address.delete()

    def find_default_address(self, user):
        return ShippingAddress.objects.filter(user=user, is_default=True).first()


class AddressManager:
    def __init__(self, data_store=None, validator=None):
        self.data_store = data_store or DatabaseAddressDataStore()
        self.validator = validator or AddressValidator()

    def create_address(self, user, data):
        cleaned = self._validate_or_raise(data)
        with transaction.atomic():
            first_address = not ShippingAddress.objects.select_for_update().filter(user=user).exists()
            make_default = bool(data.get("is_default", False)) or first_address
            if make_default:
                ShippingAddress.objects.filter(user=user, is_default=True).update(is_default=False)
            address = ShippingAddress.objects.create(user=user, is_default=make_default, **cleaned)
            self._repair_default_invariant(user)
        return address

    def get_addresses(self, user):
        return list(self.data_store.find_by_user_id(user))

    def get_address(self, user, address_id):
        address = self.data_store.find_by_id(user, address_id)
        if not address:
            raise AddressNotFoundError(address_id)
        return address

    def update_address(self, user, address_id, data):
        existing = self.get_address(user, address_id)
        merged = {
            "street": data.get("street", existing.street),
            "apartment": data.get("apartment", existing.apartment),
            "city": data.get("city", existing.city),
            "state": data.get("state", existing.state),
            "postal_code": data.get("postal_code", data.get("postalCode", data.get("zip_code", existing.postal_code))),
            "country": data.get("country", existing.country),
            "company_name": data.get("company_name", data.get("companyName", existing.company_name)),
            "phone_number": data.get("phone_number", data.get("phoneNumber", data.get("phone", existing.phone_number))),
        }
        cleaned = self._validate_or_raise(merged)
        with transaction.atomic():
            if data.get("is_default") is True:
                ShippingAddress.objects.filter(user=user, is_default=True).exclude(id=address_id).update(is_default=False)
                cleaned["is_default"] = True
            address = self.data_store.update(user, address_id, cleaned)
            self._repair_default_invariant(user)
        return address

    def delete_address(self, user, address_id):
        with transaction.atomic():
            address = self.get_address(user, address_id)
            was_default = address.is_default
            address.delete()
            if was_default:
                self._assign_new_default(user)
            self._repair_default_invariant(user)

    def set_default_address(self, user, address_id):
        with transaction.atomic():
            address = self.get_address(user, address_id)
            ShippingAddress.objects.filter(user=user, is_default=True).exclude(id=address_id).update(is_default=False)
            address.is_default = True
            address.version = F("version") + 1
            address.save(update_fields=("is_default", "version", "updated_at"))
            address.refresh_from_db()
        return address

    def get_default_address(self, user):
        return self.data_store.find_default_address(user)

    def _validate_or_raise(self, data):
        result = self.validator.validate(data)
        if not result["isValid"]:
            raise AddressValidationError("Address validation failed.", details=result["errors"])
        return result["cleaned"]

    def _assign_new_default(self, user):
        replacement = ShippingAddress.objects.filter(user=user).order_by("-created_at", "id").first()
        if replacement:
            replacement.is_default = True
            replacement.save(update_fields=("is_default", "updated_at"))

    def _repair_default_invariant(self, user):
        addresses = list(ShippingAddress.objects.filter(user=user).order_by("-is_default", "-created_at", "id"))
        if not addresses:
            return
        default_addresses = [address for address in addresses if address.is_default]
        keeper = default_addresses[0] if default_addresses else addresses[0]
        ShippingAddress.objects.filter(user=user).exclude(id=keeper.id).update(is_default=False)
        if not keeper.is_default:
            keeper.is_default = True
            keeper.save(update_fields=("is_default", "updated_at"))


class CheckoutAddressService:
    def __init__(self, manager=None):
        self.manager = manager or AddressManager()
        self._order_selections = {}

    def get_available_addresses(self, user):
        addresses = self.manager.get_addresses(user)
        default = next((address for address in addresses if address.is_default), None)
        return {"addresses": addresses, "defaultAddressId": str(default.id) if default else None}

    def select_address_for_order(self, user, order_id, address_id):
        address = self.manager.get_address(user, address_id)
        self._order_selections[str(order_id)] = str(address.id)
        return address

    def save_new_checkout_address(self, user, data, save_for_future=False):
        if save_for_future:
            return self.manager.create_address(user, data)
        cleaned = self.manager._validate_or_raise(data)
        return ShippingAddress(user=user, is_default=False, **cleaned)
