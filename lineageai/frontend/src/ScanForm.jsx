import React, { useState } from "react";

export default function ScanForm({ onScan, loading }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (repoUrl.trim()) {
      onScan(repoUrl.trim(), token.trim());
    }
  }

  return (
    <form className="scan-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="repoUrl">GitHub Repository URL</label>
        <input
          id="repoUrl"
          type="text"
          placeholder="https://github.com/org/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="token">Access Token <span style={{fontWeight:"normal",opacity:0.6}}>(optional for public repos)</span></label>
        <input
          id="token"
          type="password"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        className="scan-btn"
        disabled={loading || !repoUrl.trim()}
      >
        {loading ? (
          <span className="btn-inner">
            <span className="spinner" aria-hidden="true" />
            Scanning...
          </span>
        ) : (
          "Scan Repository"
        )}
      </button>
    </form>
  );
}
