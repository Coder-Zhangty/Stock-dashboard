from pydantic import BaseModel, Field


class UserPreferenceResponse(BaseModel):
    memory_enabled: bool = True
    tone_style: str = "professional"
    warmth: int = 55
    response_length: int = 62
    updated_at: str | None = None


class UserPreferenceUpdateRequest(BaseModel):
    memory_enabled: bool | None = None
    tone_style: str | None = Field(default=None, pattern="^(professional|friendly|quirky|honest)$")
    warmth: int | None = Field(default=None, ge=0, le=100)
    response_length: int | None = Field(default=None, ge=0, le=100)


class UserMemoryResponse(BaseModel):
    id: str
    user_id: str
    content: str
    source_conversation_id: str | None = None
    confidence: float = 0.7
    status: str = "active"
    created_at: str
    updated_at: str
