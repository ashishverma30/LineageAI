"""
ai_parser.py — the ONLY file that knows about the LLM.

To swap Claude for Llama3, change these 3 lines:
  LINE A: import anthropic  →  import ollama  (or your Llama3 client)
  LINE B: client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))  →  client = ollama.Client()
  LINE C: The _call_llm() function body — replace Anthropic messages API with Llama3 equivalent
"""

import asyncio
import hashlib
import json
import os
import re
from functools import partial

import anthropic  # LINE A — swap this import for Llama3

# File-level LLM cache: sha256(content) → parsed result dict
_llm_cache: dict[str, dict] = {}
_MAX_FILE_CACHE = 500


SYSTEM_PROMPT = (
    "You are a data lineage expert. Analyze SQL and Python files. "
    "Return ONLY valid JSON, no explanation, no markdown."
)

USER_PROMPT_TEMPLATE = (
    "Extract all tables, columns, joins, and lineage from this file. "
    "Return ONLY valid JSON with exactly these keys:\n"
    '  "tables": list of table name strings\n'
    '  "relationships": list of {{"from": "table", "to": "table", "key": "column"}}\n'
    '  "column_lineage": list of {{"target_table": "table", "target_column": "col", '
    '"source_table": "table", "source_column": "col", "transformation": "optional"}}\n'
    "Every column_lineage entry MUST have target_table, target_column, source_table, and source_column.\n"
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
        temperature=0,
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
    cache_key = hashlib.sha256(content.encode()).hexdigest()
    if cache_key in _llm_cache:
        return dict(_llm_cache[cache_key])
    try:
        client = _get_client()
        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, partial(_call_llm, client, content))
        result = _parse_json(raw)
        if len(_llm_cache) < _MAX_FILE_CACHE:
            _llm_cache[cache_key] = result
        return dict(result)
    except Exception:
        return dict(EMPTY_RESULT)


def cache_stats() -> dict:
    return {"file_cache_size": len(_llm_cache), "file_cache_max": _MAX_FILE_CACHE}


def clear_file_cache() -> None:
    _llm_cache.clear()
