from __future__ import annotations

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "greatkartecommerce.settings")
os.environ.setdefault("DJANGO_CONFIGURATION", "Dev")

app = Celery("greatkartecommerce")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
