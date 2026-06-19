import React from "react";

export default function LineagePanel({ tableName, columnLineage, onClose }) {
  // columnLineage is a flat array of {source_table, source_column, target_column, transformation}
  const columns = Array.isArray(columnLineage) ? columnLineage : [];

  return (
    <aside className="lineage-panel" role="complementary" aria-label="Column Lineage">
      <div className="panel-header">
        <h2 className="panel-title">{tableName}</h2>
        <button className="panel-close" onClick={onClose} aria-label="Close panel">
          &times;
        </button>
      </div>

      <div className="panel-body">
        <h3 className="panel-subtitle">Column Lineage</h3>

        {columns.length === 0 ? (
          <p className="panel-empty">No column lineage data available for this table.</p>
        ) : (
          <table className="lineage-table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Source</th>
                <th>Transformation</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, idx) => (
                <tr key={idx}>
                  <td className="col-name">{col.target_column || col.name || "—"}</td>
                  <td className="col-source">
                    {col.source_table && col.source_column
                      ? `${col.source_table}.${col.source_column}`
                      : col.source || "—"}
                  </td>
                  <td className="col-transform">{col.transformation || "direct map"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </aside>
  );
}
