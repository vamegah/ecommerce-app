import re


REQUIRED_FIELDS = ("street", "city", "postal_code", "country")
FIELD_LIMITS = {
    "street": 255,
    "apartment": 100,
    "city": 100,
    "state": 100,
    "postal_code": 20,
    "country": 80,
    "company_name": 120,
    "phone_number": 30,
}

COUNTRY_ALIASES = {
    "US": "US",
    "USA": "US",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    "CA": "CA",
    "CANADA": "CA",
    "GB": "UK",
    "UK": "UK",
    "UNITED KINGDOM": "UK",
    "GREAT BRITAIN": "UK",
}

POSTAL_PATTERNS = {
    "US": re.compile(r"^\d{5}(-\d{4})?$"),
    "CA": re.compile(r"^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$", re.IGNORECASE),
    "UK": re.compile(r"^(GIR 0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$", re.IGNORECASE),
}


class AddressValidator:
    def validate_required_fields(self, data):
        errors = []
        cleaned = self.clean(data)
        for field in REQUIRED_FIELDS:
            value = cleaned.get(field)
            if value is None:
                errors.append(self._error(field, "This field is required.", "REQUIRED_FIELD_MISSING"))
            elif str(value).strip() == "":
                errors.append(self._error(field, "This field must contain non-whitespace content.", "WHITESPACE_ONLY"))
        return errors

    def validate_postal_code(self, postal_code, country):
        country_code = self.normalize_country(country)
        if not country_code:
            return False
        pattern = POSTAL_PATTERNS.get(country_code)
        if pattern is None:
            return bool(str(postal_code or "").strip())
        return bool(pattern.match(str(postal_code or "").strip()))

    def validate(self, data):
        errors = self.validate_required_fields(data)
        cleaned = self.clean(data)

        for field, limit in FIELD_LIMITS.items():
            value = cleaned.get(field, "")
            if value and len(value) > limit:
                errors.append(self._error(field, f"Must be {limit} characters or fewer.", "FIELD_TOO_LONG"))

        if cleaned.get("country") and self.normalize_country(cleaned["country"]) not in POSTAL_PATTERNS:
            errors.append(self._error("country", "Country must be US, Canada, or UK.", "INVALID_COUNTRY"))
        elif cleaned.get("postal_code") and cleaned.get("country") and not self.validate_postal_code(cleaned["postal_code"], cleaned["country"]):
            errors.append(self._error("postal_code", "Postal code does not match the selected country.", "INVALID_POSTAL_CODE"))

        return {"isValid": not errors, "errors": errors, "cleaned": cleaned}

    def clean(self, data):
        return {
            "street": self._clean(self._value(data, "street")),
            "apartment": self._clean(self._value(data, "apartment")),
            "city": self._clean(self._value(data, "city")),
            "state": self._clean(self._value(data, "state")),
            "postal_code": self._clean(self._value(data, "postal_code", "postalCode", "zip_code")),
            "country": self._clean(self._value(data, "country")),
            "company_name": self._clean(self._value(data, "company_name", "companyName")),
            "phone_number": self._clean(self._value(data, "phone_number", "phoneNumber", "phone")),
        }

    def normalize_country(self, country):
        value = str(country or "").strip().upper()
        return COUNTRY_ALIASES.get(value)

    def _value(self, data, *names):
        for name in names:
            if isinstance(data, dict) and name in data:
                return data.get(name)
            if hasattr(data, name):
                return getattr(data, name)
        return None

    def _clean(self, value):
        if value is None:
            return ""
        return str(value).strip()

    def _error(self, field, message, code):
        return {"field": field, "message": message, "code": code}
