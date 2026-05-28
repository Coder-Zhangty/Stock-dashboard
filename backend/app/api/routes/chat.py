from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user, get_optional_user, SessionUser
from app.core.config import settings
from app.schemas.chat import ChatRequest
from app.schemas.preferences import (
    UserMemoryResponse,
    UserPreferenceResponse,
    UserPreferenceUpdateRequest,
)
from app.schemas.provider_catalog import ProviderCatalogResponse
from app.schemas.workspace import WorkspaceSummaryResponse
from app.services.chat_service import ChatService
from app.services.provider_catalog_service import ProviderCatalogService
from app.services.user_memory_service import UserMemoryService
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/chat")


@router.post("")
async def chat(
    request: ChatRequest,

    user: SessionUser = Depends(get_current_user),
) -> StreamingResponse:
    service = ChatService(settings)
    stream = service.stream_chat(
        request.messages,
        user=user,
        conversation_id=request.conversation_id,
        model=request.model,
        mode=request.mode,
        attachments=request.attachments,
        market_context=request.market_context,
    )
    return StreamingResponse(stream, media_type="text/event-stream")


@router.get("/providers", response_model=ProviderCatalogResponse)
def get_provider_catalog(
    user: SessionUser | None = Depends(get_optional_user),
) -> ProviderCatalogResponse:
    service = ProviderCatalogService(settings)
    if user:
        return service.get_catalog_for_user(user)
    return service.get_catalog()


@router.get("/workspace", response_model=WorkspaceSummaryResponse)
def get_workspace_summary(
    user: SessionUser | None = Depends(get_optional_user),
) -> WorkspaceSummaryResponse:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user is required for workspace summary.",
        )
    return WorkspaceService(settings).get_workspace_summary(user)


@router.get("/preferences", response_model=UserPreferenceResponse)
def get_preferences(
    user: SessionUser = Depends(get_current_user),
) -> UserPreferenceResponse:
    return UserMemoryService(settings).ensure_preferences(user.id)


@router.put("/preferences", response_model=UserPreferenceResponse)
def update_preferences(
    payload: UserPreferenceUpdateRequest,

    user: SessionUser = Depends(get_current_user),
) -> UserPreferenceResponse:
    return UserMemoryService(settings).update_preferences(user.id, payload)


@router.get("/memories", response_model=list[UserMemoryResponse])
def list_memories(
    user: SessionUser = Depends(get_current_user),
) -> list[UserMemoryResponse]:
    return UserMemoryService(settings).list_memories(user.id)


@router.delete("/memories/{memory_id}")
def delete_memory(
    memory_id: str,

    user: SessionUser = Depends(get_current_user),
) -> dict[str, bool]:
    deleted = UserMemoryService(settings).delete_memory(user.id, memory_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")
    return {"success": True}
