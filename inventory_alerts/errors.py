class InventoryAlertError(Exception):
    status_code = 500

    def __init__(self, message, *, details=None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_dict(self):
        payload = {"error": self.message}
        if self.details:
            payload["details"] = self.details
        return payload


class ValidationError(InventoryAlertError):
    status_code = 400


class DuplicateError(InventoryAlertError):
    status_code = 409


class NotFoundError(InventoryAlertError):
    status_code = 404


class ServiceError(InventoryAlertError):
    status_code = 503


ERROR_STATUS_MAP = {
    ValidationError: ValidationError.status_code,
    DuplicateError: DuplicateError.status_code,
    NotFoundError: NotFoundError.status_code,
    ServiceError: ServiceError.status_code,
}
