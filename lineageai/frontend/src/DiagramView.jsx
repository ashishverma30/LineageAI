import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  er: { diagramPadding: 20, layoutDirection: "TB" },
});

function buildMermaidSyntax(data) {
  const lines = ["erDiagram"];

  if (data.relationships && data.relationships.length > 0) {
    const seen = new Set();
    for (const rel of data.relationships) {
      // Extract table name — handles "table", "table.column", or explicit fields
      const extractTable = (val) => val && val.includes(".") ? val.split(".")[0] : val;
      const extractCol  = (val) => val && val.includes(".") ? val.split(".")[1] : null;

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
  } else if (data.tables && data.tables.length > 0) {
    // No relationships — just list tables so something renders
    for (const table of data.tables) {
      lines.push(`    ${sanitize(table)} { string id }`);
    }
  }

  return lines.join("\n");
}

function sanitize(name) {
  // Mermaid identifiers can't have spaces or special chars
  return String(name).replace(/[^a-zA-Z0-9_]/g, "_");
}

let diagramCounter = 0;

export default function DiagramView({ data, onTableClick }) {
  const containerRef = useRef(null);
  const [search, setSearch] = useState("");

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

  // Dim/highlight SVG entity nodes based on search
  useEffect(() => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;
    const entities = svgEl.querySelectorAll('g[id^="entity-"]');
    entities.forEach((g) => {
      if (!search) {
        g.style.opacity = "1";
        return;
      }
      const label = g.querySelector("text")?.textContent?.trim() || "";
      g.style.opacity = label.toLowerCase().includes(search.toLowerCase()) ? "1" : "0.15";
    });
  }, [search]);

  const filteredTables = data.tables.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="diagram-wrapper">
      <h2 className="section-title">Entity Relationship Diagram</h2>

      <div className="diagram-search-row">
        <input
          className="diagram-search"
          type="text"
          placeholder="Search tables…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="diagram-search-clear" onClick={() => setSearch("")}>
            ✕
          </button>
        )}
      </div>

      <div className="table-chips">
        {filteredTables.map((table) => (
          <button
            key={table}
            className="table-chip"
            onClick={() => onTableClick(table)}
          >
            {table}
          </button>
        ))}
        {filteredTables.length === 0 && search && (
          <span className="no-match">No tables match "{search}"</span>
        )}
      </div>

      <div className="diagram-container" ref={containerRef} />
    </div>
  );
}
