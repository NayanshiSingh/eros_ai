"""Decision engine — parses and strips routing tokens from the LLM stream."""

import re
from typing import AsyncIterator

from app.utils.logger import get_logger

logger = get_logger(__name__)
_DECISION_PREFIX = re.compile(r"^\s*(NO_SEARCH|SEARCH)\b[\s:,-]*", re.IGNORECASE)


async def _prepend_to_stream(token: str, stream: AsyncIterator[str]) -> AsyncIterator[str]:
    """Yield a token first, then continue with the rest of the stream."""
    yield token
    async for chunk in stream:
        yield chunk


def _extract_decision_prefix(chunk: str) -> tuple[str | None, str]:
    """Parse a leading decision token from a chunk and return the remainder."""
    match = _DECISION_PREFIX.match(chunk)
    if not match:
        return None, chunk

    decision = match.group(1).upper()
    remainder = chunk[match.end():].lstrip()
    return decision, remainder


async def strip_leading_decision_token(stream: AsyncIterator[str]) -> AsyncIterator[str]:
    """Remove a leading SEARCH/NO_SEARCH token from a stream if present."""
    try:
        first_chunk = await stream.__anext__()
    except StopAsyncIteration:
        return

    _, remainder = _extract_decision_prefix(first_chunk)
    if remainder:
        yield remainder

    async for chunk in stream:
        yield chunk


async def get_decision_token(stream: AsyncIterator[str]) -> tuple[str, AsyncIterator[str]]:
    """Read the first token from the LLM stream and classify it.

    Returns:
        tuple: (decision, remaining_stream)
            - decision: "SEARCH" | "NO_SEARCH"
            - remaining_stream: async iterator for the rest of the response

    If the first token is neither SEARCH nor NO_SEARCH, we treat it as
    NO_SEARCH and prepend it back into the stream so it's not lost.
    """
    try:
        first_chunk = await stream.__anext__()
    except StopAsyncIteration:
        logger.warning("Empty LLM stream — defaulting to NO_SEARCH")
        return "NO_SEARCH", _empty_stream()

    token, remainder = _extract_decision_prefix(first_chunk)

    if token == "SEARCH":
        logger.info("Decision: SEARCH")
        return "SEARCH", stream
    elif token == "NO_SEARCH":
        logger.info("Decision: NO_SEARCH")
        if remainder:
            return "NO_SEARCH", _prepend_to_stream(remainder, stream)
        return "NO_SEARCH", stream
    else:
        # The LLM didn't follow instructions — the first chunk is actual content.
        # Prepend it back and continue as NO_SEARCH.
        logger.info(f"Decision: fallthrough (token was '{first_chunk.strip()[:50]}')")
        return "NO_SEARCH", _prepend_to_stream(first_chunk, stream)


async def _empty_stream() -> AsyncIterator[str]:
    """An empty async generator."""
    return
    yield  # type: ignore  # makes this a generator
