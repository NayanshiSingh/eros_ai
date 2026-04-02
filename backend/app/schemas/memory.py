"""Memory request/response schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel
from pydantic import Field


class MemoryCreateRequest(BaseModel):
    type: str  # "hot" | "cold"
    field: str | None = None  # for hot memories
    content: str
    tag: str | None = None
    subtype: str | None = None
    entities: list[str] = Field(default_factory=list)
    emotional_weight: float = 0.0
    feedback: Literal["up", "down"] | None = None


class MemoryUpdateRequest(BaseModel):
    content: str | None = None
    tag: str | None = None
    subtype: str | None = None
    entities: list[str] | None = None
    emotional_weight: float | None = None
    feedback: Literal["up", "down"] | None = None


class MemoryResponse(BaseModel):
    id: str
    user_id: str
    type: str
    field: str | None = None
    content: str
    tag: str | None = None
    subtype: str | None = None
    entities: list[str] = Field(default_factory=list)
    emotional_weight: float = 0.0
    feedback: Literal["up", "down"] | None = None
    created_at: datetime
