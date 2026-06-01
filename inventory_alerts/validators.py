import html
import re
from dataclasses import dataclass

from django.core.validators import validate_email as django_validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

from store.models import Product

from .errors import NotFoundError, ValidationError


CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
PRODUCT_ID_RE = re.compile(r"^[0-9A-Za-z_-]+$")


@dataclass(frozen=True)
class StockTransition:
    product_id: str
    previous_stock: int
    current_stock: int
    timestamp: object


def sanitize_input(value, *, max_length=255):
    if value is None:
        return ""
    cleaned = CONTROL_CHARS_RE.sub("", str(value)).strip()
    cleaned = html.escape(cleaned, quote=True)
    return cleaned[:max_length]


def normalize_email(email):
    cleaned = sanitize_input(email, max_length=255).lower()
    try:
        django_validate_email(cleaned)
    except DjangoValidationError as exc:
        raise ValidationError("Enter a valid email address.", details={"email": email}) from exc
    return cleaned


def validate_product_id(product_id):
    cleaned = sanitize_input(product_id, max_length=64)
    if not cleaned:
        raise ValidationError("Product identifier is required.", details={"product_id": product_id})
    if not PRODUCT_ID_RE.match(cleaned):
        raise ValidationError("Product identifier contains invalid characters.", details={"product_id": product_id})
    return cleaned


def get_product_or_error(product_id):
    cleaned = validate_product_id(product_id)
    try:
        return Product.objects.get(pk=cleaned)
    except (Product.DoesNotExist, ValueError, TypeError) as exc:
        raise NotFoundError("Product was not found.", details={"product_id": cleaned}) from exc


def validate_stock_level(stock_level):
    if isinstance(stock_level, bool):
        raise ValidationError("Stock level must be a non-negative integer.", details={"stock_level": stock_level})
    try:
        value = int(stock_level)
    except (TypeError, ValueError) as exc:
        raise ValidationError("Stock level must be a non-negative integer.", details={"stock_level": stock_level}) from exc
    if str(stock_level).strip() != str(value) and not isinstance(stock_level, int):
        raise ValidationError("Stock level must be a non-negative integer.", details={"stock_level": stock_level})
    if value < 0:
        raise ValidationError("Stock level must be a non-negative integer.", details={"stock_level": stock_level})
    return value


def validate_status(status, allowed):
    if not status:
        return None
    cleaned = sanitize_input(status, max_length=30)
    if cleaned not in allowed:
        raise ValidationError("Invalid status filter.", details={"status": status})
    return cleaned
