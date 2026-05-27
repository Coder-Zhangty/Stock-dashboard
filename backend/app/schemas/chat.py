from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str


class ChatAttachment(BaseModel):
    id: str
    name: str
    type: str
    source: str | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    conversation_id: str | None = None
    model: str | None = None
    mode: str | None = None
    attachments: list[ChatAttachment] = Field(default_factory=list)
    market_context: str | None = None
