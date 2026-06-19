import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  er: { diagramPadding: 20, layoutDirection: "TB" },
});

function buildMermaidSyntax(data) {
  const lines = ["erDiagram"];

  // Build case-insensitive column lookup: sanitized-lowercase table → [col, ...]
  const columnsByTable = data.columns_by_table || {};
  const colMap = new Map();
  Object.entries(columnsByTable).forEach(([tbl, cols]) => {
    colMap.set(sanitize(tbl).toLowerCase(), cols);
  });

  // Collect every table that will appear (from relationships + data.tables)
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

  // Emit entity blocks with columns (cap at 12 to keep diagram readable)
  const emitted = new Set();
  allTables.forEach((table) => {
    const key = sanitize(table).toLowerCase();
    if (emitted.has(key)) return;
    emitted.add(key);
    const cols = colMap.get(key) || [];
    if (cols.length > 0) {
      lines.push(`  ${sanitize(table)} {`);
      cols.slice(0, 12).forEach((col) => {
        lines.push(`    string ${sanitize(col)}`);
      });
      lines.push(`  }`);
    }
  });

  // Emit relationships
  if (data.relationships && data.relationships.length > 0) {
    const seen = new Set();
    for (const rel of data.relationships) {
      const extractTable = (val) => val && val.includes(".") ? val.split(".")[0] : val;
      const extractCol   = (val) => val && val.includes(".") ? val.split(".")[1] : null;

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
    // No relationships — emit placeholder column block so Mermaid renders something
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

    const definition = buildMermaidSyntax(data);

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

        // Build a case-insensitive lookup: sanitized-lowercase → canonical name.
        // Include tables from data.tables AND from relationship from/to fields so
        // the SVG nodes (derived from relationships) always get matched.
        const tableMap = new Map();
        (data.tables || []).forEach((t) => {
          tableMap.set(sanitize(t).toLowerCase(), t);
        });
        (data.relationships || []).forEach((rel) => {
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
  }, [data, onTableClick]);

  // Dim all entity nodes except the highlighted table when one is selected in L1
  useEffect(() => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;
    const entities = svgEl.querySelectorAll('g[id^="entity-"]');
    entities.forEach((g) => {
      if (!highlightTable) {
        g.style.opacity = "1";
        return;
      }
      const label = g.querySelector("text")?.textContent?.trim() || "";
      g.style.opacity = label.toLowerCase() === highlightTable.toLowerCase() ? "1" : "0.2";
    });
  }, [highlightTable]);

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
