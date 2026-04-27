"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { TableConfig, FieldConfig } from "@/components/setup/types";
import { ODataFieldModal } from "@/components/setup/ODataFieldModal";

interface LayoutEntry {
  name: string;
  table: string;
}

interface ODataTableEntry {
  table: string;
  fields: { name: string; type: string }[];
}

interface AddDatabaseSectionProps {
  host: string;
  protocol: "data-api" | "o-data-api";
  tableCount: number;
  existingTableNames: string[];
  onTableAdded: (tableName: string, tableConfig: TableConfig) => void;
  onClose: () => void;
}

type FetchStatus = { type: "success" | "error"; message: string } | null;

export function AddDatabaseSection({
  host,
  protocol,
  tableCount,
  existingTableNames,
  onTableAdded,
  onClose,
}: AddDatabaseSectionProps) {
  // Credential fields
  const [file, setFile] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Fetch state
  const [fetchingTables, setFetchingTables] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Data-api flow
  const [layouts, setLayouts] = useState<LayoutEntry[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [selectedLayout, setSelectedLayout] = useState("");

  // OData flow
  const [odataTables, setOdataTables] = useState<ODataTableEntry[]>([]);
  const [odataModalTable, setOdataModalTable] = useState<ODataTableEntry | null>(null);

  // Add state
  const [addingTable, setAddingTable] = useState(false);

  const showStatus = (type: "success" | "error", message: string) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setFetchStatus({ type, message });
    statusTimer.current = setTimeout(() => setFetchStatus(null), 5000);
  };
  const basicToken = () => btoa(`${username}:${password}`);

  // Credentials modal state
  const [showCredsModal, setShowCredsModal] = useState(false);

  // Prefill on first render if no credentials
  useEffect(() => {
    if (!file && !username && !password) {
      setShowCredsModal(true);
    }
  }, []);

  // ── Fetch tables (layouts or OData entities) ──────────────────────────────
  const handleFetchTables = async () => {
    if (!host) return showStatus("error", "Enter a Host in the Host Configuration section first.");
    if (!file && protocol === "data-api") return showStatus("error", "Configure Database File name.");
    if (!username || !password) return showStatus("error", "Configure Username and Password.");

    setFetchingTables(true);
    setLayouts([]);
    setOdataTables([]);
    setSelectedTable("");
    setSelectedLayout("");

    try {
      const res = await fetch("/api/filemaker/setup/layouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicToken()}`,
        },
        body: JSON.stringify({ host, database: file, protocol }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error(`Unexpected response (status ${res.status})`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch tables.");

      if (protocol === "data-api") {
        setLayouts(data.layouts || []);
        showStatus("success", `Fetched ${data.layouts?.length || 0} layouts successfully!`);
      } else {
        setOdataTables(data.tables || []);
        showStatus("success", `Fetched ${data.tables?.length || 0} OData entities successfully!`);
      }
    } catch (err: any) {
      showStatus("error", err.message || "Error fetching tables.");
    } finally {
      setFetchingTables(false);
    }
  };

  // ── Add Table (data-api) ──────────────────────────────────────────────────
  const handleAddTableDataApi = async () => {
    if (!selectedTable) return showStatus("error", "Select a table.");
    if (!selectedLayout) return showStatus("error", "Select a layout.");
    if (existingTableNames.includes(selectedTable)) {
      return showStatus("error", `Table '${selectedTable}' already exists.`);
    }
    if (tableCount >= 5) return showStatus("error", "Maximum 5 databases reached.");

    setAddingTable(true);
    try {
      const res = await fetch("/api/filemaker/setup/fields", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicToken()}`,
        },
        body: JSON.stringify({ host, database: file, layout: selectedLayout }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error(`Unexpected response (status ${res.status})`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch fields.");

      const fields: Record<string, FieldConfig> = {};
      (data.fields as { name: string; type: string }[]).forEach((f) => {
        fields[f.name] = { type: f.type as FieldConfig["type"], label: f.name };
      });

      onTableAdded(selectedTable, {
        file,
        username,
        password,
        layout: selectedLayout,
        fields,
      });

      showStatus(
        "success",
        `Table '${selectedTable}' added with ${Object.keys(fields).length} fields!`
      );
      setSelectedTable("");
      setSelectedLayout("");
      onClose(); // Automatically close after adding table
    } catch (err: any) {
      showStatus("error", err.message || "Error fetching field metadata.");
    } finally {
      setAddingTable(false);
    }
  };

  // ── OData: open field selection modal ────────────────────────────────────
  const handleOdataTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    const meta = odataTables.find((t) => t.table === tableName);
    if (meta) setOdataModalTable(meta);
  };

  // ── OData: confirmed fields from modal ───────────────────────────────────
  const handleOdataFieldsConfirmed = (
    tableMeta: ODataTableEntry,
    selectedFields: string[]
  ) => {
    if (existingTableNames.includes(tableMeta.table)) {
      showStatus("error", `Table '${tableMeta.table}' already exists.`);
      return;
    }
    const fields: Record<string, FieldConfig> = {};
    tableMeta.fields
      .filter((f) => selectedFields.includes(f.name))
      .forEach((f) => {
        fields[f.name] = { type: f.type as FieldConfig["type"], label: f.name };
      });

    onTableAdded(tableMeta.table, {
      file,
      username,
      password,
      layout: null,
      fields,
    });

    showStatus(
      "success",
      `Table '${tableMeta.table}' added with ${Object.keys(fields).length} fields!`
    );
    setOdataModalTable(null);
    setSelectedTable("");
    onClose(); // Automatically close after adding table
  };

  // Unique tables for data-api select
  const uniqueTables = [...new Set(layouts.map((l) => l.table))];
  const tableLayouts = layouts.filter((l) => l.table === selectedTable);

  return (
    <div className="ads-overlay">
      <div className="ads-container">
        <div className="ads-header-compact">
          <h3 className="ads-title">Add New Database</h3>
          <div className="ads-header-actions">
            <div className="ads-note">Max 5 databases</div>
            <button className="ads-btn-close" onClick={onClose}>×</button>
          </div>
        </div>
      
      <div className="ads-body">
        {/* Credentials summary */}
        <div className="ads-creds-summary">
          <div className="ads-creds-info">
            <span className="ads-creds-label">Database:</span>
            <span className="ads-creds-value">{file || "Not set"}</span>
            <span className="ads-creds-label" style={{ marginLeft: 16 }}>Username:</span>
            <span className="ads-creds-value">{username || "Not set"}</span>
          </div>
          <button 
            className="ads-btn-outline" 
            onClick={() => setShowCredsModal(true)}
          >
            Configure Credentials
          </button>
        </div>

        {/* Table select + Fetch Tables */}
        <div className="ads-row-flex">
          <div className="ads-field" style={{ flex: 1 }}>
            <div className="ads-field-label-row">
              <label htmlFor="ads-table-select" className="ads-label">
                {protocol === "data-api" ? "Select Table" : "Select Entity"}
              </label>
              <button
                id="fetch-tables-btn"
                className="ads-btn-fetch"
                onClick={handleFetchTables}
                disabled={fetchingTables}
              >
                {fetchingTables ? (
                  <>
                    <Loader2 size={13} className="ads-spin" /> Fetching…
                  </>
                ) : (
                  <>
                    <Search size={13} /> Fetch Tables
                  </>
                )}
              </button>
            </div>

            {protocol === "data-api" ? (
              <select
                id="ads-table-select"
                className="ads-select"
                value={selectedTable}
                disabled={uniqueTables.length === 0}
                onChange={(e) => {
                  setSelectedTable(e.target.value);
                  setSelectedLayout("");
                }}
              >
                <option value="">
                  {uniqueTables.length === 0
                    ? "First enter credentials and fetch tables"
                    : "Select a table"}
                </option>
                {uniqueTables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <select
                id="ads-odata-table-select"
                className="ads-select"
                value={selectedTable}
                disabled={odataTables.length === 0}
                onChange={(e) => handleOdataTableSelect(e.target.value)}
              >
                <option value="">
                  {odataTables.length === 0
                    ? "First enter credentials and fetch tables"
                    : "Select an entity"}
                </option>
                {odataTables.map((t) => (
                  <option key={t.table} value={t.table}>
                    {t.table}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Layout select (data-api only) */}
        {protocol === "data-api" && selectedTable && (
          <div className="ads-row-flex">
            <div className="ads-field" style={{ flex: 1 }}>
              <label htmlFor="ads-layout-select" className="ads-label">
                Select Layout
              </label>
              <select
                id="ads-layout-select"
                className="ads-select"
                value={selectedLayout}
                disabled={tableLayouts.length === 0}
                onChange={(e) => setSelectedLayout(e.target.value)}
              >
                <option value="">Select a layout</option>
                {tableLayouts.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Add Table button (data-api only) */}
        {protocol === "data-api" && (
          <div className="ads-add-row">
            <button
              id="add-table-btn"
              className="ads-btn-add"
              onClick={handleAddTableDataApi}
              disabled={addingTable || !selectedLayout}
            >
              {addingTable ? (
                <>
                  <Loader2 size={13} className="ads-spin" /> Adding Table…
                </>
              ) : (
                <>
                  <Plus size={13} /> Add Table
                </>
              )}
            </button>
          </div>
        )}

        {/* Status message */}
        {fetchStatus && (
          <div className={`ads-status ads-status-${fetchStatus.type}`}>
            {fetchStatus.message}
          </div>
        )}
      </div>

      {/* OData Field Modal */}
      {odataModalTable && (
        <ODataFieldModal
          tableMeta={odataModalTable}
          onConfirm={(selectedFields) =>
            handleOdataFieldsConfirmed(odataModalTable, selectedFields)
          }
          onCancel={() => {
            setOdataModalTable(null);
            setSelectedTable("");
          }}
        />
      )}

      {/* Credentials Modal */}
      {showCredsModal && (
        <div className="ads-modal-overlay">
          <div className="ads-modal">
            <div className="ads-modal-header">
              <h4>Database Credentials</h4>
            </div>
            <div className="ads-modal-body">
              <div className="ads-field">
                <label htmlFor="ads-file" className="ads-label">
                  {protocol === "data-api" ? "Database File" : "Database Name"}
                </label>
                <input
                  id="ads-file"
                  type="text"
                  className="ads-input"
                  placeholder="e.g. KiBiAIDemo"
                  value={file}
                  onChange={(e) => setFile(e.target.value)}
                />
              </div>
              <div className="ads-field">
                <label htmlFor="ads-username" className="ads-label">Username</label>
                <input
                  id="ads-username"
                  type="text"
                  className="ads-input"
                  placeholder="Database username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="ads-field">
                <label htmlFor="ads-password" className="ads-label">Password</label>
                <input
                  id="ads-password"
                  type="password"
                  className="ads-input"
                  placeholder="Database password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="ads-modal-footer">
              <button 
                className="ads-btn-outline" 
                onClick={() => setShowCredsModal(false)}
              >
                Close
              </button>
              <button 
                className="ads-btn-add" 
                onClick={() => setShowCredsModal(false)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ads-container {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 24px;
        }

        .ads-header-compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 16px;
        }

        .ads-title {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin: 0;
        }

        .ads-note {
          background: #f1f5f9;
          color: #475569;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .ads-body {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ads-creds-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
        }

        .ads-creds-info {
          font-size: 13px;
        }

        .ads-creds-label {
          color: #64748b;
          font-weight: 500;
          margin-right: 6px;
        }

        .ads-creds-value {
          color: #0f172a;
          font-weight: 600;
        }

        .ads-row-flex {
          display: flex;
          gap: 16px;
        }

        .ads-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ads-field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ads-label {
          font-size: 13px;
          font-weight: 500;
          color: #475569;
        }

        .ads-input,
        .ads-select {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          color: #0f172a;
          background: #fff;
          outline: none;
          transition: all 0.2s ease;
        }

        .ads-input:focus,
        .ads-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .ads-select:disabled {
          background: #f8fafc;
          color: #94a3b8;
        }

        .ads-btn-fetch {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          color: #475569;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .ads-btn-fetch:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .ads-btn-fetch:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ads-btn-outline {
          padding: 6px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          color: #475569;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ads-btn-outline:hover {
          background: #f1f5f9;
        }

        .ads-add-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }

        .ads-btn-add {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          background: #2563eb;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ads-btn-add:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .ads-btn-add:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .ads-status {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
        }

        .ads-status-success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .ads-status-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .ads-spin {
          animation: ads-spin 0.8s linear infinite;
        }

        @keyframes ads-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Modal Styles */
        .ads-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }

        .ads-modal {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        }

        .ads-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
        }

        .ads-modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ads-modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: #f8fafc;
          border-radius: 0 0 12px 12px;
        }

        .ads-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 900;
          padding: 24px;
        }

        .ads-container {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 24px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        }

        .ads-header-compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 16px;
        }

        .ads-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ads-btn-close {
          background: none;
          border: none;
          font-size: 24px;
          line-height: 1;
          color: #64748b;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          transition: color 0.2s;
        }

        .ads-btn-close:hover {
          color: #0f172a;
        }

        @media (max-width: 640px) {
          .ads-creds-summary {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }
        }
      `}</style>
      </div>
    </div>
  );
}
