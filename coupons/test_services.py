from django.test import TestCase, RequestFactory
from django.contrib.sessions.middleware import SessionMiddleware
from unittest.mock import patch, MagicMock
from decimal import Decimal
from coupons.services import CouponSessionService
from coupons.models import Coupon


class CouponSessionServiceTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.request = self.factory.get("/")

        # Initialize session
        middleware = SessionMiddleware(lambda x: None)
        middleware.process_request(self.request)
        self.request.session.save()

        self.service = CouponSessionService(self.request)

    @patch("coupons.services.Coupon.objects.get")
    @patch("coupons.services.CouponValidator")
    @patch("coupons.services.DiscountEngine")
    def test_session_restoration_valid_coupon(
        self, MockDiscountEngine, MockValidator, mock_get
    ):
        """Task 12.1: Test valid coupon restored from session"""
        # Setup
        self.request.session["applied_coupon_code"] = "SAVE10"
        mock_coupon = MagicMock()
        mock_get.return_value = mock_coupon

        # Mock Validator to return valid
        mock_validator_instance = MockValidator.return_value
        mock_validator_instance.validate.return_value.is_valid = True

        # Mock Engine to return discount
        mock_engine_instance = MockDiscountEngine.return_value
        mock_engine_instance.calculate_discount.return_value = Decimal("10.00")

        # Execute
        coupon, discount, error = self.service.get_applied_coupon(
            cart_total=Decimal("100.00")
        )

        # Assert
        self.assertEqual(coupon, mock_coupon)
        self.assertEqual(discount, Decimal("10.00"))
        self.assertIsNone(error)
        self.assertEqual(self.request.session.get("applied_coupon_code"), "SAVE10")

    @patch("coupons.services.Coupon.objects.get")
    @patch("coupons.services.CouponValidator")
    def test_session_restoration_invalid_coupon(self, MockValidator, mock_get):
        """Task 12.1: Test invalid coupon cleared from session"""
        # Setup
        self.request.session["applied_coupon_code"] = "EXPIRED"
        mock_get.return_value = MagicMock()

        # Mock Validator to return invalid
        mock_validator_instance = MockValidator.return_value
        validation_result = MagicMock()
        validation_result.is_valid = False
        validation_result.error_message = "Expired"
        mock_validator_instance.validate.return_value = validation_result

        # Execute
        coupon, discount, error = self.service.get_applied_coupon(
            cart_total=Decimal("100.00")
        )

        # Assert
        self.assertIsNone(coupon)
        self.assertEqual(discount, 0)
        self.assertIn("Expired", error)
        self.assertIsNone(self.request.session.get("applied_coupon_code"))

    @patch("coupons.services.Coupon.objects.get")
    def test_error_handling_database(self, mock_get):
        """Task 13.1: Test database error handling"""
        self.request.session["applied_coupon_code"] = "DBERROR"
        mock_get.side_effect = Exception("DB Connection Failed")

        coupon, discount, error = self.service.get_applied_coupon(
            cart_total=Decimal("100.00")
        )

        self.assertIsNone(coupon)
        self.assertEqual(error, "Error retrieving coupon.")

    @patch("coupons.services.RedemptionTracker")
    @patch("coupons.services.transaction")
    def test_redemption_transaction_safety(self, mock_transaction, MockTracker):
        """Task 13.1: Test transaction handling for redemption"""
        mock_order = MagicMock()
        mock_coupon = MagicMock()

        # Setup atomic block
        mock_atomic = MagicMock()
        mock_transaction.atomic.return_value.__enter__.return_value = mock_atomic

        self.service.record_redemption(mock_coupon, mock_order, Decimal("10.00"))

        mock_transaction.atomic.assert_called_once()
        MockTracker.return_value.record_redemption.assert_called_once()
