"""Connectivity checks for the backend model providers."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

from google import genai

from app.config import settings


def check_gemini() -> bool:
    if not settings.GEMINI_API_KEY:
        print("GEMINI: missing API key")
        return False

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents="Reply with exactly OK.",
        )
        text = (response.text or "").strip()
        print(f"GEMINI: ok response={text!r}")
        return True
    except Exception as exc:
        print(f"GEMINI: failed error={exc}")
        return False


def check_cerebras() -> bool:
    if not settings.CEREBRAS_API_KEY:
        print("CEREBRAS: missing API key")
        return False

    request = urllib.request.Request(
        "https://api.cerebras.ai/v1/models",
        headers={
            "Authorization": f"Bearer {settings.CEREBRAS_API_KEY}",
            "Content-Type": "application/json",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode())
        model_count = len(payload.get("data", [])) if isinstance(payload, dict) else 0
        print(f"CEREBRAS: ok models={model_count}")
        print("CEREBRAS: configured but not currently used by backend voice/chat path")
        return True
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        print(f"CEREBRAS: failed status={exc.code} body={body[:300]}")
        return False
    except Exception as exc:
        print(f"CEREBRAS: failed error={exc}")
        return False


def main() -> int:
    gemini_ok = check_gemini()
    cerebras_ok = check_cerebras()
    return 0 if gemini_ok and cerebras_ok else 1


if __name__ == "__main__":
    sys.exit(main())
