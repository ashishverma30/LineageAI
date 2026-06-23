import React, { useRef, useEffect, useMemo, useState } from "react";

const MAX_CARD_COLS = 5;
const KEY_COL = /^id$|_id$|_key$|_pk$|_fk$/i;

// Naming-convention overrides — tables with these prefixes are always ENTITY
// regardless of graph-based classification (LLM sometimes misses RAW→STG hops)
const ENTITY_PREFIX = /^(stg_|int_|base_|intermediate_|staging_|silver_)/i;
// Tables with these prefixes are always SOR (raw source layer)
const SOR_PREFIX    = /^(raw_|src_|source_|bronze_|sor_)/i;
// Tables with these prefixes are always ODL (gold/output layer)
const ODL_PREFIX    = /^(odl_|mart_|gold_|final_|fct_|dim_)/i;

// ── helpers ────────────────────────────────────────────────────

function classifyLayers(data) {
  const sorSet = new Set((data.sor_tables || []).map((t) => t.toLowerCase()));
  const odlSet = new Set((data.odl_tables || []).map((t) => t.toLowerCase()));
  const tables = data.tables || [];

  const isSor    = (t) => (sorSet.has(t.toLowerCase()) || SOR_PREFIX.test(t)) && !ENTITY_PREFIX.test(t) && !ODL_PREFIX.test(t);
  const isOdl    = (t) => (odlSet.has(t.toLowerCase()) || ODL_PREFIX.test(t)) && !ENTITY_PREFIX.test(t) && !SOR_PREFIX.test(t);
  const isEntity = (t) => !isSor(t) && !isOdl(t);

  // Sort each lane so tables with more connections cluster toward the middle,
  // reducing arrow crossings between lanes.
  const connections = buildConnections(data);
  const connCount = (t) => connections.filter(
    ({ from, to }) => from === t.toLowerCase() || to === t.toLowerCase()
  ).length;

  const sorted = (arr) => [...arr].sort((a, b) => connCount(b) - connCount(a));

  return {
    sorTables:    sorted(tables.filter(isSor)),
    entityTables: sorted(tables.filter(isEntity)),
    odlTables:    sorted(tables.filter(isOdl)),
  };
}

function buildConnections(data) {
  const seen = new Set();
  const conns = [];
  const add = (from, to) => {
    from = (from || "").toLowerCase();
    to   = (to   || "").toLowerCase();
    const k = `${from}→${to}`;
    if (from && to && from !== to && !seen.has(k)) { seen.add(k); conns.push({ from, to }); }
  };
  (data.column_lineage || []).forEach((e) => add(e.source_table, e.target_table));
  (data.relationships  || []).forEach((r) => {
    add(
      (r.from || r.from_table || r.source || "").split(".")[0],
      (r.to   || r.to_table   || r.target || "").split(".")[0],
    );
  });
  return conns;
}

/** Reverse-BFS: find all tables that eventually flow INTO targetTable */
function getUpstream(targetTable, connections) {
  const upstream = new Set();
  const queue = [targetTable.toLowerCase()];
  const visited = new Set();
  while (queue.length > 0) {
    const cur = queue.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    connections.forEach(({ from, to }) => {
      if (to === cur && !visited.has(from)) {
        upstream.add(from);
        queue.push(from);
      }
    });
  }
  return upstream;
}

function smartCols(all) {
  const keys  = all.filter((c) => KEY_COL.test(c));
  const rest  = all.filter((c) => !KEY_COL.test(c));
  return [...keys, ...rest].slice(0, MAX_CARD_COLS);
}

// ── sub-components ─────────────────────────────────────────────

