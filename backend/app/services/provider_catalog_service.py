from __future__ import annotations

import json
from datetime import datetime, timezone

from app.core.config import Settings
from app.schemas.provider_catalog import (
    AdminProviderCatalogResponse,
    ManagedModelOption,
    ManagedProviderConfig,
    ManagedRoutingState,
    ProviderCatalogResponse,
    ProviderItem,
    ProviderModelItem,
    UserPermissionPolicy,
)
from app.schemas.platform import UpdateModelRequest, UpdateProviderRequest, UpdateRoutingPolicyRequest
from app.services.managed_config_service import ManagedConfigService
from app.services.provider_registry_service import ProviderRegistryService
from app.services.user_governance_service import UserGovernanceService


class ProviderCatalogService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.registry = ProviderRegistryService(settings)
        self.registry.ensure_seed_data()
        self.managed_config_service = ManagedConfigService(settings)
        self.user_governance_service = UserGovernanceService(settings)

    @staticmethod
    def _generated_at() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _permissions(self) -> UserPermissionPolicy:
        return self.managed_config_service.get_permissions()

    def _routing(self) -> ManagedRoutingState:
        policy = self.registry.get_routing_policy()
        user_default = self.registry.get_model(policy.default_user_model_id or "qwen3-vl-plus")
        admin_default = self.registry.get_model(policy.default_admin_model_id or "qwen3-vl-plus")
        return ManagedRoutingState(
            user_default_provider=user_default.provider_id if user_default else "mock",
            user_default_model=user_default.id if user_default else "aurora-mock-chat",
            admin_default_provider=admin_default.provider_id if admin_default else "mock",
            admin_default_model=admin_default.id if admin_default else "aurora-mock-admin",
            allow_user_model_switch=policy.allow_user_model_switching,
        )

    def _provider_items(self) -> list[ProviderItem]:
        providers = {provider.id: provider for provider in self.registry.list_providers(include_disabled=True)}
        models = self.registry.list_models(include_disabled=True)
        routing = self._routing()
        items: list[ProviderItem] = []
        for provider_id, provider in providers.items():
            provider_models = [
                ProviderModelItem(
                    id=model.id,
                    label=model.display_name,
                    available=model.enabled and provider.enabled,
                    description=model.description,
                    type=model.type,
                    context_window=model.context_window,
                    tags=model.tags,
                    input_price_per_1k=model.input_price_per_1k,
                    output_price_per_1k=model.output_price_per_1k,
                    metadata_json=model.metadata_json,
                )
                for model in models
                if model.provider_id == provider_id
            ]
            if not provider_models:
                continue
            user_default = next((model.id for model in models if model.provider_id == provider_id and model.is_default_for_user), None)
            admin_default = next((model.id for model in models if model.provider_id == provider_id and model.is_default_for_admin), None)
            items.append(
                ProviderItem(
                    id=provider.id,
                    label=provider.name,
                    available=provider.enabled,
                    status=provider.status,
                    requires_api_key=provider.type != "mock",
                    supports=sorted({model.type for model in models if model.provider_id == provider_id}),
                    default_user_model=user_default or (routing.user_default_model if routing.user_default_provider == provider_id else provider_models[0].id),
                    default_admin_model=admin_default or (routing.admin_default_model if routing.admin_default_provider == provider_id else provider_models[0].id),
                    description=provider.description,
                    last_synced_at=provider.last_synced_at,
                    sync_status=provider.sync_status,
                    sync_error=provider.sync_error,
                    external_quota=provider.external_quota,
                    models=provider_models,
                )
            )
        return items

    def _visible_catalog(self, *, role: str, user_id: str | None = None) -> ProviderCatalogResponse:
        routing = self._routing()
        permissions = self._permissions()
        user_controls = self.user_governance_service.ensure_user_controls(user_id) if user_id else None
        allowed_provider_ids = set(user_controls.allowed_provider_ids) if user_controls and user_controls.allowed_provider_ids else None
        allowed_model_ids = set(user_controls.allowed_model_ids) if user_controls and user_controls.allowed_model_ids else None

        visible_providers: list[ProviderItem] = []
        for provider in self._provider_items():
            registry_provider = self.registry.get_provider(provider.id)
            if registry_provider is None or not registry_provider.enabled:
                continue
            if role != "admin" and not registry_provider.visible_to_users:
                continue
            if allowed_provider_ids is not None and provider.id not in allowed_provider_ids:
                continue

            visible_models: list[ProviderModelItem] = []
            for model in provider.models:
                registry_model = self.registry.get_model(model.id)
                if registry_model is None or not registry_model.enabled:
                    continue
                if role != "admin" and not registry_model.visible_to_users:
                    continue
                if allowed_model_ids is not None and model.id not in allowed_model_ids:
                    continue
                if role != "admin" and user_controls and not user_controls.can_use_vision_models and registry_model.type == "vision":
                    continue
                high_cost = bool((registry_model.input_price_per_1k or 0) >= 0.003 or (registry_model.output_price_per_1k or 0) >= 0.009)
                if role != "admin" and user_controls and high_cost and not user_controls.can_use_high_cost_models:
                    continue
                visible_models.append(model)

            if visible_models:
                visible_providers.append(provider.model_copy(update={"models": visible_models}))

        if not visible_providers:
            fallback = next((item for item in self._provider_items() if item.id == "mock"), None)
            if fallback:
                visible_providers = [fallback]

        allowed_model_ids_from_catalog = {model.id for provider in visible_providers for model in provider.models}
        managed_provider_id = routing.admin_default_provider if role == "admin" else routing.user_default_provider
        managed_default_model = routing.admin_default_model if role == "admin" else routing.user_default_model
        if managed_default_model not in allowed_model_ids_from_catalog and visible_providers:
            managed_provider_id = visible_providers[0].id
            managed_default_model = visible_providers[0].models[0].id

        allow_user_model_switch = routing.allow_user_model_switch
        resolved_permissions = permissions
        if role != "admin" and user_controls:
            resolved_permissions = self.user_governance_service.resolve_feature_policy(user_id, permissions)
            allow_user_model_switch = allow_user_model_switch and user_controls.max_selectable_models > 1

        return ProviderCatalogResponse(
            generated_at=self._generated_at(),
            recommended_provider_id=managed_provider_id,
            managed_provider_id=managed_provider_id,
            managed_default_model=managed_default_model,
            allow_user_model_switch=allow_user_model_switch,
            permissions=resolved_permissions,
            providers=visible_providers,
        )

    def get_catalog(self) -> ProviderCatalogResponse:
        return self._visible_catalog(role="user")

    def get_catalog_for_user(self, user) -> ProviderCatalogResponse:
        return self._visible_catalog(role=user.role, user_id=user.id)

    def get_admin_catalog(self) -> AdminProviderCatalogResponse:
        routing = self._routing()
        providers = self.registry.list_providers(include_disabled=True)
        models = self.registry.list_models(include_disabled=True)
        managed_providers: list[ManagedProviderConfig] = []
        for provider in providers:
            runtime = self.registry.get_provider_runtime(provider.id)
            health_checks = self.registry.list_provider_health_checks(provider.id, limit=1)
            latest_check = health_checks[0] if health_checks else None
            detail_json = latest_check.get("detail_json") if latest_check else {}
            if isinstance(detail_json, str):
                try:
                    detail_json = json.loads(detail_json)
                except Exception:  # noqa: BLE001
                    detail_json = {"detail": detail_json}
            managed_providers.append(
                ManagedProviderConfig(
                    id=provider.id,
                    label=provider.name,
                    available=provider.enabled,
                    status=provider.status,
                    requires_api_key=provider.type != "mock",
                    supports=sorted({model.type for model in models if model.provider_id == provider.id}),
                    default_user_model=next((model.id for model in models if model.provider_id == provider.id and model.is_default_for_user), routing.user_default_model),
                    default_admin_model=next((model.id for model in models if model.provider_id == provider.id and model.is_default_for_admin), routing.admin_default_model),
                    enabled=provider.enabled,
                    visible_to_users=provider.visible_to_users,
                    base_url=provider.base_url,
                    configured_model=next((model.id for model in models if model.provider_id == provider.id and model.is_default_for_user), None) or "",
                    has_api_key=bool(runtime and runtime.get("api_key")),
                    api_key_hint=provider.api_key_masked,
                    api_key_input=None,
                    clear_api_key=False,
                    last_checked_at=provider.last_checked_at,
                    last_ping_ms=latest_check.get("latency_ms") if latest_check else None,
                    last_error_reason=None if provider.status == "healthy" else detail_json.get("detail"),
                    description=provider.description,
                    last_synced_at=provider.last_synced_at,
                    sync_status=provider.sync_status,
                    sync_error=provider.sync_error,
                    external_quota=provider.external_quota,
                    models=[
                        ManagedModelOption(
                            id=model.id,
                            label=model.display_name,
                            available=model.enabled,
                            enabled_for_user=model.visible_to_users,
                            enabled_for_admin=model.enabled,
                            allow_auto_select=model.allow_auto_select,
                            description=model.description,
                            type=model.type,
                            context_window=model.context_window,
                            tags=model.tags,
                            input_price_per_1k=model.input_price_per_1k,
                            output_price_per_1k=model.output_price_per_1k,
                            metadata_json=model.metadata_json,
                        )
                        for model in models
                        if model.provider_id == provider.id
                    ],
                )
            )
        return AdminProviderCatalogResponse(
            generated_at=self._generated_at(),
            recommended_provider_id=routing.user_default_provider,
            providers=managed_providers,
            managed_routing=routing,
            permissions=self._permissions(),
        )

    def update_admin_catalog(
        self,
        routing: ManagedRoutingState,
        providers: list[ManagedProviderConfig],
    ) -> AdminProviderCatalogResponse:
        # Since the current admin UI still posts the legacy payload shape, map it manually.
        for provider in providers:
            self.registry.update_provider(
                provider.id,
                UpdateProviderRequest(
                    name=provider.label,
                    base_url=provider.base_url,
                    api_key=provider.api_key_input,
                    clear_api_key=provider.clear_api_key,
                    enabled=provider.enabled,
                    visible_to_users=provider.visible_to_users,
                    status=provider.status,
                ),
            )
            for model in provider.models:
                self.registry.update_model(
                    model.id,
                    UpdateModelRequest(
                        visible_to_users=model.enabled_for_user,
                        enabled=model.enabled_for_admin,
                        allow_auto_select=model.allow_auto_select,
                    ),
                )
        self.registry.update_routing_policy(
            UpdateRoutingPolicyRequest(
                default_user_model_id=routing.user_default_model,
                default_admin_model_id=routing.admin_default_model,
                allow_user_model_switching=routing.allow_user_model_switch,
            )
        )
        return self.get_admin_catalog()

    def update_permissions(self, permissions: UserPermissionPolicy) -> UserPermissionPolicy:
        return self.managed_config_service.update_permissions(permissions)

    def resolve_model(
        self,
        requested_model: str | None,
        *,
        role: str = "user",
        user_id: str | None = None,
        strategy: str | None = None,
    ) -> tuple[str, str]:
        catalog = self._visible_catalog(role=role, user_id=user_id)
        available_pairs = [(provider.id, model.id) for provider in catalog.providers for model in provider.models]
        if not available_pairs:
            return ("mock", "aurora-mock-chat" if role == "user" else "aurora-mock-admin")

        if requested_model:
            for provider_id, model_id in available_pairs:
                if model_id == requested_model and (role == "admin" or catalog.allow_user_model_switch):
                    return provider_id, model_id

        if catalog.managed_default_model:
            for provider_id, model_id in available_pairs:
                if model_id == catalog.managed_default_model:
                    return provider_id, model_id

        if strategy == "low_cost":
            priced_models = []
            for provider_id, model_id in available_pairs:
                model = self.registry.get_model(model_id)
                price = (model.input_price_per_1k or 0) + (model.output_price_per_1k or 0) if model else 0
                priced_models.append((price, provider_id, model_id))
            priced_models.sort(key=lambda item: item[0])
            return priced_models[0][1], priced_models[0][2]

        if strategy == "high_quality":
            ranked = []
            for provider_id, model_id in available_pairs:
                model = self.registry.get_model(model_id)
                ranked.append((-(model.priority if model else 0), provider_id, model_id))
            ranked.sort()
            return ranked[0][1], ranked[0][2]

        return available_pairs[0]

    def get_provider_runtime(self, provider_id: str):
        runtime = self.registry.get_provider_runtime(provider_id)
        if runtime is None:
            return None

        class RuntimeState:
            def __init__(self, payload: dict):
                self.provider_id = payload["id"]
                self.base_url = payload["base_url"]
                self.configured_model = ""
                self.api_key = payload["api_key"]
                self.has_api_key = bool(payload["api_key"])
                self.api_key_hint = payload["api_key_masked"]
                self.updated_at = payload["updated_at"]

        return RuntimeState(runtime)
