from dataclasses import dataclass

from django.utils import timezone

from .errors import ServiceError


@dataclass
class CircuitState:
    failures: int = 0
    opened_at: object = None
    last_error: str = ""


class CircuitBreaker:
    def __init__(self, *, failure_threshold=3, recovery_seconds=300, name="service"):
        self.failure_threshold = failure_threshold
        self.recovery_seconds = recovery_seconds
        self.name = name
        self.state = CircuitState()

    @property
    def is_open(self):
        if self.state.opened_at is None:
            return False
        elapsed = timezone.now() - self.state.opened_at
        if elapsed.total_seconds() >= self.recovery_seconds:
            self.reset()
            return False
        return True

    def before_call(self):
        if self.is_open:
            raise ServiceError(f"{self.name} is temporarily unavailable.")

    def record_success(self):
        self.reset()

    def record_failure(self, error):
        self.state.failures += 1
        self.state.last_error = str(error)
        if self.state.failures >= self.failure_threshold:
            self.state.opened_at = timezone.now()

    def reset(self):
        self.state = CircuitState()

    def status(self):
        return {
            "name": self.name,
            "is_open": self.is_open,
            "failures": self.state.failures,
            "last_error": self.state.last_error,
        }
