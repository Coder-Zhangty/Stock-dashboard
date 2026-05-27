from pydantic import BaseModel


class LibraryItem(BaseModel):
    id: str
    owner_id: str | None = None
    name: str
    type: str
    kind: str
    source: str
    size_label: str
    created_at: str


class LibraryListResponse(BaseModel):
    items: list[LibraryItem]
