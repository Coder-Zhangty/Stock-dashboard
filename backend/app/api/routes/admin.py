from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_admin, verify_csrf
from app.core.config import settings as app_settings
from app.core.database import get_connection
from app.schemas.admin import (
    AdminActionResponse,
    AdminCreateUserRequest,
    AdminOverviewResponse,
    AdminResetPasswordRequest,
    AdminUserUpdateRequest,
    PermissionPolicyResponse,
    AdminSystemStatusResponse,
    AdminUsersResponse,
)
from app.schemas.auth import SessionUser
from app.schemas.provider_catalog import (
    AdminProviderCatalogResponse,
    ManagedRoutingUpdateRequest,
)
from app.schemas.platform import (
    CreateModelRequest,
    CreateProviderRequest,
    ModelResponse,
    ProviderResponse,
    ProviderSyncRequest,
    ProviderSyncResponse,
    ProviderTestResponse,
    RoutingPolicyResponse,
    UpdateModelRequest,
    UpdateProviderRequest,
    UpdateRoutingPolicyRequest,
)
from app.schemas.preferences import UserMemoryResponse
from app.services.admin_service import AdminService
from app.services.auth_service import AuthService
from app.services.audit_log_service import AuditLogService
from app.services.provider_catalog_service import ProviderCatalogService
from app.services.provider_registry_service import ProviderRegistryService
from app.services.user_memory_service import UserMemoryService

router = APIRouter(prefix="/admin")


