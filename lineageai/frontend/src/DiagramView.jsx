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
    for (const rel of data.relationships) {
      const from = sanitize(rel.from);
      const to = sanitize(rel.to);
      const key = rel.key || "FK";
      lines.push(`    ${from} ||--o{ ${to} : "${key}"`);
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

        // Mermaid ER entity labels are in <text> elements inside <g class="er entityLabel">
        const entityGroups = svgEl.querySelectorAll("g.er");
        entityGroups.forEach((g) => {
          const textEl = g.querySelector("text");
          if (!textEl) return;
          const label = textEl.textContent?.trim();
          if (label && data.tables.map(sanitize).includes(sanitize(label))) {
            g.style.cursor = "pointer";
            g.addEventListener("click", () => {
              // Find original unsanitized table name
              const original = data.tables.find(
                (t) => sanitize(t) === sanitize(label)
              );
              onTableClick(original || label);
            });
          }
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
      <p className="diagram-hint">Click a table to view column lineage.</p>
      <div className="diagram-container" ref={containerRef} />
    </div>
  );
}
