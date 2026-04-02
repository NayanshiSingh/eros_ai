"""Connectivity checks for the voice agent's Deepgram configuration."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")


def main() -> int:
    api_key = os.getenv("DEEPGRAM_API_KEY", "").strip()
    if not api_key:
        print("DEEPGRAM: missing API key")
        return 1

    request = urllib.request.Request(
        "https://api.deepgram.com/v1/models",
        headers={
            "Authorization": f"Token {api_key}",
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode())
        model_count = len(payload.get("models", [])) if isinstance(payload, dict) else 0
        print(f"DEEPGRAM: ok models={model_count}")
        return 0
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        print(f"DEEPGRAM: failed status={exc.code} body={body[:300]}")
        return 1
    except Exception as exc:
        print(f"DEEPGRAM: failed error={exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
