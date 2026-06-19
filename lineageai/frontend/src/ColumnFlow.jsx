import React from "react";

/**
 * Traces all downstream hops from (startTable, startCol) through column_lineage.
 * Returns an array of levels, each level being an array of {table, col, transformation}.
 */
function traceDownstream(columnLineage, startTable, startCol) {
  const visited = new Set();
  const levels = [];
  let frontier = [{ table: startTable.toLowerCase(), col: startCol.toLowerCase(), transformation: "" }];

  while (frontier.length > 0) {
    const nextFrontier = [];
    const levelItems = [];

    for (const { table, col, transformation } of frontier) {
      const key = `${table}.${col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      levelItems.push({ table, col, transformation });

      const downstream = columnLineage.filter(
        (e) =>
          e.source_table?.toLowerCase() === table &&
          e.source_column?.toLowerCase() === col &&
          e.target_table &&
          e.target_column
      );
      downstream.forEach((e) => {
        const nextKey = `${e.target_table.toLowerCase()}.${e.target_column.toLowerCase()}`;
        if (!visited.has(nextKey)) {
          nextFrontier.push({
            table: e.target_table.toLowerCase(),
            col: e.target_column.toLowerCase(),
            transformation: e.transformation || "",
          });
        }
      });
    }

    if (levelItems.length > 0) levels.push(levelItems);
    frontier = nextFrontier;
  }

  return levels;
}

/* ── Column Lineage Mode (L2) ── */
function ColumnLineageView({ tableName, columnName, columnLineage }) {
  const entries = columnLineage.filter(
    (e) =>
      e.target_table?.toLowerCase() === tableName?.toLowerCase() &&
      e.target_column?.toLowerCase() === columnName?.toLowerCase()
  );

  return (
    <div className="flow-panel">
      <div className="flow-panel-header">
        <h2 className="flow-panel-title">Column Lineage</h2>
        <div className="flow-panel-subtitle">
          <span className="flow-badge target">{tableName}</span>
          <span className="flow-dot">·</span>
          <span className="flow-col-name">{columnName}</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="flow-empty">No lineage data found for <strong>{tableName}.{columnName}</strong>.</p>
      ) : (
        <div className="flow-chain">
          {entries.map((e, i) => (
            <div key={i} className="flow-hop">
              <div className="flow-node source">
                <div className="flow-node-label">Source</div>
                <div className="flow-node-table">{e.source_table}</div>
                <div className="flow-node-col">{e.source_column}</div>
              </div>
              <div className="flow-arrow-col">
                {e.transformation ? (
                  <span className="flow-transform-badge">{e.transformation}</span>
                ) : (
                  <span className="flow-arrow-label">direct</span>
                )}
                <div className="flow-arrow-line">→</div>
              </div>
              <div className="flow-node target">
                <div className="flow-node-label">Target</div>
                <div className="flow-node-table">{tableName}</div>
                <div className="flow-node-col">{columnName}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── SOR Flow Mode (L3) ── */
function SorFlowView({ sorTable, sorColumn, columnLineage }) {
  const levels = traceDownstream(columnLineage, sorTable, sorColumn);

  return (
    <div className="flow-panel">
      <div className="flow-panel-header">
        <h2 className="flow-panel-title">SOR Column Flow</h2>
        <div className="flow-panel-subtitle">
          <span className="flow-badge source">{sorTable}</span>
          <span className="flow-dot">·</span>
          <span className="flow-col-name">{sorColumn}</span>
          <span className="flow-hint"> → downstream</span>
        </div>
      </div>

      {levels.length === 0 ? (
        <p className="flow-empty">No downstream lineage found for <strong>{sorTable}.{sorColumn}</strong>.</p>
      ) : (
        <div className="sor-flow-levels">
          {levels.map((level, li) => (
            <div key={li} className="sor-level">
              <div className="sor-level-label">
                {li === 0 ? "Source (SOR)" : `Hop ${li}`}
              </div>
              <div className="sor-level-nodes">
                {level.map((item, ni) => (
                  <div key={ni} className="sor-node">
                    <div className="sor-node-table">{item.table}</div>
                    <div className="sor-node-col">{item.col}</div>
                    {item.transformation && (
                      <div className="sor-node-transform">{item.transformation}</div>
                    )}
                  </div>
                ))}
              </div>
              {li < levels.length - 1 && (
                <div className="sor-level-arrow">↓</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ColumnFlow({ mode, tableName, columnName, sorTable, sorColumn, columnLineage }) {
  if (mode === "column") {
    return <ColumnLineageView tableName={tableName} columnName={columnName} columnLineage={columnLineage} />;
  }
  if (mode === "sor") {
    return <SorFlowView sorTable={sorTable} sorColumn={sorColumn} columnLineage={columnLineage} />;
  }
  return null;
}
