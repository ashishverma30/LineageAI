import React, { useState } from "react";
import axios from "axios";
import ScanForm from "./ScanForm";
import DiagramView from "./DiagramView";
import LineagePanel from "./LineagePanel";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [diagramData, setDiagramData] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);

  async function handleScan(repoUrl, token) {
    setLoading(true);
    setError(null);
    setDiagramData(null);
    setSelectedTable(null);

    try {
      const { data } = await axios.post(`${BACKEND_URL}/scan`, {
        repo_url: repoUrl,
        token,
      });
      setDiagramData(data);
    } catch (err) {
      const message =
        err.response?.data?.detail || err.message || "Unknown error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleTableClick(tableName) {
    setSelectedTable(tableName);
  }

  function handlePanelClose() {
    setSelectedTable(null);
  }

  // Filter column_lineage for rows that belong to the selected table (target_table)
  // or fall back to source_table for legacy entries without a target_table
  const columnLineageForTable = selectedTable
    ? (diagramData?.column_lineage || []).filter((cl) => {
        const tgt = (cl.target_table || cl.table || "").toLowerCase();
        const src = (cl.source_table || cl.source || "").toLowerCase().split(".")[0];
        return tgt === selectedTable.toLowerCase() || src === selectedTable.toLowerCase();
      })
    : [];

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">LineageAI</h1>
        <p className="app-subtitle">Data Lineage for American Express Marketing Technology</p>
      </header>

      <main className="app-main">
        <ScanForm onScan={handleScan} loading={loading} />

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {diagramData && (
          <div className="scan-summary">
            <span>Repo: <strong>{diagramData.repo}</strong></span>
            <span>Files scanned: <strong>{diagramData.scanned_files}</strong></span>
            <span>Tables found: <strong>{diagramData.tables.length}</strong></span>
          </div>
        )}

        {diagramData && (
          <DiagramView data={diagramData} onTableClick={handleTableClick} />
        )}
      </main>

      {selectedTable && (
        <LineagePanel
          tableName={selectedTable}
          columnLineage={columnLineageForTable}
          onClose={handlePanelClose}
        />
      )}
    </div>
  );
}
