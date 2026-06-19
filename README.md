# LineageAI

Data lineage visualization for SQL and Python repositories. Point it at a GitHub repo, and it scans every `.sql` and `.py` file, extracts table relationships and column-level lineage using Claude, and renders an interactive ER diagram.

## Quick Start

```bash
cd lineageai
cp .env.example .env
# Edit .env and set CLAUDE_API_KEY
docker-compose up --build
```

Open [http://localhost:3000](http://localhost:3000), enter a GitHub repo URL and a personal access token, and click **Scan Repository**.

## How It Works

1. The backend walks the GitHub repo via the API, collecting `.sql` and `.py` files (skipping `tests`, `vendor`, and `migrations` directories)
2. Each file is sent to Claude (`claude-opus-4-6`) which returns tables, relationships, and column lineage as JSON
3. The frontend renders an ER diagram using Mermaid — click any table to see its column lineage

## Configuration

Copy `lineageai/.env.example` to `lineageai/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_API_KEY` | Yes | Anthropic API key |
| `GITHUB_TOKEN` | No | Fallback token (token can also be entered per-scan) |
| `GITHUB_BASE_URL` | No | Override for GitHub Enterprise (default: `https://api.github.com`) |

## Local Development

**Backend** (Python 3.11+):
```bash
cd lineageai/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (Node 18+):
```bash
cd lineageai/frontend
npm install
npm start
```

## Swapping the LLM

`lineageai/backend/ai_parser.py` is the only file that touches the LLM. Three labeled lines (`LINE A`, `LINE B`, `LINE C`) are the only changes needed to swap Claude for another model such as Llama3 via Ollama.
