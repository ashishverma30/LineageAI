import React, { useEffect, useRef } from "react";
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
  const idRef = useRef(`mermaid-${++diagramCounter}`);

  useEffect(() => {
    if (!containerRef.current) return;

    const definition = buildMermaidSyntax(data);
    const id = idRef.current;

    async function render() {
      try {
        containerRef.current.innerHTML = "";
        const { svg } = await mermaid.render(id, definition);
        containerRef.current.innerHTML = svg;

        // Attach click handlers to entity nodes
        const svgEl = containerRef.current.querySelector("svg");
        if (!svgEl) return;

        // Mermaid v10 ER entities: try multiple selectors
        const sanitizedTables = data.tables.map(sanitize);
        const allTexts = svgEl.querySelectorAll("text, tspan");
        const hitTargets = new Set();

        allTexts.forEach((textEl) => {
          const label = textEl.textContent?.trim();
          if (!label) return;
          const idx = sanitizedTables.indexOf(sanitize(label));
          if (idx === -1) return;

          // Walk up to find the nearest <g> container to attach click to
          let target = textEl.closest("g[id], g.node, g.er, g") || textEl;
          const key = target.id || label;
          if (hitTargets.has(key)) return;
          hitTargets.add(key);

          target.style.cursor = "pointer";
          target.addEventListener("click", () => {
            onTableClick(data.tables[idx]);
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

  return (
    <div className="diagram-wrapper">
      <h2 className="section-title">Entity Relationship Diagram</h2>

      <div className="table-chips">
        {data.tables.map((table) => (
          <button
            key={table}
            className="table-chip"
            onClick={() => onTableClick(table)}
          >
            {table}
          </button>
        ))}
      </div>

      <div className="diagram-container" ref={containerRef} />
    </div>
  );
}
