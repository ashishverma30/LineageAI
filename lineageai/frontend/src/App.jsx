import React, { useState, useCallback } from "react";
import axios from "axios";
import ScanForm from "./ScanForm";
import DiagramView from "./DiagramView";
import LeftPanel from "./LeftPanel";
import ColumnFlow from "./ColumnFlow";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [diagramData, setDiagramData] = useState(null);

  // L1 — selected table (highlights it in the ER diagram)
  const [selectedTable, setSelectedTable] = useState(null);
  // L2 — selected column within selected table (shows column lineage flow)
  const [selectedColumn, setSelectedColumn] = useState(null);
  // L3 — SOR table + column (shows downstream SOR flow)
  const [selectedSorTable, setSelectedSorTable] = useState(null);
  const [selectedSorColumn, setSelectedSorColumn] = useState(null);

  async function handleScan(repoUrl, token) {
    setLoading(true);
    setError(null);
    setDiagramData(null);
    setSelectedTable(null);
    setSelectedColumn(null);
    setSelectedSorTable(null);
    setSelectedSorColumn(null);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/scan`, { repo_url: repoUrl, token });
      setDiagramData(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }

  const handleTableSelect = useCallback((table) => {
    setSelectedTable(table);
    setSelectedColumn(null); // reset column when table changes
  }, []);

  const handleColumnSelect = useCallback((col) => {
    setSelectedColumn(col);
  }, []);

  const handleSorTableSelect = useCallback((tbl) => {
    setSelectedSorTable(tbl);
    setSelectedSorColumn(null);
  }, []);

  const handleSorColumnSelect = useCallback((col) => {
    setSelectedSorColumn(col);
  }, []);

  // Derive right-panel mode from what the user has selected
  // SOR flow takes priority, then column lineage, then ER diagram
  const rightMode = selectedSorColumn ? "sor" : selectedColumn ? "column" : "diagram";

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">LineageAI</h1>
        <p className="app-subtitle">Data Lineage for American Express Marketing Technology</p>
      </header>

      <div className="app-top">
        <ScanForm onScan={handleScan} loading={loading} />
        {error && <div className="error-banner" role="alert">{error}</div>}
        {diagramData && (
          <div className="scan-summary">
            <span>Repo: <strong>{diagramData.repo}</strong></span>
            <span>Files scanned: <strong>{diagramData.scanned_files}</strong></span>
            <span>Tables found: <strong>{diagramData.tables.length}</strong></span>
          </div>
        )}
      </div>

      {diagramData && (
        <div className="two-panel-layout">
          <LeftPanel
            data={diagramData}
            selectedTable={selectedTable}
            onTableSelect={handleTableSelect}
            selectedColumn={selectedColumn}
            onColumnSelect={handleColumnSelect}
            selectedSorTable={selectedSorTable}
            onSorTableSelect={handleSorTableSelect}
            selectedSorColumn={selectedSorColumn}
            onSorColumnSelect={handleSorColumnSelect}
          />

          <div className="right-panel">
            {rightMode === "diagram" && (
              <DiagramView
                data={diagramData}
                onTableClick={handleTableSelect}
                highlightTable={selectedTable}
              />
            )}
            {rightMode === "column" && (
              <ColumnFlow
                mode="column"
                tableName={selectedTable}
                columnName={selectedColumn}
                columnLineage={diagramData.column_lineage || []}
              />
            )}
            {rightMode === "sor" && (
              <ColumnFlow
                mode="sor"
                sorTable={selectedSorTable}
                sorColumn={selectedSorColumn}
                columnLineage={diagramData.column_lineage || []}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
