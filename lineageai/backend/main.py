import logging
import traceback
import asyncio
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai_parser import analyze_file
from scanner import scan_repo

load_dotenv()
logging.basicConfig(level=logging.INFO)


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
    token: str = ""


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
        logging.error("scan_repo failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to access repository: {type(e).__name__}: {e}")

    # Step 2: Run each file through the LLM parser and merge results
    all_tables: list[str] = []
    all_relationships: list[dict] = []
    all_column_lineage: list[dict] = []

    # Run all files through the LLM in parallel
    results = await asyncio.gather(*[analyze_file(f["content"]) for f in files])

    for result in results:
        # Normalize tables — Claude may return strings or dicts like {"name": "TABLE"}
        for t in result.get("tables", []):
            if isinstance(t, dict):
                name = t.get("name") or t.get("table_name") or t.get("table") or str(t)
            else:
                name = str(t)
            if name:
                all_tables.append(name.upper())
        all_relationships.extend(result.get("relationships", []))
        all_column_lineage.extend(_normalize_column_lineage(result.get("column_lineage", [])))

    # Step 3: Deduplicate tables (preserve order)
    unique_tables = list(dict.fromkeys(all_tables))

    # Step 4: Build columns_by_table from normalized column_lineage
    columns_by_table = _build_columns_by_table(all_column_lineage)

    # Step 5: Identify SOR (source-of-record) tables — tables that appear only
    # as source, never as a target, in the column lineage graph
    target_tables = {e.get("target_table", "").lower() for e in all_column_lineage if e.get("target_table")}
    source_tables = {e.get("source_table", "").lower() for e in all_column_lineage if e.get("source_table")}
    sor_set = source_tables - target_tables
    sor_tables = [t for t in unique_tables if t.lower() in sor_set]
    # Fallback: if none detected, use raw_/src_ prefix convention
    if not sor_tables:
        sor_tables = [t for t in unique_tables if t.lower().startswith(("raw_", "src_", "source_"))]

    # Step 6: Extract repo name from URL
    repo_name = _extract_repo_name(request.repo_url)

    return {
        "repo": repo_name,
        "scanned_files": len(files),
        "tables": unique_tables,
        "relationships": all_relationships,
        "column_lineage": all_column_lineage,
        "columns_by_table": columns_by_table,
        "sor_tables": sor_tables,
    }


def _normalize_column_lineage(entries: list) -> list:
    """Normalize all LLM column_lineage variant formats into a canonical dict:
    {target_table, target_column, source_table, source_column, transformation}
    """
    normalized = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue

        # Canonical format already (target_table + target_column + source_table + source_column)
        if entry.get("target_table") and entry.get("source_table"):
            normalized.append({
                "target_table": entry["target_table"],
                "target_column": entry.get("target_column", ""),
                "source_table": entry["source_table"],
                "source_column": entry.get("source_column", ""),
                "transformation": entry.get("transformation", ""),
            })

        # Format: {target_column, source_table, source_column} — missing target_table
        elif entry.get("source_table") and entry.get("target_column"):
            # Handle source_columns array variant
            source_cols = entry.get("source_columns")
            if source_cols and isinstance(source_cols, list):
                for sc in source_cols:
                    if isinstance(sc, dict) and sc.get("table"):
                        normalized.append({
                            "target_table": "",
                            "target_column": entry["target_column"],
                            "source_table": sc["table"],
                            "source_column": sc.get("column", ""),
                            "transformation": entry.get("transformation", ""),
                        })
            else:
                normalized.append({
                    "target_table": "",
                    "target_column": entry["target_column"],
                    "source_table": entry["source_table"],
                    "source_column": entry.get("source_column", ""),
                    "transformation": entry.get("transformation", ""),
                })

        # Format: {target, source} where source is "table.column"
        elif entry.get("source") and "." in str(entry.get("source", "")):
            src = entry["source"]
            parts = src.split(".", 1)
            normalized.append({
                "target_table": "",
                "target_column": entry.get("target") or entry.get("target_column", ""),
                "source_table": parts[0],
                "source_column": parts[1],
                "transformation": entry.get("transformation", ""),
            })

        # source_columns array without source_table
        elif entry.get("target_column") and entry.get("source_columns"):
            for sc in entry["source_columns"]:
                if isinstance(sc, dict) and sc.get("table"):
                    normalized.append({
                        "target_table": "",
                        "target_column": entry["target_column"],
                        "source_table": sc["table"],
                        "source_column": sc.get("column", ""),
                        "transformation": entry.get("transformation", ""),
                    })

    return normalized


def _build_columns_by_table(column_lineage: list) -> dict:
    """Derive {table_name: [col1, col2, ...]} from normalized column_lineage.
    Collects both target and source columns so every table in the lineage graph
    gets its columns surfaced.
    """
    cols: dict = {}
    for entry in column_lineage:
        for tbl_key, col_key in [("target_table", "target_column"), ("source_table", "source_column")]:
            tbl = entry.get(tbl_key, "").strip().lower()
            col = entry.get(col_key, "").strip().lower()
            if tbl and col:
                cols.setdefault(tbl, set()).add(col)
    return {tbl: sorted(col_set) for tbl, col_set in cols.items()}


def _extract_repo_name(repo_url: str) -> str:
    url = repo_url.rstrip("/")
    if "://" in url:
        parts = url.split("/")
        if len(parts) >= 2:
            return f"{parts[-2]}/{parts[-1]}"
    return url
