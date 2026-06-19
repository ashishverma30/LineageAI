import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  er: { diagramPadding: 20, layoutDirection: "TB" },
});

function extractTable(val) {
  return val && val.includes(".") ? val.split(".")[0] : val;
}

function extractCol(val) {
  return val && val.includes(".") ? val.split(".")[1] : null;
}

/** Return only the selected table + its direct relationship neighbors */
function buildFocusedData(data, focusTable) {
  const focus = focusTable.toLowerCase();

  // Collect FK columns used in relationships (to treat as key columns)
  const fkCols = new Set();
  const focusedRels = [];
  (data.relationships || []).forEach((rel) => {
    const from = (extractTable(rel.from || rel.from_table || rel.left_table || rel.source) || "").toLowerCase();
    const to   = (extractTable(rel.to   || rel.to_table   || rel.right_table || rel.target) || "").toLowerCase();
    if (from === focus || to === focus) {
      focusedRels.push(rel);
      const key = rel.key || rel.join_key || rel.from_column || rel.left_column || extractCol(rel.from || "");
      if (key) fkCols.add(key.toLowerCase());
    }
  });

  // Tables in this neighbourhood
  const neighbourSet = new Set([focusTable]);
  focusedRels.forEach((rel) => {
    const from = extractTable(rel.from || rel.from_table || rel.left_table || rel.source);
    const to   = extractTable(rel.to   || rel.to_table   || rel.right_table || rel.target);
    if (from) neighbourSet.add(from);
    if (to)   neighbourSet.add(to);
  });

  return {
    ...data,
    tables: [...neighbourSet],
    relationships: focusedRels,
    _fkCols: fkCols,
  };
}

/** Pick the most important columns for an entity box.
 *  Priority: FK join cols > *_id/*_key/*_pk/*_fk patterns > others.
 *  Cap at MAX_COLS total.
 */
const MAX_COLS = 6;

function prioritizeCols(cols, fkCols) {
  const isKey = (c) => {
    const lc = c.toLowerCase();
    return (
      fkCols.has(lc) ||
      lc === "id" ||
      lc.endsWith("_id") ||
      lc.endsWith("_key") ||
      lc.endsWith("_pk") ||
      lc.endsWith("_fk")
    );
  };
  const keys  = cols.filter((c) => isKey(c));
  const rest  = cols.filter((c) => !isKey(c));
  return [...keys, ...rest].slice(0, MAX_COLS);
}

function buildMermaidSyntax(data) {
  const lines = ["erDiagram"];
  const fkCols = data._fkCols || new Set();

  // Build case-insensitive column lookup
  const columnsByTable = data.columns_by_table || {};
  const colMap = new Map();
  Object.entries(columnsByTable).forEach(([tbl, cols]) => {
    colMap.set(sanitize(tbl).toLowerCase(), cols);
  });

  // Collect tables
  const allTables = new Set();
  (data.tables || []).forEach((t) => allTables.add(t));
  (data.relationships || []).forEach((rel) => {
    const rawFrom = rel.from || rel.from_table || rel.left_table || rel.source;
    const rawTo   = rel.to   || rel.to_table   || rel.right_table || rel.target;
    [rawFrom, rawTo].forEach((raw) => {
      if (!raw) return;
      allTables.add(raw.includes(".") ? raw.split(".")[0] : raw);
    });
  });

  // Emit entity blocks with smart column selection
  const emitted = new Set();
  allTables.forEach((table) => {
    const key = sanitize(table).toLowerCase();
    if (emitted.has(key)) return;
    emitted.add(key);
    const allCols = colMap.get(key) || [];
    const cols = prioritizeCols(allCols, fkCols);
    if (cols.length > 0) {
      lines.push(`  ${sanitize(table)} {`);
      cols.forEach((col) => {
        lines.push(`    string ${sanitize(col)}`);
      });
      lines.push(`  }`);
    }
  });

  // Emit relationships
  if (data.relationships && data.relationships.length > 0) {
    const seen = new Set();
    for (const rel of data.relationships) {
      const rawFrom = rel.from || rel.from_table || rel.left_table || rel.source;
      const rawTo   = rel.to   || rel.to_table   || rel.right_table || rel.target;
      const fromTable = extractTable(rawFrom);
      const toTable   = extractTable(rawTo);
      const key = rel.key || rel.join_key || rel.from_column || rel.left_column
                  || extractCol(rawFrom) || "FK";

      if (!fromTable || !toTable) continue;
      const edge = `${sanitize(fromTable)}__${sanitize(toTable)}`;
      if (seen.has(edge)) continue;
      seen.add(edge);
      lines.push(`    ${sanitize(fromTable)} ||--o{ ${sanitize(toTable)} : "${key}"`);
    }
  } else {
    (data.tables || []).forEach((table) => {
      const key = sanitize(table).toLowerCase();
      if (!colMap.has(key)) {
        lines.push(`    ${sanitize(table)} { string id }`);
      }
    });
  }

  return lines.join("\n");
}

