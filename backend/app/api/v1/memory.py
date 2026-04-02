"""Memory API routes — CRUD endpoints (debug/admin)."""

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.memory import MemoryCreateRequest, MemoryUpdateRequest, MemoryResponse
from app.db.repositories import memory_repo

router = APIRouter()


def to_memory_response(memory) -> MemoryResponse:
    return MemoryResponse(
        id=str(memory.id),
        user_id=memory.user_id,
        type=memory.type.value,
        field=memory.field,
        content=memory.content,
        tag=memory.tag,
        subtype=memory.subtype,
        entities=memory.entities,
        emotional_weight=memory.emotional_weight,
        feedback=memory.feedback,
        created_at=memory.created_at,
    )


@router.get("/hot", response_model=list[MemoryResponse])
async def get_hot_memories(user: User = Depends(get_current_user)):
    """List all hot memories for the current user."""
    memories = await memory_repo.get_hot_memories(str(user.id))
    return [to_memory_response(memory) for memory in memories]


@router.get("/cold", response_model=list[MemoryResponse])
async def get_cold_memories(user: User = Depends(get_current_user)):
    """List all cold memories for the current user."""
    memories = await memory_repo.get_cold_memories(str(user.id))
    return [to_memory_response(memory) for memory in memories]


@router.post("/", response_model=MemoryResponse, status_code=201)
async def create_memory(body: MemoryCreateRequest, user: User = Depends(get_current_user)):
    """Create a new memory (hot or cold)."""
    m = await memory_repo.create_memory(str(user.id), body.model_dump())
    return to_memory_response(m)


@router.patch("/{mem_id}", response_model=MemoryResponse)
async def update_memory(mem_id: str, body: MemoryUpdateRequest, user: User = Depends(get_current_user)):
    """Update an existing memory."""
    updates = body.model_dump(exclude_none=True)
    m = await memory_repo.update_memory(mem_id, updates)
    return to_memory_response(m)


@router.delete("/{mem_id}", status_code=204)
async def delete_memory(mem_id: str, user: User = Depends(get_current_user)):
    """Delete a memory."""
    await memory_repo.delete_memory(mem_id)
