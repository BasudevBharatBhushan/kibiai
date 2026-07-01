"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { TableConfig, FieldConfig } from "@/components/setup/types";
import { Modal } from "@/components/ui/Modal";
import { SqlFieldModal } from "@/components/setup/SqlFieldModal";

interface SchemaColumn {
  name: string;
  type: "text" | "number" | "date";
}

interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

interface AddSqlDatabaseSectionProps {
  host: string;
  apiKey: string;
  existingTableNames: string[];
  onTableAdded: (tableName: string, tableConfig: TableConfig) => void;
  onHostChange: (val: string) => void;
  onApiKeyChange: (val: string) => void;
  onClose: () => void;
  tableCount: number;
}

type FetchStatus = { type: "success" | "error"; message: string } | null;

export function AddSqlDatabaseSection({
  host,
  apiKey,
  existingTableNames,
  onTableAdded,
  onHostChange,
  onApiKeyChange,
  onClose,
  tableCount,
}: AddSqlDatabaseSectionProps) {
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [fetchingTables, setFetchingTables] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [fieldModalTable, setFieldModalTable] = useState<SchemaTable | null>(null);

  useEffect(() => {
    setTables([]);
    setSelectedTable("");
    setFetchStatus(null);
  }, [host, localApiKey]);

  const showStatus = (type: "success" | "error", message: string) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setFetchStatus({ type, message });
    statusTimer.current = setTimeout(() => setFetchStatus(null), 5000);
  };

  const handleFetchTables = async () => {
    if (!host) return showStatus("error", "Enter a Server URL in the Host Configuration section first.");
    if (!localApiKey) return showStatus("error", "Enter an API key.");

    setFetchingTables(true);
    setTables([]);
    setSelectedTable("");

    try {
      const res = await fetch("/api/sql/setup/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, apiKey: localApiKey }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch tables.");
      setTables(data.tables ?? []);
      onApiKeyChange(localApiKey);
      showStatus("success", `Fetched ${data.tables?.length ?? 0} tables. Select one to pick fields.`);
    } catch (err: unknown) {
      showStatus("error", err instanceof Error ? err.message : "Error fetching tables.");
    } finally {
      setFetchingTables(false);
    }
  };

  const handleOpenFieldModal = () => {
    if (!selectedTable) return showStatus("error", "Select a table first.");
    if (existingTableNames.includes(selectedTable)) {
      return showStatus("error", `Table '${selectedTable}' already added.`);
    }
    const meta = tables.find((t) => t.name === selectedTable);
    if (!meta) return showStatus("error", "Table metadata not found.");
    setFieldModalTable(meta);
  };

  const handleFieldsConfirmed = (mergedFields: Record<string, FieldConfig>) => {
    if (!fieldModalTable) return;
    const tableConfig: TableConfig = {
      file: "",
      username: "",
      password: "",
      layout: fieldModalTable.name,
      fields: mergedFields,
    };
    onTableAdded(fieldModalTable.name, tableConfig);
    setFieldModalTable(null);
    onClose();
  };

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title="Add SQLite Table">
        <div className="flex flex-col gap-5">
          <div className="bg-blue-50/50 text-blue-800 text-xs px-3 py-2 rounded-md border border-blue-100 flex justify-between items-center">
            <span>Connect to your SQLite server and import a table.</span>
            <span className="font-semibold">Active: {tableCount}</span>
          </div>

          {/* Connection configuration */}
          <div className="flex flex-col gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-700 m-0">Connection Configuration</h4>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600">Server URL</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-100"
                  placeholder="e.g. https://api.example.com/sqlite"
                  value={host}
                  onChange={(e) => onHostChange(e.target.value)}
                  disabled={tableCount > 0}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600">API Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Bearer token"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table selector + Fetch */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Select Table</label>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-600 text-xs font-semibold cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleFetchTables}
                disabled={fetchingTables || !host || !localApiKey}
              >
                {fetchingTables ? (
                  <><Loader2 size={14} className="animate-spin" /> Fetching…</>
                ) : (
                  <><Search size={14} /> Fetch Tables</>
                )}
              </button>
            </div>

            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
              value={selectedTable}
              disabled={tables.length === 0}
              onChange={(e) => setSelectedTable(e.target.value)}
            >
              <option value="">
                {tables.length === 0 ? "Enter credentials and fetch tables first" : "Select a table"}
              </option>
              {tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.columns.length} cols)
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          {fetchStatus && (
            <div className={`px-4 py-3 rounded-md text-sm font-medium ${fetchStatus.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              {fetchStatus.message}
            </div>
          )}

          {/* Select Fields button */}
          <div className="flex justify-end mt-2">
            <button
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-colors hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={handleOpenFieldModal}
              disabled={!selectedTable}
            >
              Select Fields →
            </button>
          </div>
        </div>
      </Modal>

      {fieldModalTable && (
        <SqlFieldModal
          tableName={fieldModalTable.name}
          columns={fieldModalTable.columns}
          confirmLabel="Add Selected Fields →"
          onConfirm={handleFieldsConfirmed}
          onCancel={() => setFieldModalTable(null)}
        />
      )}
    </>
  );
}
