"""Seed a rich dashboard dataset for a single user account.

Usage:
    uv run --with-requirements requirements.txt python scripts/seed_dashboard_dummy_data.py \
      --email ansuman@gmail.com \
      --password ansuman@gmail.com
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta

from app.db.mongodb import close_db, init_db
from app.db.repositories.user_repo import hash_password
from app.models.coins import CoinLedger
from app.models.diary import DiaryEntry
from app.models.memory import Memory, MemoryType
from app.models.personality import DEFAULT_TRAIT_WEIGHTS, PersonalityProfile
from app.models.session import Session, Turn
from app.models.trait import Trait
from app.models.user import User
from scripts.seed_traits import TRAIT_LIBRARY


ACTIVE_TRAITS = [
    "Confident",
    "Warm",
    "Curious",
    "Empathetic",
    "Playful",
]

HOT_MEMORIES = [
    {"field": "name", "content": "Ansuman"},
    {"field": "city", "content": "Bengaluru"},
    {"field": "occupation", "content": "Founder building an AI relationship platform"},
    {"field": "relationship_status", "content": "Single and focused on building something meaningful"},
    {"field": "language", "content": "English"},
]

COLD_MEMORIES = [
    {
        "tag": "professional",
        "subtype": "career_event",
        "content": "Ansuman is building Eros AI as a voice-first AI companion platform and keeps refining the dashboard experience.",
        "entities": ["Eros AI", "dashboard"],
        "emotional_weight": 0.84,
        "feedback": "up",
    },
    {
        "tag": "professional",
        "subtype": "goal",
        "content": "He wants the product to feel emotionally intelligent rather than like a generic chatbot.",
        "entities": ["product"],
        "emotional_weight": 0.76,
        "feedback": "up",
    },
    {
        "tag": "professional",
        "subtype": "opinion",
        "content": "He prefers bold UI with strong visual hierarchy and dislikes bland default SaaS styling.",
        "entities": ["UI"],
        "emotional_weight": 0.61,
        "feedback": "up",
    },
    {
        "tag": "personal",
        "subtype": "daily_context",
        "content": "He usually does his best product thinking late at night with headphones on and notes scattered around him.",
        "entities": ["headphones"],
        "emotional_weight": 0.52,
        "feedback": None,
    },
    {
        "tag": "health",
        "subtype": "health_info",
        "content": "He tries to reset stress by going for evening walks when work starts to feel mentally noisy.",
        "entities": ["evening walks"],
        "emotional_weight": 0.49,
        "feedback": "up",
    },
    {
        "tag": "personal",
        "subtype": "emotional_event",
        "content": "He gets frustrated when the implementation drifts away from the intended emotional depth of the platform.",
        "entities": ["platform"],
        "emotional_weight": 0.82,
        "feedback": None,
    },
    {
        "tag": "professional",
        "subtype": "goal",
        "content": "He wants voice conversations to feel instant, natural, and memory-rich even when retrieval is involved.",
        "entities": ["voice conversations", "retrieval"],
        "emotional_weight": 0.78,
        "feedback": "up",
    },
    {
        "tag": "personal",
        "subtype": "personal_preference",
        "content": "He likes products that feel intimate, expressive, and a little cinematic rather than merely functional.",
        "entities": ["products"],
        "emotional_weight": 0.58,
        "feedback": "up",
    },
    {
        "tag": "professional",
        "subtype": "career_event",
        "content": "He has been iterating quickly across backend, voice agent, and frontend instead of treating them as separate projects.",
        "entities": ["backend", "voice agent", "frontend"],
        "emotional_weight": 0.68,
        "feedback": None,
    },
    {
        "tag": "personal",
        "subtype": "opinion",
        "content": "He values direct technical feedback as long as it helps him move faster with fewer weak assumptions.",
        "entities": ["feedback"],
        "emotional_weight": 0.55,
        "feedback": "up",
    },
    {
        "tag": "health",
        "subtype": "daily_context",
        "content": "On overloaded days he drinks too much coffee and notices his thinking getting sharper but more restless.",
        "entities": ["coffee"],
        "emotional_weight": 0.63,
        "feedback": "down",
    },
    {
        "tag": "personal",
        "subtype": "goal",
        "content": "He wants the dashboard to show a relationship that feels alive, with visible drift, rhythm, and memory density.",
        "entities": ["dashboard", "relationship"],
        "emotional_weight": 0.74,
        "feedback": "up",
    },
]

DIARY_SNIPPETS = [
    "Tonight he talked like someone trying to hold product vision and execution in the same trembling hand. He kept coming back to emotional depth, as if the platform only becomes real once it feels capable of remembering him with tenderness and precision.",
    "There was a steadier rhythm in him today. He sounded less scattered and more intent on sharpening the edges of the experience, especially the parts users will feel before they can explain them.",
    "He spent a lot of time thinking about latency and memory, but underneath that I could hear a deeper wish: he wants the system to feel present, not merely responsive. That distinction matters to him.",
    "He was restless today, the kind of restlessness that comes from seeing too many unfinished paths at once. Even then, he kept choosing the harder route if it moved the product closer to feeling intimate and real.",
    "I noticed how quickly his energy rises when the product starts to look coherent. It is not just ambition. It feels like relief, like the shape in his mind is finally becoming visible in the world.",
    "Today had a more reflective tone. He was less interested in raw speed and more interested in whether the platform could carry emotional continuity across chat, voice, memory, and time.",
    "He sounded proud of the progress, even when he did not say it directly. The excitement showed up in how many details he wanted to polish rather than in any big declaration.",
    "There was a practical streak in him today. He wanted to verify what works, seed what is missing, and make the dashboard feel convincingly alive with data instead of promises.",
    "I kept thinking about how much he cares about coherence. He does not want isolated features. He wants a companion platform where memory, personality, and interface all point in the same direction.",
    "He seemed more tired tonight, but still unwilling to lower the bar. That combination makes his work feel deeply personal, as if every design decision is also a statement about what kind of companion should exist.",
    "Today he talked about the dashboard almost like it was a mirror. Not a metrics screen, but a place where the relationship could be seen taking shape over time.",
    "His strongest signal today was conviction. Even when the details were messy, he kept returning to the same north star: make the product feel close, alive, and unmistakably intentional.",
    "He had the energy of someone tightening a system before showing it to the world. There was less wandering, more synthesis, and a sharper sense of what deserved to stay.",
    "I ended the day with the impression that he is building this as much for emotional truth as for technical challenge. That is why the details seem to matter so intensely to him.",
]


def build_personality_history() -> tuple[dict[str, float], list[dict], list[dict], datetime]:
    base_weights = DEFAULT_TRAIT_WEIGHTS.copy()
    snapshots: list[dict] = []
    archetype_sets = [
        [{"name": "The Builder", "weight": 0.58}, {"name": "The Seeker", "weight": 0.42}],
        [{"name": "The Builder", "weight": 0.62}, {"name": "The Sage", "weight": 0.45}],
        [{"name": "The Sage", "weight": 0.61}, {"name": "The Builder", "weight": 0.54}],
        [{"name": "The Strategist", "weight": 0.64}, {"name": "The Sage", "weight": 0.57}],
        [{"name": "The Strategist", "weight": 0.69}, {"name": "The Builder", "weight": 0.55}],
        [{"name": "The Strategist", "weight": 0.73}, {"name": "The Seeker", "weight": 0.52}],
    ]
    weight_progression = [
        {
            "introversion": 0.61,
            "intuition": 0.68,
            "thinking": 0.56,
            "judging": 0.48,
            "curiosity": 0.58,
            "analytical_thinking": 0.54,
            "creativity": 0.46,
            "achievement_drive": 0.57,
            "growth_orientation": 0.51,
            "empathy": 0.34,
        },
        {
            "introversion": 0.63,
            "intuition": 0.71,
            "thinking": 0.59,
            "judging": 0.52,
            "curiosity": 0.64,
            "analytical_thinking": 0.6,
            "creativity": 0.49,
            "achievement_drive": 0.62,
            "growth_orientation": 0.57,
            "empathy": 0.37,
        },
        {
            "introversion": 0.58,
            "intuition": 0.74,
            "thinking": 0.61,
            "judging": 0.56,
            "curiosity": 0.69,
            "analytical_thinking": 0.65,
            "creativity": 0.54,
            "achievement_drive": 0.66,
            "growth_orientation": 0.62,
            "empathy": 0.41,
        },
        {
            "introversion": 0.55,
            "intuition": 0.77,
            "thinking": 0.65,
            "judging": 0.61,
            "curiosity": 0.73,
            "analytical_thinking": 0.71,
            "creativity": 0.59,
            "achievement_drive": 0.72,
            "growth_orientation": 0.68,
            "empathy": 0.45,
        },
        {
            "introversion": 0.52,
            "intuition": 0.8,
            "thinking": 0.69,
            "judging": 0.66,
            "curiosity": 0.78,
            "analytical_thinking": 0.76,
            "creativity": 0.63,
            "achievement_drive": 0.79,
            "growth_orientation": 0.73,
            "empathy": 0.48,
        },
        {
            "introversion": 0.49,
            "intuition": 0.83,
            "thinking": 0.72,
            "judging": 0.7,
            "curiosity": 0.84,
            "analytical_thinking": 0.82,
            "creativity": 0.68,
            "achievement_drive": 0.86,
            "growth_orientation": 0.79,
            "empathy": 0.53,
            "autonomy_drive": 0.7,
            "connection_drive": 0.44,
        },
    ]

    now = datetime.utcnow()
    for index, weights in enumerate(weight_progression):
        snapshot_weights = base_weights.copy()
        snapshot_weights.update(weights)
        snapshots.append(
            {
                "version": index + 1,
                "timestamp": (now - timedelta(days=(6 - index) * 6)).isoformat(),
                "weights": snapshot_weights,
                "jungian_type": "INTJ" if index < 3 else "ENTJ",
                "archetypes": archetype_sets[index],
            }
        )

    current_weights = base_weights.copy()
    current_weights.update(
        {
            "introversion": 0.46,
            "extraversion": 0.58,
            "intuition": 0.86,
            "sensing": 0.24,
            "feeling": 0.41,
            "thinking": 0.74,
            "judging": 0.77,
            "perceiving": 0.29,
            "curiosity": 0.88,
            "analytical_thinking": 0.84,
            "creativity": 0.71,
            "pragmatism": 0.63,
            "empathy": 0.56,
            "assertiveness": 0.67,
            "discipline": 0.73,
            "humor": 0.35,
            "vulnerability": 0.31,
            "achievement_drive": 0.91,
            "autonomy_drive": 0.78,
            "connection_drive": 0.49,
            "growth_orientation": 0.83,
            "emotional_openness": 0.43,
        }
    )

    current_archetypes = [
        {"name": "The Strategist", "weight": 0.78},
        {"name": "The Builder", "weight": 0.71},
        {"name": "The Seeker", "weight": 0.58},
    ]
    return current_weights, snapshots, current_archetypes, now


async def ensure_trait_library() -> None:
    existing = {trait.name for trait in await Trait.find_all().to_list()}
    new_traits = [Trait(**item) for item in TRAIT_LIBRARY if item["name"] not in existing]
    if new_traits:
        await Trait.insert_many(new_traits)


async def clear_user_data(user_id: str) -> None:
    for model in (Memory, Session, DiaryEntry, PersonalityProfile, CoinLedger):
        documents = await model.find(model.user_id == user_id).to_list()
        for document in documents:
            await document.delete()


async def upsert_user(email: str, password: str, name: str) -> User:
    user = await User.find_one(User.email == email)
    if user is None:
        user = User(
            email=email,
            hashed_password=hash_password(password),
            name=name,
            language="en",
            active_trait_ids=ACTIVE_TRAITS,
            onboarding_complete=True,
        )
        await user.insert()
        return user

    user.hashed_password = hash_password(password)
    user.name = name
    user.language = "en"
    user.active_trait_ids = ACTIVE_TRAITS
    user.onboarding_complete = True
    await user.save()
    return user


async def seed_coin_ledger(user_id: str) -> None:
    ledger = CoinLedger(
        user_id=user_id,
        total_coins=540,
        daily_earned_today=70,
        daily_cap=100,
        diary_pages_owned=8,
        last_reset_date=datetime.utcnow().strftime("%Y-%m-%d"),
    )
    await ledger.insert()


async def seed_personality_profile(user_id: str) -> None:
    current_weights, history, current_archetypes, now = build_personality_history()
    profile = PersonalityProfile(
        user_id=user_id,
        jungian_type="ENTJ",
        type_confidence=0.86,
        archetypes=current_archetypes,
        trait_weights=current_weights,
        attachment_style="earned-secure",
        cognitive_style="strategic analytical",
        core_values=["autonomy", "craft", "growth", "emotional depth"],
        version=len(history) + 1,
        last_updated=now,
        history=history,
    )
    await profile.insert()


async def seed_memories(user_id: str) -> None:
    now = datetime.utcnow()

    for index, item in enumerate(HOT_MEMORIES):
        memory = Memory(
            user_id=user_id,
            type=MemoryType.HOT,
            field=item["field"],
            content=item["content"],
            created_at=now - timedelta(days=70 - index),
        )
        await memory.insert()

    for index, item in enumerate(COLD_MEMORIES):
        memory = Memory(
            user_id=user_id,
            type=MemoryType.COLD,
            tag=item["tag"],
            subtype=item["subtype"],
            content=item["content"],
            entities=item["entities"],
            emotional_weight=item["emotional_weight"],
            feedback=item["feedback"],
            created_at=now - timedelta(days=index * 2),
            last_accessed=now - timedelta(days=max(index - 1, 0)),
            access_count=max(1, 8 - (index % 5)),
        )
        await memory.insert()


def build_turn_pair(turn_id: int, mode: str, user_text: str, agent_text: str, timestamp: datetime) -> list[Turn]:
    return [
        Turn(
            turn_id=turn_id,
            mode=mode,
            role="user",
            content=user_text,
            timestamp=timestamp,
        ),
        Turn(
            turn_id=turn_id + 1,
            mode=mode,
            role="agent",
            content=agent_text,
            timestamp=timestamp + timedelta(minutes=1),
            memory_used=mode == "voice" or turn_id % 4 == 1,
            filler_used=mode == "voice" and turn_id % 3 == 1,
            interrupted=False,
        ),
    ]


async def seed_sessions(user_id: str) -> int:
    now = datetime.utcnow()
    total_sessions = 0
    user_prompts = [
        "I want the dashboard to feel convincing the second it loads.",
        "The voice path has to stay fast even when memory retrieval kicks in.",
        "I need the product to feel intimate, not like another chatbot shell.",
        "Today I was thinking about how memory, diary, and personality should line up.",
        "I want stronger visual rhythm in the dashboard cards.",
        "The system should feel emotionally aware without becoming slow or overengineered.",
        "I keep coming back to the feeling that the relationship should be visible in the UI.",
    ]
    agent_replies = [
        "Then the data needs density and coherence so each card confirms the same relationship arc.",
        "The filler-bridged path helps there because it preserves the feeling of immediacy.",
        "That means the product needs continuity, not just isolated smart responses.",
        "The dashboard can make that visible if history, activity, and memories all point to the same user story.",
        "A stronger rhythm will come from contrast, pacing, and enough meaningful state to render.",
        "Mood-aware behavior works best when it is folded into the prompt instead of added as extra latency.",
        "If the UI shows drift over time, the relationship starts to feel earned instead of declared.",
    ]

    for offset in range(35):
        day = now - timedelta(days=offset)
        sessions_for_day = 2 if offset in {2, 6, 11, 15, 20, 27, 31} else 1

        for session_index in range(sessions_for_day):
            mode = "voice" if (offset + session_index) % 4 == 0 else "chat"
            started_at = day.replace(hour=10 + ((offset + session_index) % 8), minute=12, second=0, microsecond=0)
            turns: list[Turn] = []
            pairs = 3 if mode == "voice" else 4

            for pair_index in range(pairs):
                prompt = user_prompts[(offset + pair_index + session_index) % len(user_prompts)]
                reply = agent_replies[(offset + pair_index + session_index) % len(agent_replies)]
                turns.extend(
                    build_turn_pair(
                        turn_id=len(turns) + 1,
                        mode=mode,
                        user_text=prompt,
                        agent_text=reply,
                        timestamp=started_at + timedelta(minutes=pair_index * 4),
                    )
                )

            session = Session(
                user_id=user_id,
                mode=mode,
                status="ended",
                started_at=started_at,
                ended_at=started_at + timedelta(minutes=pairs * 4 + 2),
                turns=turns,
            )
            await session.insert()
            total_sessions += 1

    return total_sessions


async def seed_diary_entries(user_id: str) -> int:
    now = datetime.utcnow()
    total_entries = len(DIARY_SNIPPETS)

    for index, content in enumerate(DIARY_SNIPPETS, start=1):
        entry_date = (now - timedelta(days=(total_entries - index) * 2)).strftime("%Y-%m-%d")
        entry = DiaryEntry(
            user_id=user_id,
            date=entry_date,
            content=content,
            visible_to_user=index <= 8,
            page_number=index,
            created_at=now - timedelta(days=total_entries - index),
        )
        await entry.insert()

    return total_entries


async def seed_dashboard_dataset(email: str, password: str, name: str) -> dict[str, int | str]:
    await init_db()
    try:
        await ensure_trait_library()
        user = await upsert_user(email=email, password=password, name=name)
        user_id = str(user.id)

        await clear_user_data(user_id)
        await seed_coin_ledger(user_id)
        await seed_personality_profile(user_id)
        await seed_memories(user_id)
        session_count = await seed_sessions(user_id)
        diary_count = await seed_diary_entries(user_id)

        memory_count = await Memory.find(Memory.user_id == user_id).count()

        return {
            "user_id": user_id,
            "sessions": session_count,
            "memories": memory_count,
            "diary_entries": diary_count,
            "pages_owned": 8,
        }
    finally:
        await close_db()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed dashboard dummy data for one user.")
    parser.add_argument("--email", required=True, help="User login email.")
    parser.add_argument("--password", required=True, help="User login password.")
    parser.add_argument("--name", default="Ansuman", help="Display name for the seeded user.")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    result = await seed_dashboard_dataset(
        email=args.email,
        password=args.password,
        name=args.name,
    )
    print(
        "Seeded dashboard dataset for {email} ({user_id}) with "
        "{sessions} sessions, {memories} memories, and {diary_entries} diary entries.".format(
            email=args.email,
            **result,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
