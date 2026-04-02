import asyncio
import json
import logging

import httpx
import pytest

from src.agent import (
    DEEPGRAM_TTS_MODEL,
    INITIAL_GREETING,
    get_session_id_from_room_name,
    schedule_background_task,
)
from src.session_bridge import SessionBridge


def test_get_session_id_from_room_name_strips_prefix() -> None:
    assert get_session_id_from_room_name("companion-session-123") == "session-123"


def test_get_session_id_from_room_name_preserves_unprefixed_name() -> None:
    assert get_session_id_from_room_name("room-123") == "room-123"


def test_initial_greeting_is_plain_text_for_tts() -> None:
    assert "{" not in INITIAL_GREETING
    assert INITIAL_GREETING.strip()


def test_deepgram_tts_model_uses_documented_plugin_format() -> None:
    assert DEEPGRAM_TTS_MODEL.startswith("aura-2-")
    assert ":" not in DEEPGRAM_TTS_MODEL


def test_process_turn_posts_transcript_and_parses_response() -> None:
    async def run_test() -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/api/v1/voice/internal/voice-turn"
            assert request.method == "POST"
            assert json.loads(request.content.decode()) == {
                "session_id": "session-123",
                "transcript_text": "hello there",
            }
            return httpx.Response(
                200,
                json={
                    "response_text": "Hi back to you",
                    "filler_text": "Let me think",
                    "memory_used": True,
                },
            )

        bridge = SessionBridge(base_url="http://backend:8000")
        bridge._client = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="http://backend:8000",
        )

        result = await bridge.process_turn("session-123", "hello there")

        assert result.response_text == "Hi back to you"
        assert result.filler_text == "Let me think"
        assert result.memory_used is True

        await bridge.close()

    asyncio.run(run_test())

def test_end_session_uses_internal_voice_endpoint() -> None:
    async def run_test() -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/api/v1/voice/internal/session-end"
            assert request.method == "POST"
            assert json.loads(request.content.decode()) == {"session_id": "session-123"}
            return httpx.Response(200, json={"status": "ended"})

        bridge = SessionBridge(base_url="http://backend:8000")
        bridge._client = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="http://backend:8000",
        )

        await bridge.end_session("session-123")

        await bridge.close()

    asyncio.run(run_test())


def test_schedule_background_task_runs_and_cleans_up() -> None:
    async def run_test() -> None:
        tasks: set[asyncio.Task[object]] = set()
        completed = asyncio.Event()

        async def worker() -> None:
            completed.set()

        task = schedule_background_task(tasks, worker(), label="voice-transcript:test")
        assert task in tasks

        await asyncio.wait_for(completed.wait(), timeout=1)
        await task
        await asyncio.sleep(0)

        assert not tasks

    asyncio.run(run_test())


def test_schedule_background_task_logs_failures(caplog: pytest.LogCaptureFixture) -> None:
    async def run_test() -> None:
        tasks: set[asyncio.Task[object]] = set()

        async def worker() -> None:
            raise RuntimeError("boom")

        with caplog.at_level(logging.ERROR, logger="voice-agent"):
            task = schedule_background_task(tasks, worker(), label="voice-close:test")
            with pytest.raises(RuntimeError, match="boom"):
                await task
            await asyncio.sleep(0)

        assert "Background task failed: voice-close:test" in caplog.text
        assert not tasks

    asyncio.run(run_test())
