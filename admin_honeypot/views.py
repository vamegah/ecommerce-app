import logging

from django.contrib import messages
from django.shortcuts import render
from django.views.decorators.csrf import csrf_protect


logger = logging.getLogger(__name__)


@csrf_protect
def honeypot_login(request):
    if request.method == "POST":
        username = request.POST.get("username", "")
        logger.warning(
            "Admin honeypot login attempt",
            extra={
                "username": username,
                "path": request.path,
                "remote_addr": request.META.get("REMOTE_ADDR", ""),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )
        messages.error(request, "Please enter the correct username and password.")

    return render(request, "admin_honeypot/login.html")