function sanitize(name) {
  // Mermaid identifiers can't have spaces or special chars
  return String(name).replace(/[^a-zA-Z0-9_]/g, "_");
}

let diagramCounter = 0;

export default function DiagramView({ data, onTableClick, highlightTable }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // When a table is selected, show only it and its direct neighbours
    const renderData = highlightTable ? buildFocusedData(data, highlightTable) : data;
    const definition = buildMermaidSyntax(renderData);

    async function render() {
      try {
        containerRef.current.innerHTML = "";
        // Use a fresh ID every render to prevent Mermaid's internal ID cache
        // from returning a stale or duplicate SVG
        const id = `mermaid-${++diagramCounter}`;
        const { svg } = await mermaid.render(id, definition);
        containerRef.current.innerHTML = svg;

        // Attach click handlers to entity nodes
        const svgEl = containerRef.current.querySelector("svg");
        if (!svgEl) return;

        // Build a case-insensitive lookup from the rendered data (focused subset)
        const tableMap = new Map();
        (renderData.tables || []).forEach((t) => {
          tableMap.set(sanitize(t).toLowerCase(), t);
        });
        (renderData.relationships || []).forEach((rel) => {
          const rawFrom = rel.from || rel.from_table || rel.left_table || rel.source;
          const rawTo   = rel.to   || rel.to_table   || rel.right_table || rel.target;
          [rawFrom, rawTo].forEach((raw) => {
            if (!raw) return;
            const name = raw.includes(".") ? raw.split(".")[0] : raw;
            const key = sanitize(name).toLowerCase();
            if (!tableMap.has(key)) tableMap.set(key, name);
          });
        });

        const allTexts = svgEl.querySelectorAll("text, tspan");
        const hitTargets = new Set();

        allTexts.forEach((textEl) => {
          const label = textEl.textContent?.trim();
          if (!label) return;
          const canonical = tableMap.get(sanitize(label).toLowerCase());
          if (!canonical) return;

          // Walk up to find the nearest <g> container to attach click to
          let target = textEl.closest("g[id], g.node, g.er, g") || textEl;
          const key = target.id || label;
          if (hitTargets.has(key)) return;
          hitTargets.add(key);

          target.style.cursor = "pointer";
          target.addEventListener("click", () => {
            onTableClick(canonical);
          });
        });
      } catch (err) {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<p class="diagram-error">Could not render diagram: ${err.message}</p>`;
        }
      }
    }

    render();
  }, [data, onTableClick, highlightTable]);

  return (
    <div className="diagram-wrapper">
      <h2 className="section-title">Entity Relationship Diagram</h2>
      {highlightTable && (
        <p className="diagram-hint">Showing: <strong>{highlightTable}</strong> — click another node or clear selection to reset</p>
      )}
      <div className="diagram-container" ref={containerRef} />
    </div>
  );
}
