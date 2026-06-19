from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai_parser import analyze_file
from scanner import scan_repo

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="LineageAI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    repo_url: str
    token: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/scan")
async def scan(request: ScanRequest):
    # Step 1: Walk the repo and collect .sql / .py files
    try:
        files = await scan_repo(request.repo_url, request.token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to access repository: {str(e)}")

    # Step 2: Run each file through the LLM parser and merge results
    all_tables: list[str] = []
    all_relationships: list[dict] = []
    all_column_lineage: list[dict] = []

    for file in files:
        result = await analyze_file(file["content"])
        all_tables.extend(result.get("tables", []))
        all_relationships.extend(result.get("relationships", []))
        all_column_lineage.extend(result.get("column_lineage", []))

    # Step 3: Deduplicate tables
    unique_tables = list(dict.fromkeys(all_tables))

    # Step 4: Extract repo name from URL
    repo_name = _extract_repo_name(request.repo_url)

    return {
        "repo": repo_name,
        "scanned_files": len(files),
        "tables": unique_tables,
        "relationships": all_relationships,
        "column_lineage": all_column_lineage,
    }


def _extract_repo_name(repo_url: str) -> str:
    url = repo_url.rstrip("/")
    if "://" in url:
        parts = url.split("/")
        if len(parts) >= 2:
            return f"{parts[-2]}/{parts[-1]}"
    return url
