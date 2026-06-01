from __future__ import annotations

try:
    from celery import shared_task
except ImportError:  # pragma: no cover
    def shared_task(func):
        return func
from django.core.management import call_command


@shared_task
def process_inventory_alerts(batch_size: int = 100, archive_days: int = 30) -> bool:
    call_command(
        "process_inventory_alerts",
        batch_size=batch_size,
        archive_days=archive_days,
    )
    return True
