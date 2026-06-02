import json
import uuid

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from .errors import AddressNotFoundError, AddressValidationError
from .models import ShippingAddress
from .services import AddressManager, CheckoutAddressService
from .validators import AddressValidator


class AddressTestCase(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            first_name="Ada",
            last_name="Lovelace",
            username="ada-addresses",
            email="ada-addresses@example.com",
            password=uuid.uuid4().hex,
        )
        self.user.is_active = True
        self.user.save(update_fields=["is_active"])

        self.other_user = user_model.objects.create_user(
            first_name="Grace",
            last_name="Hopper",
            username="grace-addresses",
            email="grace-addresses@example.com",
            password=uuid.uuid4().hex,
        )
        self.other_user.is_active = True
        self.other_user.save(update_fields=["is_active"])

        self.valid_address = {
            "street": "123 Main Street",
            "apartment": "2B",
            "city": "Chicago",
            "state": "IL",
            "postal_code": "60601",
            "country": "US",
            "company_name": "Example Co",
            "phone_number": "312-555-0100",
        }
        self.manager = AddressManager()

    def test_validator_rejects_missing_whitespace_invalid_postal_and_accepts_optional_fields(self):
        validator = AddressValidator()

        invalid = validator.validate({"street": " ", "city": "", "postal_code": "ABC", "country": "US"})
        self.assertFalse(invalid["isValid"])
        self.assertIn("street", {error["field"] for error in invalid["errors"]})
        self.assertIn("postal_code", {error["field"] for error in invalid["errors"]})

        self.assertTrue(validator.validate_postal_code("12345", "US"))
        self.assertTrue(validator.validate_postal_code("K1A 0B1", "Canada"))
        self.assertTrue(validator.validate_postal_code("SW1A 1AA", "UK"))
        self.assertFalse(validator.validate_postal_code("ABCDE", "US"))

        valid = validator.validate(
            {
                "street": "12 #5-B Main St.",
                "city": "Chicago",
                "postalCode": "60601",
                "country": "US",
                "apartment": "",
                "companyName": "Widgets Ltd",
            }
        )
        self.assertTrue(valid["isValid"])

    def test_create_retrieve_first_default_and_user_isolation(self):
        address = self.manager.create_address(self.user, self.valid_address)
        other = self.manager.create_address(
            self.other_user,
            {**self.valid_address, "street": "999 Other Road", "postal_code": "10001"},
        )

        self.assertTrue(address.is_default)
        self.assertEqual(self.manager.get_address(self.user, address.id).street, "123 Main Street")
        self.assertEqual(len(self.manager.get_addresses(self.user)), 1)
        self.assertEqual(len(self.manager.get_addresses(self.other_user)), 1)
        self.assertNotEqual(self.manager.get_addresses(self.user)[0].id, other.id)

    def test_invalid_create_update_and_not_found_errors(self):
        with self.assertRaises(AddressValidationError):
            self.manager.create_address(self.user, {**self.valid_address, "street": "   "})

        address = self.manager.create_address(self.user, self.valid_address)
        with self.assertRaises(AddressValidationError):
            self.manager.update_address(self.user, address.id, {"postal_code": "INVALID"})
        address.refresh_from_db()
        self.assertEqual(address.postal_code, "60601")

        with self.assertRaises(AddressNotFoundError):
            self.manager.update_address(self.user, "00000000-0000-0000-0000-000000000000", self.valid_address)
        with self.assertRaises(AddressNotFoundError):
            self.manager.delete_address(self.user, "00000000-0000-0000-0000-000000000000")

    def test_update_persists_and_preserves_default_status(self):
        address = self.manager.create_address(self.user, self.valid_address)
        updated = self.manager.update_address(
            self.user,
            address.id,
            {"street": "500 Updated Avenue", "postal_code": "60602"},
        )

        self.assertEqual(updated.street, "500 Updated Avenue")
        self.assertEqual(updated.postal_code, "60602")
        self.assertTrue(updated.is_default)
        self.assertEqual(self.manager.get_address(self.user, address.id).street, "500 Updated Avenue")

    def test_delete_non_default_last_address_and_default_reassignment(self):
        first = self.manager.create_address(self.user, self.valid_address)
        second = self.manager.create_address(self.user, {**self.valid_address, "street": "456 Oak Road"})
        self.manager.delete_address(self.user, second.id)

        self.assertFalse(ShippingAddress.objects.filter(id=second.id).exists())
        first.refresh_from_db()
        self.assertTrue(first.is_default)

        third = self.manager.create_address(self.user, {**self.valid_address, "street": "789 Pine Road"})
        self.manager.delete_address(self.user, first.id)
        third.refresh_from_db()
        self.assertTrue(third.is_default)

        self.manager.delete_address(self.user, third.id)
        self.assertEqual(self.manager.get_addresses(self.user), [])

    def test_set_default_enforces_exclusive_default_invariant(self):
        first = self.manager.create_address(self.user, self.valid_address)
        second = self.manager.create_address(self.user, {**self.valid_address, "street": "456 Oak Road"})

        self.manager.set_default_address(self.user, second.id)
        first.refresh_from_db()
        second.refresh_from_db()

        self.assertFalse(first.is_default)
        self.assertTrue(second.is_default)
        self.assertEqual(ShippingAddress.objects.filter(user=self.user, is_default=True).count(), 1)

    def test_checkout_service_returns_available_addresses_and_selection_does_not_change_default(self):
        checkout = CheckoutAddressService(self.manager)
        first = self.manager.create_address(self.user, self.valid_address)
        second = self.manager.create_address(self.user, {**self.valid_address, "street": "456 Oak Road"})

        available = checkout.get_available_addresses(self.user)
        selected = checkout.select_address_for_order(self.user, "order-1", second.id)
        default = self.manager.get_default_address(self.user)
        temporary = checkout.save_new_checkout_address(self.user, {**self.valid_address, "street": "Temporary"}, False)
        saved = checkout.save_new_checkout_address(self.user, {**self.valid_address, "street": "Saved"}, True)

        self.assertEqual(available["defaultAddressId"], str(first.id))
        self.assertEqual(len(available["addresses"]), 2)
        self.assertEqual(selected.id, second.id)
        self.assertEqual(default.id, first.id)
        self.assertFalse(ShippingAddress.objects.filter(id=temporary.id).exists())
        self.assertIsNotNone(saved.id)

    def test_api_crud_default_auth_and_error_responses(self):
        client = Client()
        url = reverse("addresses:address_collection")

        unauthorized = client.get(url)
        self.assertEqual(unauthorized.status_code, 302)

        client.force_login(self.user)
        response = client.post(
            url,
            data=json.dumps(self.valid_address),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        address_id = response.json()["address"]["id"]

        response = client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["addresses"]), 1)

        detail_url = reverse("addresses:address_detail", args=[address_id])
        response = client.put(
            detail_url,
            data=json.dumps({"street": "500 Updated Avenue"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["address"]["street"], "500 Updated Avenue")

        response = client.put(reverse("addresses:set_default_address", args=[address_id]))
        self.assertEqual(response.status_code, 200)

        response = client.get(reverse("addresses:checkout_addresses"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["defaultAddressId"], address_id)

        response = client.delete(detail_url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(ShippingAddress.objects.filter(id=address_id).exists())

        response = client.get(detail_url)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "ADDRESS_NOT_FOUND")
