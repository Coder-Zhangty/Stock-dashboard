from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, verify_csrf
from app.core.config import settings as app_settings
from app.schemas.auth import SessionUser
from app.schemas.platform import (
    ConversationResponse,
    CreateConversationRequest,
    ImportLocalConversationsRequest,
    MessageResponse,
    ReplaceConversationMessagesRequest,
    UpdateConversationRequest,
)
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations")


@router.get("", response_model=list[ConversationResponse])
def list_conversations(
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> list[ConversationResponse]:
    return ConversationService(settings).list_conversations(user.id)


@router.post("", response_model=ConversationResponse)
def create_conversation(
    payload: CreateConversationRequest,
    _: None = Depends(verify_csrf),
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> ConversationResponse:
    return ConversationService(settings).create_conversation(
        user_id=user.id,
        title=payload.title,
        selected_model_id=payload.selected_model_id,
        auto_model_strategy=payload.auto_model_strategy,
    )


@router.post("/import-local", response_model=list[ConversationResponse])
def import_local_conversations(
    payload: ImportLocalConversationsRequest,
    _: None = Depends(verify_csrf),
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> list[ConversationResponse]:
    return ConversationService(settings).import_local_conversations(
        user_id=user.id,
        conversations=payload.conversations,
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> ConversationResponse:
    conversation = ConversationService(settings).get_conversation(conversation_id, user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conversation


@router.patch("/{conversation_id}", response_model=ConversationResponse)
def update_conversation(
    conversation_id: str,
    payload: UpdateConversationRequest,
    _: None = Depends(verify_csrf),
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> ConversationResponse:
    conversation = ConversationService(settings).update_conversation(
        conversation_id=conversation_id,
        user_id=user.id,
        title=payload.title,
        selected_model_id=payload.selected_model_id,
        auto_model_strategy=payload.auto_model_strategy,
        archived=payload.archived,
    )
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conversation


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    _: None = Depends(verify_csrf),
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> dict[str, bool]:
    deleted = ConversationService(settings).delete_conversation(conversation_id, user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return {"success": True}


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def list_conversation_messages(
    conversation_id: str,
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> list[MessageResponse]:
    return ConversationService(settings).list_messages(conversation_id, user.id)


@router.put("/{conversation_id}/messages", response_model=list[MessageResponse])
def replace_conversation_messages(
    conversation_id: str,
    payload: ReplaceConversationMessagesRequest,
    _: None = Depends(verify_csrf),
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> list[MessageResponse]:
    messages = ConversationService(settings).replace_messages(
        conversation_id=conversation_id,
        user_id=user.id,
        messages=payload.messages,
    )
    if messages is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return messages