function TableCard({ table, colsByTable, variant, cardRefs, onClick, active }) {
  const all  = colsByTable[table.toLowerCase()] || [];
  const cols = smartCols(all);
  return (
    <div
      className={`med-card med-card--${variant}${active ? " med-card--active" : ""}${onClick ? " med-card--clickable" : ""}`}
      ref={(el) => { if (el) cardRefs.current[table.toLowerCase()] = el; }}
      onClick={onClick}
      title={onClick ? `Focus on ${table} lineage` : undefined}
    >
      <div className="med-card__name">
        {table}
        {onClick && <span className="med-card__focus-hint">click to focus</span>}
      </div>
      {cols.length > 0 && (
        <ul className="med-card__cols">
          {cols.map((c) => <li key={c}>{c}</li>)}
          {all.length > MAX_CARD_COLS && (
            <li className="med-card__more">+{all.length - MAX_CARD_COLS} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

function Lane({ title, tables, variant, colsByTable, cardRefs, onCardClick, activeCard }) {
  return (
    <div className={`med-lane med-lane--${variant}`}>
      <div className="med-lane__header">{title}</div>
      {tables.length === 0
        ? <p className="med-lane__empty">None detected</p>
        : tables.map((t) => (
            <TableCard
              key={t}
              table={t}
              colsByTable={colsByTable}
              variant={variant}
              cardRefs={cardRefs}
              onClick={onCardClick ? () => onCardClick(t) : undefined}
              active={activeCard && activeCard.toLowerCase() === t.toLowerCase()}
            />
          ))
      }
    </div>
  );
}

// ── main component ─────────────────────────────────────────────

export default function MedallionView({ data }) {
  const bodyRef    = useRef(null);
  const svgRef     = useRef(null);
  const cardRefs   = useRef({});
  const drawRef    = useRef(null);
  const [focusOdl, setFocusOdl] = useState(null);

  const { sorTables, entityTables, odlTables } = useMemo(() => classifyLayers(data), [data]);
  const connections = useMemo(() => buildConnections(data), [data]);
  const colsByTable = data.columns_by_table || {};

  // When an ODL is focused, filter all three lanes to its upstream path only
  const { visSor, visEntity, visOdl, visConns } = useMemo(() => {
    if (!focusOdl) {
      return { visSor: sorTables, visEntity: entityTables, visOdl: odlTables, visConns: connections };
    }
    const upstream = getUpstream(focusOdl, connections);
    const focusLc  = focusOdl.toLowerCase();
    return {
      visSor:    sorTables.filter((t) => upstream.has(t.toLowerCase())),
      visEntity: entityTables.filter((t) => upstream.has(t.toLowerCase())),
      visOdl:    odlTables.filter((t) => t.toLowerCase() === focusLc),
      visConns:  connections.filter(({ from, to }) =>
        (upstream.has(from) || from === focusLc) &&
        (upstream.has(to)   || to   === focusLc)
      ),
    };
  }, [focusOdl, sorTables, entityTables, odlTables, connections]);

  // Arrow drawing — imperative, same pattern as DiagramView + Mermaid
  drawRef.current = function drawArrows() {
    const svg  = svgRef.current;
    const body = bodyRef.current;
    if (!svg || !body) return;

    // Remove old paths, keep <defs>
    svg.querySelectorAll("path").forEach((p) => p.remove());

    const ns      = "http://www.w3.org/2000/svg";
    const bodyRect = body.getBoundingClientRect();

    visConns.forEach(({ from, to }) => {
      const fEl = cardRefs.current[from];
      const tEl = cardRefs.current[to];
      if (!fEl || !tEl) return;

      const fRect = fEl.getBoundingClientRect();
      const tRect = tEl.getBoundingClientRect();

      // Positions relative to .med-body top-left (getBoundingClientRect diffs are
      // scroll-invariant because both are in the same viewport coordinate space)
      const x1 = fRect.right  - bodyRect.left;
      const y1 = fRect.top    - bodyRect.top + fRect.height / 2;
      const x2 = tRect.left   - bodyRect.left;
      const y2 = tRect.top    - bodyRect.top + tRect.height / 2;
      const cx = x1 + (x2 - x1) * 0.5;

      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#c4cde0");
      path.setAttribute("stroke-width", "1.5");
      path.setAttribute("marker-end", "url(#med-arrow)");
      svg.appendChild(path);
    });
  };

  // Redraw after every render (connections or layout changed)
  useEffect(() => { drawRef.current?.(); });

  // Also redraw on right-panel scroll (parent scrolls, not body itself)
  useEffect(() => {
    const panel = bodyRef.current?.closest(".right-panel");
    if (!panel) return;
    const onScroll = () => drawRef.current?.();
    panel.addEventListener("scroll", onScroll);
    return () => panel.removeEventListener("scroll", onScroll);
  }, []);

  const hasLayers = sorTables.length > 0 || odlTables.length > 0;

  if (!hasLayers) {
    return (
      <div className="med-view">
        <div className="right-panel-empty">
          <div className="right-panel-empty-icon">⬡</div>
          <p>No layered architecture detected</p>
          <span>Select a table from the left panel to view its ER diagram</span>
        </div>
      </div>
    );
  }

  return (
    <div className="med-view">
      <div className="med-view__header">
        <h2 className="section-title">Medallion Architecture</h2>
        <div className="med-view__meta">
          <p className="med-view__subtitle">
            {focusOdl
              ? <>Showing upstream lineage for <strong>{focusOdl}</strong></>
              : <>{sorTables.length} source &rarr; {entityTables.length} entit{entityTables.length === 1 ? "y" : "ies"} &rarr; {odlTables.length} output — <em>click an output table to focus</em></>
            }
          </p>
          {focusOdl && (
            <button className="med-show-all-btn" onClick={() => setFocusOdl(null)}>
              Show all
            </button>
          )}
        </div>
      </div>

      {/* Positioned container — SVG arrows are absolute inside here */}
      <div className="med-body" ref={bodyRef}>
        <div className="med-lanes">
          <Lane title="Source of Record"  tables={visSor}    variant="sor"    colsByTable={colsByTable} cardRefs={cardRefs} />
          <Lane title="Entity Layer"      tables={visEntity} variant="entity" colsByTable={colsByTable} cardRefs={cardRefs} />
          <Lane
            title="Output Data Layer"
            tables={visOdl}
            variant="odl"
            colsByTable={colsByTable}
            cardRefs={cardRefs}
            onCardClick={(t) => setFocusOdl(focusOdl === t ? null : t)}
            activeCard={focusOdl}
          />
        </div>

        <svg ref={svgRef} className="med-arrows" aria-hidden="true">
          <defs>
            <marker id="med-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#c4cde0" />
            </marker>
          </defs>
        </svg>
      </div>
    </div>
  );
}
