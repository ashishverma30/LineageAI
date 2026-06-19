import React, { useCallback } from "react";

/** Build a JSON slice for the selected table from the full scan data */
export function buildTableJson(data, tableName) {
  const tbl = tableName.toLowerCase();
  const columns = (data.columns_by_table || {})[tbl] || [];

  const relationships = (data.relationships || []).filter((rel) => {
    const extract = (v) => {
      const s = (v || "").toLowerCase();
      return s.includes(".") ? s.split(".")[0] : s;
    };
    const from = extract(rel.from || rel.from_table || rel.left_table || rel.source);
    const to   = extract(rel.to   || rel.to_table   || rel.right_table || rel.target);
    return from === tbl || to === tbl;
  });

  const column_lineage = (data.column_lineage || []).filter(
    (cl) =>
      (cl.target_table || "").toLowerCase() === tbl ||
      (cl.source_table || "").toLowerCase() === tbl
  );

  return { table: tableName, columns, relationships, column_lineage };
}

/** Minimal JSON syntax highlighter — returns HTML string */
function highlight(json) {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-string";
        } else if (/true|false/.test(match)) {
          cls = "json-bool";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

export default function JsonInspector({ tableName, json, onClose }) {
  const pretty = JSON.stringify(json, null, 2);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(pretty).catch(() => {});
  }, [pretty]);

  // Close on backdrop click
  const handleBackdrop = useCallback(
    (e) => { if (e.target === e.currentTarget) onClose(); },
    [onClose]
  );

  return (
    <div className="json-modal-backdrop" onClick={handleBackdrop}>
      <div className="json-modal" role="dialog" aria-label="JSON Inspector">
        <div className="json-modal-header">
          <div>
            <span className="json-modal-title">JSON Inspector</span>
            <span className="json-modal-table">{tableName}</span>
          </div>
          <div className="json-modal-actions">
            <button className="json-copy-btn" onClick={handleCopy}>Copy</button>
            <button className="json-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <pre
          className="json-body"
          dangerouslySetInnerHTML={{ __html: highlight(pretty) }}
        />
      </div>
    </div>
  );
}
