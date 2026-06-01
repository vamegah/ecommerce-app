class AddressError(Exception):
    code = "ADDRESS_ERROR"
    status_code = 400

    def __init__(self, message, *, details=None):
        super().__init__(message)
        self.message = message
        self.details = details or []

    def to_response(self):
        payload = {"success": False, "error": {"code": self.code, "message": self.message}}
        if self.details:
            payload["error"]["details"] = self.details
        return payload


class AddressValidationError(AddressError):
    code = "VALIDATION_ERROR"
    status_code = 400


class AddressNotFoundError(AddressError):
    code = "ADDRESS_NOT_FOUND"
    status_code = 404

    def __init__(self, address_id):
        super().__init__("Address was not found.", details={"addressId": str(address_id)})
        self.address_id = address_id


class AddressStorageError(AddressError):
    code = "STORAGE_ERROR"
    status_code = 503
