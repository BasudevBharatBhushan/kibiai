"use client";

import { useEffect, useReducer, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Save, Loader2, CheckCircle, AlertCircle, Database, Network, FileJson, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { HostConfigSection } from "@/components/setup/HostConfigSection";
import { AddDatabaseSection } from "@/components/setup/AddDatabaseSection";
import { TableCard } from "@/components/setup/TableCard";
import { RelationshipsPanel } from "@/components/setup/RelationshipsPanel";
import { SetupJsonPreview } from "@/components/setup/SetupJsonPreview";
import { 
  FieldConfig, 
  TableConfig, 
  Relationship, 
  SetupConfig 
} from "@/components/setup/types";

// --- Reducer ------------------------------------------------------------------

type Action =
  | { type: "SET_CONFIG"; payload: SetupConfig }
  | { type: "SET_HOST"; payload: string }
  | { type: "SET_PROTOCOL"; payload: "data-api" | "o-data-api" }
  | { type: "ADD_TABLE"; tableName: string; tableConfig: TableConfig }
  | { type: "DELETE_TABLE"; tableName: string }
  | { type: "RENAME_TABLE"; oldName: string; newName: string }
  | { type: "UPDATE_TABLE_PROPERTY"; tableName: string; property: keyof Omit<TableConfig, "fields">; value: string }
  | { type: "UPDATE_FIELD_PROPERTY"; tableName: string; fieldName: string; property: keyof FieldConfig; value: string }
  | { type: "DELETE_FIELD"; tableName: string; fieldName: string }
  | { type: "ADD_RELATIONSHIP"; rel: Relationship }
  | { type: "UPDATE_RELATIONSHIP"; index: number; property: keyof Relationship; value: string }
  | { type: "DELETE_RELATIONSHIP"; index: number };

function setupReducer(state: SetupConfig, action: Action): SetupConfig {
  switch (action.type) {
    case "SET_CONFIG":
      return action.payload;

    case "SET_HOST":
      return { ...state, host: action.payload };

    case "SET_PROTOCOL":
      return { ...state, data_fetching_protocol: action.payload };

    case "ADD_TABLE": {
      if (Object.keys(state.tables).length >= 5) return state;
      return {
        ...state,
        tables: { ...state.tables, [action.tableName]: action.tableConfig },
      };
    }

    case "DELETE_TABLE": {
      const newTables = { ...state.tables };
      delete newTables[action.tableName];
      const newRels = state.relationships.filter(
        (r) => r.primary_table !== action.tableName && r.joined_table !== action.tableName
      );
      return { ...state, tables: newTables, relationships: newRels };
    }

    case "RENAME_TABLE": {
      if (!action.newName || action.newName === action.oldName || state.tables[action.newName]) {
        return state;
      }
      const newTables = { ...state.tables };
      newTables[action.newName] = newTables[action.oldName];
      delete newTables[action.oldName];
      const newRels = state.relationships.map((r) => ({
        ...r,
        primary_table: r.primary_table === action.oldName ? action.newName : r.primary_table,
        joined_table: r.joined_table === action.oldName ? action.newName : r.joined_table,
      }));
      return { ...state, tables: newTables, relationships: newRels };
    }

    case "UPDATE_TABLE_PROPERTY": {
      return {
        ...state,
        tables: {
          ...state.tables,
          [action.tableName]: {
            ...state.tables[action.tableName],
            [action.property]: action.value,
          },
        },
      };
    }

    case "UPDATE_FIELD_PROPERTY": {
      const table = state.tables[action.tableName];
      if (!table || !table.fields[action.fieldName]) return state;

      const field = { ...table.fields[action.fieldName] };
      const prop = action.property;
      const val = action.value;

      if (val === "") {
        delete field[prop as keyof FieldConfig];
      } else {
        field[prop as keyof FieldConfig] = val as never;
      }

      return {
        ...state,
        tables: {
          ...state.tables,
          [action.tableName]: {
            ...table,
            fields: { ...table.fields, [action.fieldName]: field },
          },
        },
      };
    }

    case "DELETE_FIELD": {
      const table = state.tables[action.tableName];
      if (!table) return state;
      const newFields = { ...table.fields };
      delete newFields[action.fieldName];
      return {
        ...state,
        tables: {
          ...state.tables,
          [action.tableName]: { ...table, fields: newFields },
        },
      };
    }

    case "ADD_RELATIONSHIP": {
      if (state.relationships.length >= 10) return state;
      return { ...state, relationships: [...state.relationships, action.rel] };
    }

    case "UPDATE_RELATIONSHIP": {
      const newRels = state.relationships.map((r, i) => {
        if (i !== action.index) return r;
        const updated = { ...r, [action.property]: action.value };
        // Clear dependent fields when table changes
        if (action.property === "primary_table") updated.source = "";
        else if (action.property === "joined_table") updated.target = "";
        return updated;
      });
      return { ...state, relationships: newRels };
    }

    case "DELETE_RELATIONSHIP": {
      return {
        ...state,
        relationships: state.relationships.filter((_, i) => i !== action.index),
      };
    }

    default:
      return state;
  }
}

const EMPTY_CONFIG: SetupConfig = {
  host: "",
  data_fetching_protocol: "data-api",
  tables: {},
  relationships: [],
};

// --- Component ----------------------------------------------------------------

interface SetupWizardProps {
  templateId: string;
  companySlug?: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SetupWizard({ templateId, companySlug }: SetupWizardProps) {
  const [config, dispatch] = useReducer(setupReducer, EMPTY_CONFIG);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string>("");
  const [showAddDatabaseModal, setShowAddDatabaseModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Default to showing add database modal if no tables exist initially
  useEffect(() => {
    if (mounted && Object.keys(config.tables).length === 0) {
      setShowAddDatabaseModal(true);
    }
  }, [mounted, config.tables]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load existing setup JSON on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/company/templates/${templateId}/setup`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.template?.report_template_setup_json) {
          const existing = data.template.report_template_setup_json;
          if (existing?.host !== undefined || Object.keys(existing?.tables || {}).length > 0) {
            dispatch({ type: "SET_CONFIG", payload: existing });
            
            // Auto-select the first table if exists, else relationships if exists, else add_database
            const tableKeys = Object.keys(existing.tables || {});
            if (tableKeys.length > 0) {
              setSelectedView(`table:${tableKeys[0]}`);
            } else if (existing.relationships?.length > 0) {
              setSelectedView("relationships");
            }
          }
        }
      } catch {
        // Non-fatal — start with empty config
      }
    };
    load();
  }, [templateId]);

  // Clean empty optional fields before saving
  const cleanConfig = useCallback((cfg: SetupConfig): SetupConfig => {
    const cleaned = JSON.parse(JSON.stringify(cfg)) as SetupConfig;
    for (const tableName of Object.keys(cleaned.tables)) {
      for (const fieldName of Object.keys(cleaned.tables[tableName].fields)) {
        const field = cleaned.tables[tableName].fields[fieldName];
        if (field.prefix === "") delete field.prefix;
        if (field.suffix === "") delete field.suffix;
        if (field.valuelist === "") delete field.valuelist;
      }
    }
    return cleaned;
  }, []);

  const handleSave = async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const payload = cleanConfig(config);
      const res = await fetch(`/api/company/templates/${templateId}/setup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup_json: payload }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Error ${res.status}`;
        try { msg = JSON.parse(text).error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save setup.";
      setSaveError(message);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 5000);
    }
  };

  const tableNames = Object.keys(config.tables);

  // Show a "Continue to Configure" CTA after a successful save
  const showContinueCTA = saveStatus === "saved" && companySlug && tableNames.length > 0;

  return (
    <div className="setup-wizard">
      <div className="sw-layout">
        
        {/* LEFT SIDEBAR */}
        <div className="sw-sidebar">
          <div className="sw-sidebar-group">
            <div className="sw-sidebar-header">
              <div className="sw-sidebar-title">
                <Database size={14} className="sw-icon" />
                Databases
              </div>
              <button 
                className="sw-add-btn" 
                onClick={() => setShowAddDatabaseModal(true)}
                title="Add new database"
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="sw-nav-list">
              {tableNames.length === 0 && (
                <div className="sw-nav-empty">No databases added yet</div>
              )}
              {tableNames.map((tableName) => (
                <button
                  key={tableName}
                  className={`sw-nav-item ${selectedView === `table:${tableName}` ? 'active' : ''}`}
                  onClick={() => setSelectedView(`table:${tableName}`)}
                >
                  <div className="sw-nav-label">{tableName}</div>
                  <div className="sw-nav-count">{Object.keys(config.tables[tableName].fields).length}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="sw-sidebar-group">
            <div className="sw-sidebar-header">
              <div className="sw-sidebar-title">
                <Network size={14} className="sw-icon" />
                Relationships
              </div>
            </div>
            
            <div className="sw-nav-list">
              <button
                className={`sw-nav-item ${selectedView === 'relationships' ? 'active' : ''}`}
                onClick={() => setSelectedView("relationships")}
              >
                <div className="sw-nav-label">Configure Relationships</div>
                <div className="sw-nav-count">{config.relationships.length}</div>
              </button>
            </div>
          </div>

          <div className="sw-sidebar-group mt-auto pt-6">
            <button
              className="sw-json-btn"
              onClick={() => setShowJsonPreview(true)}
            >
              <FileJson size={14} />
              Preview Config JSON
            </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="sw-main">
          {/* Always visible host config */}
          <HostConfigSection
            host={config.host}
            protocol={config.data_fetching_protocol}
            onHostChange={(val) => dispatch({ type: "SET_HOST", payload: val })}
            onProtocolChange={(val) => dispatch({ type: "SET_PROTOCOL", payload: val })}
          />

          {/* Dynamic detail view */}
          <div className="sw-detail-view">
            {!selectedView && tableNames.length > 0 && (
              <div className="sw-empty-state">
                <div className="sw-empty-icon">
                  <Database size={48} />
                </div>
                <h3>Select a database to view details</h3>
                <p>Or click + in the sidebar to add a new database configuration.</p>
              </div>
            )}

            {!selectedView && tableNames.length === 0 && (
              <div className="sw-empty-state">
                <div className="sw-empty-icon">
                  <Database size={48} />
                </div>
                <h3>No Databases Configured</h3>
                <p>Click + in the sidebar to add your first database configuration.</p>
                <button 
                  className="sw-btn-primary mt-4" 
                  onClick={() => setShowAddDatabaseModal(true)}
                >
                  <Plus size={16} style={{marginRight: '6px'}}/> Add Database
                </button>
              </div>
            )}

            {selectedView.startsWith("table:") && config.tables[selectedView.replace("table:", "")] && (
              <TableCard
                tableName={selectedView.replace("table:", "")}
                tableConfig={config.tables[selectedView.replace("table:", "")]}
                onDelete={() => {
                  dispatch({ type: "DELETE_TABLE", tableName: selectedView.replace("table:", "") });
                  const remaining = tableNames.filter(t => t !== selectedView.replace("table:", ""));
                  setSelectedView(remaining.length > 0 ? `table:${remaining[0]}` : "");
                }}
                onRename={(newName) => {
                  const oldName = selectedView.replace("table:", "");
                  dispatch({ type: "RENAME_TABLE", oldName, newName });
                  setSelectedView(`table:${newName}`);
                }}
                onUpdateProperty={(property, value) =>
                  dispatch({ type: "UPDATE_TABLE_PROPERTY", tableName: selectedView.replace("table:", ""), property, value })
                }
                onUpdateField={(fieldName, property, value) =>
                  dispatch({ type: "UPDATE_FIELD_PROPERTY", tableName: selectedView.replace("table:", ""), fieldName, property, value })
                }
                onDeleteField={(fieldName) =>
                  dispatch({ type: "DELETE_FIELD", tableName: selectedView.replace("table:", ""), fieldName })
                }
              />
            )}

            {selectedView === "relationships" && (
              <RelationshipsPanel
                tables={config.tables}
                relationships={config.relationships}
                onAdd={() => {
                  if (tableNames.length >= 2) {
                    dispatch({
                      type: "ADD_RELATIONSHIP",
                      rel: { primary_table: tableNames[0], joined_table: tableNames[1], source: "", target: "" },
                    });
                  }
                }}
                onUpdate={(index, property, value) =>
                  dispatch({ type: "UPDATE_RELATIONSHIP", index, property, value })
                }
                onDelete={(index) => dispatch({ type: "DELETE_RELATIONSHIP", index })}
              />
            )}
          </div>
        </div>
      </div>

      <SetupJsonPreview
        config={cleanConfig(config)}
        show={showJsonPreview}
        onToggle={() => setShowJsonPreview((v) => !v)}
        onSave={(newConfig) => dispatch({ type: "SET_CONFIG", payload: newConfig })}
      />

      {/* ── Continue to Configure CTA ───────────────────────────────────── */}
      {showContinueCTA && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#2563eb",
          color: "#fff",
          borderRadius: "16px",
          padding: "14px 24px",
          boxShadow: "0 8px 32px rgba(37,99,235,0.35)",
          fontWeight: 700,
          fontSize: "14px",
          animation: "fadeInUp 0.3s ease",
        }}>
          <CheckCircle size={18} style={{ color: "#86efac" }} />
          <span>Setup saved! Ready to configure your report.</span>
          <Link
            href={`/${companySlug}/templates/${templateId}/configurator`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#fff",
              color: "#2563eb",
              padding: "6px 16px",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "13px",
              textDecoration: "none",
              marginLeft: "8px",
              whiteSpace: "nowrap",
            }}
          >
            Continue to Configure
            <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* --- Subheader Save Button (Portal) --- */}
      {mounted && typeof document !== "undefined" && document.getElementById("setup-wizard-save-container")
        ? createPortal(
            <button
              id="save-setup-btn"
              className={`sw-save-btn-mini ${saveStatus}`}
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              title="Save Setup Configuration"
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 size={14} className="sw-spin" />
                  Saving…
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <CheckCircle size={14} />
                  Saved
                </>
              ) : saveStatus === "error" ? (
                <>
                  <AlertCircle size={14} />
                  Error
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save
                </>
              )}
            </button>,
            document.getElementById("setup-wizard-save-container")!
          )
        : null}

      <style jsx>{`
        .setup-wizard {
          position: relative;
          min-height: calc(100vh - 200px);
        }

        .sw-layout {
          display: flex;
          gap: 32px;
          align-items: flex-start;
          margin-bottom: 100px;
        }

        /* SIDEBAR */
        .sw-sidebar {
          width: 280px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .sw-sidebar-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sw-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 4px;
        }

        .sw-sidebar-title {
          font-size: 12px;
          font-weight: 700;
          color: #1e3a8a; /* Legacy blue */
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sw-add-btn {
          background: none;
          border: none;
          color: #2563eb;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .sw-add-btn:hover {
          background: #eff6ff;
        }

        .sw-nav-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sw-nav-empty {
          font-size: 13px;
          color: #64748b;
          padding: 12px;
          text-align: center;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px dashed #cbd5e1;
        }

        .sw-nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .sw-nav-item:hover {
          border-color: #93c5fd;
          background: #f8fafc;
        }

        .sw-nav-item.active {
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.1);
        }

        .sw-nav-item.active .sw-nav-label {
          color: #1d4ed8;
          font-weight: 600;
        }

        .sw-nav-label {
          font-size: 14px;
          font-weight: 500;
          color: inherit;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sw-nav-item:not(.active) .sw-nav-label {
          color: #334155;
        }

        .sw-nav-count {
          background: #e2e8f0;
          color: #475569;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .sw-nav-item.active .sw-nav-count {
          background: #dbeafe;
          color: #1e40af;
        }

        .sw-json-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sw-json-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }

        .sw-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sw-detail-view {
          display: flex;
          flex-direction: column;
        }

        .sw-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 12px;
          text-align: center;
        }

        .sw-empty-icon {
          color: #94a3b8;
          margin-bottom: 16px;
        }

        .sw-empty-state h3 {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .sw-empty-state p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .sw-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .sw-btn-primary:hover {
          background: #1d4ed8;
        }

        .sw-save-btn-mini {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          color: #fff;
          background: #2563eb;
        }

        .sw-save-btn-mini:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .sw-save-btn-mini.saving { background: #3b82f6; }
        .sw-save-btn-mini.saved { background: #059669; }
        .sw-save-btn-mini.error { background: #dc2626; }
        .sw-save-btn-mini:disabled { opacity: 0.8; cursor: not-allowed; }

        .sw-spin {
          animation: sw-spin 0.8s linear infinite;
        }

        @keyframes sw-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1024px) {
          .sw-layout {
            flex-direction: column;
          }
          .sw-sidebar {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