@router.get("/overview", response_model=AdminOverviewResponse)
def get_overview(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminOverviewResponse:
    return AdminService(settings).get_overview()


@router.get("/users", response_model=AdminUsersResponse)
def list_users(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminUsersResponse:
    service = AdminService(settings)
    return AdminUsersResponse(items=service.list_users())


@router.post("/users", response_model=AdminActionResponse)
def create_user(
    payload: AdminCreateUserRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminActionResponse:
    service = AdminService(settings)
    user = service.create_user(
        actor=admin,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        role=payload.role,
    )
    return AdminActionResponse(success=True, user=user)


@router.get("/users/{user_id}", response_model=AdminActionResponse)
def get_user(
    user_id: str,
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminActionResponse:
    user = next((item for item in AdminService(settings).list_users() if item.id == user_id), None)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return AdminActionResponse(success=True, user=user)


@router.patch("/users/{user_id}", response_model=AdminActionResponse)
def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminActionResponse:
    service = AdminService(settings)
    user = service.update_user_controls(actor=admin, user_id=user_id, patch=payload.model_dump(exclude_none=True))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return AdminActionResponse(success=True, user=user)


@router.get("/users/{user_id}/usage-summary")
def get_user_usage_summary(
    user_id: str,
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> dict:
    user = next((item for item in AdminService(settings).list_users() if item.id == user_id), None)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return {
        "success": True,
        "data": {
            "request_count": user.request_count,
            "prompt_tokens": user.prompt_tokens,
            "completion_tokens": user.completion_tokens,
            "total_tokens": user.total_tokens,
            "token_used_daily": user.token_used_daily,
            "token_used_weekly": user.token_used_weekly,
            "token_used_monthly": user.token_used_monthly,
            "estimated_monthly_cost": user.estimated_monthly_cost,
        },
    }


@router.get("/users/{user_id}/usage-records")
def get_user_usage_records(
    user_id: str,
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> dict:
    with get_connection(settings) as connection:
        rows = connection.execute(
            """
            SELECT id, conversation_id, provider_id, model_id, request_type, prompt_tokens,
                   completion_tokens, total_tokens, estimated_cost, request_status,
                   latency_ms, error_code, error_message, selected_strategy, created_at
            FROM usage_records
            WHERE user_id = ?
            ORDER BY datetime(created_at) DESC
            LIMIT 100
            """,
            (user_id,),
        ).fetchall()
    return {"success": True, "data": [dict(row) for row in rows]}


@router.post("/users/{user_id}/reset-password", response_model=AdminActionResponse)
def reset_password(
    user_id: str,
    payload: AdminResetPasswordRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminActionResponse:
    service = AdminService(settings)
    user = service.reset_user_password(actor=admin, user_id=user_id, password=payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return AdminActionResponse(success=True, user=user)


@router.post("/users/{user_id}/force-logout")
def force_logout_user(
    user_id: str,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> dict[str, bool]:
    user = AuthService(settings).get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    AuthService(settings).revoke_all_sessions_for_user(user_id=user_id)
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="force_logout_user",
        target_type="user",
        target_id=user.id,
        target_label=user.email,
        detail=f"Revoked all active sessions for {user.name}.",
        result="warning",
    )
    return {"success": True}


@router.post("/users/{user_id}/disable", response_model=AdminActionResponse)
def disable_user(
    user_id: str,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminActionResponse:
    service = AdminService(settings)
    user = service.disable_user(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="disable_user",
        target_type="user",
        target_id=user.id,
        target_label=user.email,
        detail=f"Disabled {user.name}.",
        result="warning",
    )
    return AdminActionResponse(success=True, user=user)


@router.post("/users/{user_id}/enable", response_model=AdminActionResponse)
def enable_user(
    user_id: str,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminActionResponse:
    service = AdminService(settings)
    user = service.enable_user(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="enable_user",
        target_type="user",
        target_id=user.id,
        target_label=user.email,
        detail=f"Enabled {user.name}.",
        result="success",
    )
    return AdminActionResponse(success=True, user=user)


@router.delete("/users/{user_id}", response_model=AdminActionResponse)
def delete_user(
    user_id: str,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminActionResponse:
    service = AdminService(settings)
    deleted = service.delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="delete_user",
        target_type="user",
        target_id=user_id,
        target_label=user_id,
        detail="Deleted user account.",
        result="warning",
    )
    return AdminActionResponse(success=True, user=None)


@router.get("/users/{user_id}/memories", response_model=list[UserMemoryResponse])
def list_user_memories(
    user_id: str,
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> list[UserMemoryResponse]:
    user = AuthService(settings).get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return UserMemoryService(settings).list_memories(user_id, include_deleted=True)


@router.delete("/users/{user_id}/memories/{memory_id}")
def delete_user_memory(
    user_id: str,
    memory_id: str,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> dict[str, bool]:
    user = AuthService(settings).get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    deleted = UserMemoryService(settings).delete_memory(user_id, memory_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="delete_user_memory",
        target_type="user",
        target_id=user.id,
        target_label=user.email,
        detail="Deleted a user memory from the admin console.",
        result="warning",
    )
    return {"success": True}


@router.get("/ai-platform/providers", response_model=AdminProviderCatalogResponse)
def get_provider_catalog(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminProviderCatalogResponse:
    return ProviderCatalogService(settings).get_admin_catalog()


@router.get("/ai-platform/routing", response_model=AdminProviderCatalogResponse)
def get_managed_routing(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminProviderCatalogResponse:
    return ProviderCatalogService(settings).get_admin_catalog()


@router.put("/ai-platform/routing", response_model=AdminProviderCatalogResponse)
def update_managed_routing(
    payload: ManagedRoutingUpdateRequest,
    csrf_ok: None = Depends(verify_csrf),
    admin_user: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminProviderCatalogResponse:
    service = ProviderCatalogService(settings)
    result = service.update_admin_catalog(payload.managed_routing, payload.providers)
    AuditLogService(settings).record(
        actor_id=admin_user.id,
        actor_name=admin_user.name,
        actor_role=admin_user.role,
        action_type="update_managed_routing",
        target_type="routing",
    )
    return result


@router.get("/permissions", response_model=PermissionPolicyResponse)
def get_permissions(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> PermissionPolicyResponse:
    service = ProviderCatalogService(settings)
    return PermissionPolicyResponse(**service.get_admin_catalog().permissions.model_dump())


@router.put("/permissions", response_model=PermissionPolicyResponse)
def update_permissions(
    payload: PermissionPolicyResponse,
    csrf_ok: None = Depends(verify_csrf),
    admin_user: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> PermissionPolicyResponse:
    service = ProviderCatalogService(settings)
    result = PermissionPolicyResponse(**service.update_permissions(payload).model_dump())
    AuditLogService(settings).record(
        actor_id=admin_user.id,
        actor_name=admin_user.name,
        actor_role=admin_user.role,
        action_type="update_permissions",
        target_type="permissions",
    )
    return result


@router.get("/system/status", response_model=AdminSystemStatusResponse)
def get_system_status(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> AdminSystemStatusResponse:
    return AdminService(settings).get_system_status()


@router.get("/audit-logs")
def get_audit_logs(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> list[dict]:
    return [item.model_dump() for item in AdminService(settings).list_audit_logs()]


@router.get("/system/events")
def get_system_events(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> list[dict]:
    with get_connection(settings) as connection:
        rows = connection.execute(
            """
            SELECT id, level, source_type, source_id, title, message, detail_json, created_at, resolved_at
            FROM system_events
            ORDER BY datetime(created_at) DESC
            LIMIT 100
            """
        ).fetchall()
    return [dict(row) for row in rows]


@router.get("/providers", response_model=list[ProviderResponse])
def list_providers(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> list[ProviderResponse]:
    return ProviderRegistryService(settings).list_providers(include_disabled=True)


@router.post("/providers", response_model=ProviderResponse)
def create_provider(
    payload: CreateProviderRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> ProviderResponse:
    provider = ProviderRegistryService(settings).create_provider(payload)
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="create_provider",
        target_type="provider",
        target_id=provider.id,
        target_label=provider.name,
        detail=f"Created provider {provider.name}.",
    )
    return provider


@router.get("/providers/{provider_id}", response_model=ProviderResponse)
def get_provider(
    provider_id: str,
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> ProviderResponse:
    provider = ProviderRegistryService(settings).get_provider(provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found.")
    return provider


@router.patch("/providers/{provider_id}", response_model=ProviderResponse)
def update_provider(
    provider_id: str,
    payload: UpdateProviderRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> ProviderResponse:
    provider = ProviderRegistryService(settings).update_provider(provider_id, payload)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="update_provider",
        target_type="provider",
        target_id=provider.id,
        target_label=provider.name,
        detail=f"Updated provider {provider.name}.",
    )
    return provider


@router.delete("/providers/{provider_id}")
def delete_provider(
    provider_id: str,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> dict[str, bool]:
    deleted = ProviderRegistryService(settings).delete_provider(provider_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="delete_provider",
        target_type="provider",
        target_id=provider_id,
        target_label=provider_id,
        detail="Soft-deleted provider.",
        result="warning",
    )
    return {"success": True}


@router.post("/providers/{provider_id}/test", response_model=ProviderTestResponse)
async def test_provider(
    provider_id: str,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> ProviderTestResponse:
    provider, detail, latency_ms, checked_at = await ProviderRegistryService(settings).test_provider_connectivity(provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="test_provider",
        target_type="provider",
        target_id=provider.id,
        target_label=provider.name,
        detail=detail,
        result="success" if provider.status == "healthy" else "warning",
    )
    return ProviderTestResponse(provider=provider, detail=detail, latency_ms=latency_ms, checked_at=checked_at)


@router.post("/providers/{provider_id}/sync", response_model=ProviderSyncResponse)
async def sync_provider(
    provider_id: str,
    payload: ProviderSyncRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> ProviderSyncResponse:
    result = await ProviderRegistryService(settings).sync_provider_catalog(
        provider_id,
        include_models=payload.include_models,
        include_quota=payload.include_quota,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="sync_provider",
        target_type="provider",
        target_id=provider_id,
        target_label=result.provider.name,
        detail=result.detail,
        result="success" if result.status == "success" else "warning",
    )
    return result


@router.get("/providers/{provider_id}/health-checks")
def list_provider_health_checks(
    provider_id: str,
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> list[dict]:
    with get_connection(settings) as connection:
        rows = connection.execute(
            """
            SELECT id, provider_id, status, latency_ms, checked_at, detail_json
            FROM provider_health_checks
            WHERE provider_id = ?
            ORDER BY datetime(checked_at) DESC
            LIMIT 30
            """,
            (provider_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@router.get("/models", response_model=list[ModelResponse])
def list_models(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> list[ModelResponse]:
    return ProviderRegistryService(settings).list_models(include_disabled=True)


@router.post("/models", response_model=ModelResponse)
def create_model(
    payload: CreateModelRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> ModelResponse:
    model = ProviderRegistryService(settings).create_model(payload)
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="create_model",
        target_type="model",
        target_id=model.id,
        target_label=model.display_name,
        detail=f"Created model {model.display_name}.",
    )
    return model


@router.get("/models/{model_id}", response_model=ModelResponse)
def get_model(
    model_id: str,
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> ModelResponse:
    model = ProviderRegistryService(settings).get_model(model_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found.")
    return model


@router.patch("/models/{model_id}", response_model=ModelResponse)
def update_model(
    model_id: str,
    payload: UpdateModelRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> ModelResponse:
    model = ProviderRegistryService(settings).update_model(model_id, payload)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="update_model",
        target_type="model",
        target_id=model.id,
        target_label=model.display_name,
        detail=f"Updated model {model.display_name}.",
    )
    return model


@router.delete("/models/{model_id}")
def delete_model(
    model_id: str,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> dict[str, bool]:
    deleted = ProviderRegistryService(settings).delete_model(model_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found.")
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="delete_model",
        target_type="model",
        target_id=model_id,
        target_label=model_id,
        detail="Soft-deleted model.",
        result="warning",
    )
    return {"success": True}


@router.get("/routing-policy", response_model=RoutingPolicyResponse)
def get_routing_policy(
    _: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> RoutingPolicyResponse:
    return ProviderRegistryService(settings).get_routing_policy()


@router.patch("/routing-policy", response_model=RoutingPolicyResponse)
def update_routing_policy(
    payload: UpdateRoutingPolicyRequest,
    _: None = Depends(verify_csrf),
    admin: SessionUser = Depends(require_admin),
    settings = Depends(lambda: app_settings),
) -> RoutingPolicyResponse:
    policy = ProviderRegistryService(settings).update_routing_policy(payload)
    AuditLogService(settings).record(
        actor_id=admin.id,
        actor_name=admin.name,
        actor_role=admin.role,
        action_type="update_routing_policy",
        target_type="routing_policy",
        target_id="default",
        target_label="default",
        detail="Updated routing policy.",
    )
    return policy
