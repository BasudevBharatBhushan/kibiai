"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { TableConfig, FieldConfig } from "@/components/setup/types";
import { ODataFieldModal } from "@/components/setup/ODataFieldModal";
import { Modal } from "@/components/ui/Modal";

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
  onHostChange: (val: string) => void;
  onProtocolChange: (val: "data-api" | "o-data-api") => void;
  onClose: () => void;
  initialFile?: string;
  initialUsername?: string;
}

type FetchStatus = { type: "success" | "error"; message: string } | null;

export function AddDatabaseSection({
  host,
  protocol,
  tableCount,
  existingTableNames,
  onTableAdded,
  onHostChange,
  onProtocolChange,
  onClose,
  initialFile = "",
  initialUsername = "",
}: AddDatabaseSectionProps) {
  // Credential fields
  const [file, setFile] = useState(initialFile);
  const [username, setUsername] = useState(initialUsername);
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
      const seen = new Set<string>();
      
      (data.fields as { name: string; type: string }[]).forEach((f) => {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          fields[f.name] = { type: f.type as FieldConfig["type"], label: f.name };
        }
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
    const seen = new Set<string>();
    
    tableMeta.fields
      .filter((f) => selectedFields.includes(f.name))
      .forEach((f) => {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          fields[f.name] = { type: f.type as FieldConfig["type"], label: f.name };
        }
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
    <Modal isOpen={true} onClose={onClose} title="Add New Database">
      <div className="flex flex-col gap-5">
        <div className="bg-blue-50/50 text-blue-800 text-xs px-3 py-2 rounded-md border border-blue-100 flex justify-between items-center">
          <span>Max 5 databases allowed.</span>
          <span className="font-semibold">{tableCount}/5</span>
        </div>

        {/* Host and Credentials Form */}
        <div className="flex flex-col gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-700 m-0">Host & Database Configuration</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Host Configuration */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="ads-host" className="text-xs font-medium text-slate-600">Host Address</label>
              <input
                id="ads-host"
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-100"
                placeholder="e.g. kibiz.smtech.cloud"
                value={host}
                onChange={(e) => { onHostChange(e.target.value); setFetchStatus(null); }}
                disabled={tableCount > 0}
              />
            </div>
            
            {/* Protocol */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="ads-protocol" className="text-xs font-medium text-slate-600">Protocol</label>
              <select
                id="ads-protocol"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-100"
                value={protocol}
                onChange={(e) => { onProtocolChange(e.target.value as "data-api" | "o-data-api"); setFetchStatus(null); }}
                disabled={tableCount > 0}
              >
                <option value="data-api">Data API</option>
                <option value="o-data-api">OData API</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ads-file" className="text-xs font-medium text-slate-600">
                {protocol === "data-api" ? "Database File" : "Database Name"}
              </label>
              <input
                id="ads-file"
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="e.g. KiBiAIDemo"
                value={file}
                onChange={(e) => { setFile(e.target.value); setFetchStatus(null); }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ads-username" className="text-xs font-medium text-slate-600">Username</label>
              <input
                id="ads-username"
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Database username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFetchStatus(null); }}
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="ads-password" className="text-xs font-medium text-slate-600">Password</label>
              <input
                id="ads-password"
                type="password"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Database password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFetchStatus(null); }}
              />
            </div>
          </div>
        </div>

        {/* Table select + Fetch Tables */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="ads-table-select" className="text-xs font-medium text-slate-600">
              {protocol === "data-api" ? "Select Table" : "Select Entity"}
            </label>
            <button
              id="fetch-tables-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-600 text-xs font-semibold cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleFetchTables}
              disabled={fetchingTables || !file || !username || !password}
            >
              {fetchingTables ? (
                <><Loader2 size={14} className="animate-spin" /> Fetching…</>
              ) : (
                <><Search size={14} /> Fetch Tables</>
              )}
            </button>
          </div>

          {protocol === "data-api" ? (
            <select
              id="ads-table-select"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
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
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            <select
              id="ads-odata-table-select"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
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
                <option key={t.table} value={t.table}>{t.table}</option>
              ))}
            </select>
          )}
        </div>

        {/* Layout select (data-api only) */}
        {protocol === "data-api" && selectedTable && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ads-layout-select" className="text-xs font-medium text-slate-600">
              Select Layout
            </label>
            <select
              id="ads-layout-select"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedLayout}
              disabled={tableLayouts.length === 0}
              onChange={(e) => setSelectedLayout(e.target.value)}
            >
              <option value="">Select a layout</option>
              {tableLayouts.map((l) => (
                <option key={l.name} value={l.name}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Status message */}
        {fetchStatus && (
          <div className={`px-4 py-3 rounded-md text-sm font-medium ${fetchStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {fetchStatus.message}
          </div>
        )}

        {/* Add Table button (data-api only) */}
        {protocol === "data-api" && (
          <div className="flex justify-end mt-2">
            <button
              id="add-table-btn"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-colors hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={handleAddTableDataApi}
              disabled={addingTable || !selectedLayout}
            >
              {addingTable ? (
                <><Loader2 size={14} className="animate-spin" /> Adding Table…</>
              ) : (
                <><Plus size={14} /> Add Table</>
              )}
            </button>
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
    </Modal>

  );
}
