"""Companion AI Voice Agent — thin I/O wrapper around FastAPI session core.

Architecture:
- STT (Deepgram Nova-3) captures user speech → finalized transcript
- Agent sends transcript to FastAPI /internal/voice-turn via session_bridge
- FastAPI runs decision engine, memory retrieval, filler generation
- Agent speaks filler (if SEARCH) then main response via session.say()
- TTS (Deepgram Aura-2, voice=athena) synthesizes speech
- No LLM runs in the agent process — all intelligence is in FastAPI
"""

import asyncio
import logging
import os
from collections.abc import Coroutine
from livekit.agents import AgentSession, inference
from dotenv import load_dotenv
from livekit.plugins import google

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    room_io,
)
from livekit.plugins import deepgram, noise_cancellation, silero

try:
    from src.logging_utils import configure_logging
    from src.session_bridge import SessionBridge
except ModuleNotFoundError:  # pragma: no cover - script entrypoint fallback
    from logging_utils import configure_logging
    from session_bridge import SessionBridge

configure_logging()
logger = logging.getLogger("voice-agent")
INITIAL_GREETING = "Hey, I'm here with you. What's on your mind?"
DEEPGRAM_TTS_MODEL = "aura-2-helena-en"

load_dotenv(".env.local")
load_dotenv(".env")


class CompanionAgent(Agent):
    """Voice agent that delegates intelligence to the FastAPI backend.

    The agent has NO LLM — it captures STT transcripts, sends them to
    the backend, and speaks the response. The backend handles decision
    engine, memory retrieval, prompt building, and response generation.
    """

    def __init__(self, session_id: str, bridge: SessionBridge) -> None:
        super().__init__(
            instructions=(
                "You are a companion AI voice assistant. "
                "Listen to the user and respond naturally."
            ),
        )
        self._session_id = session_id
        self._bridge = bridge
        self._processing = False
        self._turn_counter = 0


server = AgentServer()


def get_session_id_from_room_name(room_name: str) -> str:
    """Map the LiveKit room name back to the backend session ID."""
    if room_name.startswith("companion-"):
        return room_name.removeprefix("companion-")
    return room_name


def prewarm(proc: JobProcess):
    """Pre-warm the VAD model for faster startup."""
    logger.info("Prewarming Silero VAD")
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("Silero VAD ready")


server.setup_fnc = prewarm


def schedule_background_task(
    tasks: set[asyncio.Task[object]],
    coro: Coroutine[object, object, object],
    *,
    label: str,
) -> asyncio.Task[object]:
    """Run async event work from LiveKit's synchronous session callbacks."""
    task = asyncio.create_task(coro, name=label)
    tasks.add(task)

    def _finalize(done_task: asyncio.Task[object]) -> None:
        tasks.discard(done_task)
        try:
            done_task.result()
        except Exception:
            logger.exception("Background task failed: %s", label)

    task.add_done_callback(_finalize)
    return task


@server.rtc_session(agent_name="companion-voice")
async def companion_session(ctx: JobContext):
    """Entry point for a voice session.

    The session_id is passed as room metadata by the frontend when it
    creates the LiveKit room (set during token generation).
    """
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    room_name = ctx.room.name
    session_id = get_session_id_from_room_name(room_name)

    backend_url = os.getenv("BACKEND_INTERNAL_URL", "http://localhost:8000")
    bridge = SessionBridge(base_url=backend_url)
    logger.info("Starting voice session for room=%s session=%s", room_name, session_id)
    logger.info("Voice session bridge target=%s", backend_url)

    agent = CompanionAgent(session_id=session_id, bridge=bridge)
    background_tasks: set[asyncio.Task[object]] = set()

    session = AgentSession(
        stt=inference.STT(
            model="deepgram/flux-general",
            language="en"
        ),
        tts=inference.TTS(
            model="deepgram/aura-2", 
            voice="helena", 
            language="en"
        ),
        # vad=ctx.proc.userdata["vad"],
    )

    logger.info("Starting AgentSession for session=%s", session_id)
    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )
    logger.info("AgentSession started for session=%s", session_id)

    logger.info("Connecting RTC context for session=%s", session_id)
    await ctx.connect()
    logger.info("RTC context connected for session=%s room=%s", session_id, room_name)

    async def handle_transcript(ev) -> None:
        """Handle finalized user transcripts."""
        logger.info(
            "Transcript event session=%s is_final=%s text_len=%s",
            session_id,
            ev.is_final,
            len(ev.transcript or ""),
        )
        if not ev.is_final:
            return

        transcript = ev.transcript.strip()
        if not transcript:
            logger.info("Ignoring empty final transcript for session=%s", session_id)
            return

        if agent._processing:
            logger.warning(f"Already processing, skipping transcript: {transcript[:50]}")
            return

        agent._processing = True
        try:
            logger.info("Processing transcript for session=%s: %s", session_id, transcript[:100])

            result = await bridge.process_turn(session_id, transcript)

            if result.filler_text:
                logger.info("Speaking filler for session=%s", session_id)
                handle = session.say(result.filler_text, allow_interruptions=True)
                await handle
                logger.info(
                    "Finished filler for session=%s interrupted=%s",
                    session_id,
                    handle.interrupted,
                )

            if result.response_text:
                agent._turn_counter += 2  # user + agent turns
                logger.info(
                    "Speaking agent response for session=%s turn_id=%s len=%s",
                    session_id,
                    agent._turn_counter,
                    len(result.response_text),
                )
                handle = session.say(result.response_text, allow_interruptions=True)
                await handle
                logger.info(
                    "Finished agent response for session=%s interrupted=%s",
                    session_id,
                    handle.interrupted,
                )

                if handle.interrupted:
                    try:
                        await bridge.mark_interrupted(
                            session_id, agent._turn_counter
                        )
                    except Exception as e:
                        logger.warning(f"Failed to mark interruption: {e}")

        except Exception as e:
            logger.error(f"Error processing voice turn: {e}", exc_info=True)
            try:
                handle = session.say(
                    "Sorry, I had trouble processing that. Could you try again?",
                    allow_interruptions=True,
                )
                await handle
            except Exception:
                pass
        finally:
            agent._processing = False

    async def handle_close() -> None:
        """Clean up when the session ends."""
        logger.info("Voice session closing for session=%s", session_id)
        try:
            await bridge.end_session(session_id)
        except Exception as e:
            logger.warning(f"Failed to end session via bridge: {e}")
        finally:
            await bridge.close()
            logger.info("Voice session closed for session=%s", session_id)

    @session.on("user_input_transcribed")
    def on_transcript(ev) -> None:
        schedule_background_task(
            background_tasks,
            handle_transcript(ev),
            label=f"voice-transcript:{session_id}",
        )

    @session.on("close")
    def on_close(_event) -> None:
        schedule_background_task(
            background_tasks,
            handle_close(),
            label=f"voice-close:{session_id}",
        )

    logger.info("Sending initial greeting for session=%s", session_id)
    greeting = session.say(INITIAL_GREETING, allow_interruptions=True)
    await greeting
    logger.info("Initial greeting completed for session=%s", session_id)


if __name__ == "__main__":
    cli.run_app(server)
