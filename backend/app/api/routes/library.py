from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.api.deps import get_current_user, SessionUser
from app.core.config import settings as app_settings
from app.schemas.library import LibraryItem, LibraryListResponse
from app.services.library_service import LibraryService

router = APIRouter(prefix="/library")


@router.get("", response_model=LibraryListResponse)
def list_library_items(
    scope: str = Query(default="mine"),
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> LibraryListResponse:
    service = LibraryService(settings)
    owner_id = None if scope == "all" and user.role == "admin" else user.id
    return LibraryListResponse(items=service.list_items(owner_id=owner_id))


@router.post("/upload", response_model=LibraryItem)
async def upload_library_item(
    file: UploadFile = File(...),
    user: SessionUser = Depends(get_current_user),
    settings = Depends(lambda: app_settings),
) -> LibraryItem:
    service = LibraryService(settings)
    return await service.create_item_from_upload(owner_id=user.id, upload=file)
