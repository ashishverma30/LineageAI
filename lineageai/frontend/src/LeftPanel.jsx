import React, { useState } from "react";
import JsonInspector, { buildTableJson } from "./JsonInspector";

export default function LeftPanel({
  data,
  selectedTable,
  onTableSelect,
  selectedColumn,
  onColumnSelect,
  selectedSorTable,
  onSorTableSelect,
  selectedSorColumn,
  onSorColumnSelect,
}) {
  const [tableSearch, setTableSearch] = useState("");
  const [jsonOpen, setJsonOpen] = useState(false);

  const tables = data.tables || [];
  const columnsByTable = data.columns_by_table || {};
  const sorTables = data.sor_tables || [];

  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const columnsForTable = selectedTable
    ? columnsByTable[selectedTable.toLowerCase()] || []
    : [];

  const columnsForSor = selectedSorTable
    ? columnsByTable[selectedSorTable.toLowerCase()] || []
    : [];

  return (
    <aside className="left-panel">

      {/* ── L1: Table ER Diagram ── */}
      <section className="lp-section">
        <div className="lp-section-header">
          <span className="lp-section-number">1</span>
          <span className="lp-section-title">Table ER Diagram</span>
        </div>
        <input
          className="lp-search"
          type="text"
          placeholder="Search tables…"
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
        />
        <select
          className="lp-select"
          value={selectedTable || ""}
          onChange={(e) => onTableSelect(e.target.value || null)}
        >
          <option value="">— Select a table —</option>
          {filteredTables.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {selectedTable && (
          <div className="lp-table-actions">
            <button className="lp-clear-btn" onClick={() => onTableSelect(null)}>
              Clear
            </button>
            <button className="lp-json-btn" onClick={() => setJsonOpen(true)}>
              {"{ }"} View JSON
            </button>
          </div>
        )}
      </section>

      {jsonOpen && selectedTable && (
        <JsonInspector
          tableName={selectedTable}
          json={buildTableJson(data, selectedTable)}
          onClose={() => setJsonOpen(false)}
        />
      )}

      {/* ── L2: Column Lineage ── */}
      <section className="lp-section">
        <div className="lp-section-header">
          <span className="lp-section-number">2</span>
          <span className="lp-section-title">Column Lineage</span>
        </div>
        {!selectedTable ? (
          <p className="lp-hint">Select a table in section 1 first</p>
        ) : columnsForTable.length === 0 ? (
          <p className="lp-hint">No columns found for <strong>{selectedTable}</strong></p>
        ) : (
          <>
            <select
              className="lp-select"
              value={selectedColumn || ""}
              onChange={(e) => onColumnSelect(e.target.value || null)}
            >
              <option value="">— Select a column —</option>
              {columnsForTable.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {selectedColumn && (
              <button className="lp-clear-btn" onClick={() => onColumnSelect(null)}>
                Clear selection
              </button>
            )}
          </>
        )}
      </section>

      {/* ── L3: SOR Column Explorer ── */}
      <section className="lp-section">
        <div className="lp-section-header">
          <span className="lp-section-number">3</span>
          <span className="lp-section-title">SOR Column Explorer</span>
        </div>
        <p className="lp-hint" style={{ marginBottom: 8 }}>
          Trace how a raw source column flows to the final layer
        </p>
        <select
          className="lp-select"
          value={selectedSorTable || ""}
          onChange={(e) => onSorTableSelect(e.target.value || null)}
        >
          <option value="">— Select a source table —</option>
          {sorTables.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {selectedSorTable && (
          <>
            <select
              className="lp-select"
              value={selectedSorColumn || ""}
              onChange={(e) => onSorColumnSelect(e.target.value || null)}
            >
              <option value="">— Select a column —</option>
              {columnsForSor.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              className="lp-clear-btn"
              onClick={() => { onSorTableSelect(null); onSorColumnSelect(null); }}
            >
              Clear selection
            </button>
          </>
        )}
      </section>

    </aside>
  );
}
