"""
ai_parser.py — the ONLY file that knows about the LLM.

To swap Claude for Llama3, change these 3 lines:
  LINE A: import anthropic  →  import ollama  (or your Llama3 client)
  LINE B: client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))  →  client = ollama.Client()
  LINE C: The _call_llm() function body — replace Anthropic messages API with Llama3 equivalent
"""

import asyncio
import json
import os
import re
from functools import partial

import anthropic  # LINE A — swap this import for Llama3


SYSTEM_PROMPT = (
    "You are a data lineage expert. Analyze SQL and Python files. "
    "Return ONLY valid JSON, no explanation, no markdown."
)

USER_PROMPT_TEMPLATE = (
    "Extract all tables, columns, joins, and lineage from this file. "
    "Return JSON with keys: tables, relationships, column_lineage. "
    "FILE:\n{content}"
)

EMPTY_RESULT = {"tables": [], "relationships": [], "column_lineage": []}


def _get_client():
    # LINE B — swap this for Llama3 client initialization
    return anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))


def _call_llm(client, content: str) -> str:
    # LINE C — replace this block with your Llama3 API call
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": USER_PROMPT_TEMPLATE.format(content=content)}],
    )
    return message.content[0].text


def _parse_json(raw: str) -> dict:
    """Strip markdown fences then parse JSON. Returns EMPTY_RESULT on any failure."""
    # Remove ```json ... ``` or ``` ... ``` fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    try:
        parsed = json.loads(cleaned)
        return {
            "tables": parsed.get("tables", []),
            "relationships": parsed.get("relationships", []),
            "column_lineage": parsed.get("column_lineage", []),
        }
    except (json.JSONDecodeError, AttributeError):
        return dict(EMPTY_RESULT)


async def analyze_file(content: str) -> dict:
    """Call LLM on a single file's content. Runs sync client in thread pool. Never raises."""
    try:
        client = _get_client()
        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, partial(_call_llm, client, content))
        return _parse_json(raw)
    except Exception:
        return dict(EMPTY_RESULT)
