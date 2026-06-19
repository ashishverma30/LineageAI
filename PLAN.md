# LineageAI — Feature Roadmap

Work through these one at a time. Mark `[x]` when done.

---

## [x] Task 1 — Show Column Names in ER Diagram

In the Mermaid ER diagram, each entity box should list its columns (not just the table name).
Claude already returns `column_lineage` with `target_column` and `source_column` — use those
to populate Mermaid entity attribute blocks.

**Scope:**
- `DiagramView.jsx` — update `buildMermaidSyntax()` to emit column attributes per entity
- `main.py` — optionally surface a `columns_by_table` map in the `/scan` response
- `ai_parser.py` — ensure the prompt asks Claude to return all column names per table

**Acceptance:** Each box in the ER diagram shows its columns below the table name.

---

## [ ] Task 2 — Two-Panel UI Redesign

Replace the current single-column layout with a fixed two-panel layout.

### Left Panel (3 sections, stacked vertically)

**Section L1 — Table selector**
- Dropdown (or searchable select) listing all tables from `data.tables`
- Selecting a table updates the right panel to highlight that entity in the ER diagram

**Section L2 — Column lineage for selected table**
- Dropdown listing all columns belonging to the table selected in L1
- Selecting a column shows its full lineage (source table → transformation → target column)
  in the right panel

**Section L3 — SOR (Source of Record) explorer**
- Dropdown of all SOR/raw tables (e.g. `RAW_*` tables)
- Selecting a SOR column traces how that column flows through the codebase
  all the way to the final/output layer (end-to-end lineage path)

### Right Panel

- **Default view:** ER diagram at the table level (same as today)
- **When L2 column is selected:** Highlight or replace the diagram with a column-level
  lineage path (e.g. a flow/DAG view: source_table.col → transformation → target_table.col)
- **When L3 SOR column is selected:** Show the full traversal path of that SOR column
  across all intermediate tables until it reaches the final output table

**Scope:**
- `App.jsx` — introduce left/right panel layout state
- `DiagramView.jsx` — accept a `highlightTable` prop to dim all other nodes
- New `LeftPanel.jsx` component with the three sections
- New `ColumnLineageFlow.jsx` component for the right-panel DAG/flow view
- `App.css` — two-panel flex layout (left fixed ~320px, right fills remaining width)
- `main.py` — add `columns_by_table` and `sor_tables` fields to `/scan` response

**Acceptance:** Selecting a table, column, or SOR column in the left panel updates
the right panel without a full page reload.

---

## [ ] Task 3 — JSON Inspector per Table

Add a button/toggle in the dashboard that lets the user inspect the raw JSON
for any selected table.

**Scope:**
- A "View JSON" button in the left panel (L1 section) or near the table chips
- Clicking it opens a modal or expandable drawer showing the raw JSON slice
  for that table: its columns, relationships, and column_lineage entries
- Syntax-highlighted (e.g. using `react-json-view` or a `<pre>` block with CSS)

**Acceptance:** For any selected table, the user can see the exact JSON the
backend returned, formatted and readable.

---

## Notes

- Tasks should be done in order: Task 1 unblocks Task 2 (column data needed for L2/L3).
- Task 3 is independent and can be done after Task 1 or 2.
- Branch naming: `feature/er-diagram-columns`, `feature/ui-redesign-two-panel`, `feature/json-inspector`
