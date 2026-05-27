from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import settings as app_settings
from app.schemas.auth import SessionUser
from app.services.library_service import LibraryService
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspace")


@router.get("/me/usage-summary")
def get_usage_summary(
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> dict:
    summary = WorkspaceService(settings).get_workspace_summary(user)
    return {"success": True, "data": summary.usage.model_dump()}


@router.get("/me/quota")
def get_workspace_quota(
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> dict:
    summary = WorkspaceService(settings).get_workspace_summary(user)
    return {
        "success": True,
        "data": {
            "daily_quota": summary.usage.daily_quota,
            "monthly_quota": summary.usage.monthly_quota,
            "remaining_daily_tokens": summary.usage.remaining_daily_tokens,
            "remaining_monthly_tokens": summary.usage.remaining_monthly_tokens,
            "max_selectable_models": summary.max_selectable_models,
            "auto_model_selection_enabled": summary.auto_model_selection_enabled,
            "can_use_vision_models": summary.can_use_vision_models,
            "can_use_high_cost_models": summary.can_use_high_cost_models,
        },
    }


@router.get("/me/models")
def get_workspace_models(
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> dict:
    summary = WorkspaceService(settings).get_workspace_summary(user)
    return {
        "success": True,
        "data": {
            "default_model_id": summary.default_model_id,
            "allowed_model_ids": summary.allowed_model_ids,
            "allowed_provider_ids": summary.allowed_provider_ids,
            "mode_options": [item.model_dump() for item in summary.mode_options],
            "model_families": [item.model_dump() for item in summary.model_families],
        },
    }


@router.get("/me/billing-summary")
def get_workspace_billing_summary(
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> dict:
    summary = WorkspaceService(settings).get_workspace_summary(user)
    return {
        "success": True,
        "data": {
            "monthly_estimated_cost": summary.usage.monthly_estimated_cost,
            "month_tokens": summary.usage.month_tokens,
            "today_tokens": summary.usage.today_tokens,
            "recent_usage": [item.model_dump() for item in summary.recent_usage[:10]],
        },
    }


@router.get("/me/files")
def get_workspace_files(
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> dict:
    files = LibraryService(settings).list_items(owner_id=user.id)
    return {"success": True, "data": [item.model_dump() for item in files]}
