# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LineageAI is a data lineage visualization tool. It accepts a GitHub repository URL and token, scans all `.sql` and `.py` files, sends each file to Claude (Anthropic) for lineage extraction, and renders an interactive ER diagram in the browser.

## Commands

### Run with Docker (recommended)
```bash
cd lineageai
cp .env.example .env  # fill in CLAUDE_API_KEY and optionally GITHUB_TOKEN
docker-compose up --build
# Backend: http://localhost:8000  Frontend: http://localhost:3000
```

### Run backend locally
```bash
cd lineageai/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Run frontend locally
```bash
cd lineageai/frontend
npm install
npm start  # http://localhost:3000
```

### Backend API
- `GET /health` — health check
- `POST /scan` — body: `{"repo_url": "...", "token": "..."}` — returns lineage data

## Architecture

### Data Flow
1. User submits GitHub repo URL + PAT via `ScanForm`
2. Backend (`main.py:/scan`) calls `scanner.py:scan_repo()` which walks the repo tree via PyGithub, collecting `.sql` and `.py` files (skips `test`, `tests`, `vendor`, `__pycache__`, `migrations` directories)
3. Each file's content is passed to `ai_parser.py:analyze_file()`, which calls Claude (`claude-opus-4-6`) and returns structured JSON
4. Results are merged and deduplicated, then returned to the frontend
5. Frontend renders a Mermaid ER diagram (`DiagramView`); clicking a table node opens `LineagePanel` showing column lineage

### LLM Response Schema
Claude returns (and `ai_parser.py` validates):
```json
{
  "tables": ["table_name"],
  "relationships": [{"from": "A", "to": "B", "key": "FK_col"}],
  "column_lineage": [{"table": "A", "columns": [{"name": "col", "source": "B.col", "transformation": "cast"}]}]
}
```

### Swapping the LLM
`ai_parser.py` is the only file that knows about the LLM. Three labeled lines (LINE A, LINE B, LINE C) are the only changes needed to swap Claude for another model (e.g., Llama3/Ollama).

### Frontend State
All state lives in `App.jsx` and flows down as props. `DiagramView` uses Mermaid's `render()` API imperatively (not React-controlled) and attaches click handlers to SVG entity nodes after each render.

## Environment Variables
Defined in `lineageai/.env` (copy from `.env.example`):
- `CLAUDE_API_KEY` — required, Anthropic API key
- `GITHUB_TOKEN` — optional fallback token (token is also accepted per-request)
- `GITHUB_BASE_URL` — defaults to `https://api.github.com`; override for GitHub Enterprise
