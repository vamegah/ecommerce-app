import json

from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse
from django.db.models import Count
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

from .models import RecommendationClick
from .tasks import log_recommendation_click


@require_POST
def track_recommendation_click(request):
    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else request.POST
        source_type = payload.get("source_type")
        source_product_id = payload.get("source_product_id")
        recommended_product_id = payload.get("recommended_product_id")
        if not source_type or not recommended_product_id:
            return JsonResponse({"success": False, "error": "Missing required fields"}, status=400)
        request.session["last_recommendation_click_product_id"] = int(recommended_product_id)
        request.session.modified = True
        if hasattr(log_recommendation_click, "delay"):
            log_recommendation_click.delay(
                source_type=source_type,
                source_product_id=source_product_id,
                recommended_product_id=recommended_product_id,
                user_id=request.user.id if request.user.is_authenticated else None,
                session_key=request.session.session_key,
            )
        else:
            log_recommendation_click(
                source_type=source_type,
                source_product_id=source_product_id,
                recommended_product_id=recommended_product_id,
                user_id=request.user.id if request.user.is_authenticated else None,
                session_key=request.session.session_key,
            )
        return JsonResponse({"success": True})
    except Exception as exc:
        return JsonResponse({"success": False, "error": str(exc)}, status=500)


@staff_member_required
@require_GET
def recommendation_analytics(request):
    source_metrics = []
    for source_type, _ in RecommendationClick.SOURCE_TYPES:
        clicks = RecommendationClick.objects.filter(source_type=source_type).count()
        conversions = RecommendationClick.objects.filter(source_type=source_type, added_to_cart=True).count()
        source_metrics.append(
            {
                "source_type": source_type,
                "clicks": clicks,
                "conversions": conversions,
                "ctr": conversions / clicks if clicks else 0,
            }
        )
    top_pairs = (
        RecommendationClick.objects.values("source_product_id", "recommended_product_id")
        .annotate(total=Count("id"))
        .order_by("-total")[:20]
    )
    return render(
        request,
        "recommendations/analytics.html",
        {
            "source_metrics": source_metrics,
            "top_pairs": top_pairs,
        },
    )
