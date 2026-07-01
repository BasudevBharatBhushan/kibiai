"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { FieldConfig } from "@/components/setup/types";
import { SqlFieldModal } from "@/components/setup/SqlFieldModal";

interface ColumnEntry {
  name: string;
  type: "text" | "number" | "date";
}

interface UpdateSqlFieldsModalProps {
  tableName: string;
  physicalName: string;
  host: string;
  apiKey: string;
  existingFields: Record<string, FieldConfig>;
  onConfirm: (mergedFields: Record<string, FieldConfig>) => void;
  onCancel: () => void;
}

export function UpdateSqlFieldsModal({
  tableName,
  physicalName,
  host,
  apiKey,
  existingFields,
  onConfirm,
  onCancel,
}: UpdateSqlFieldsModalProps) {
  const [columns, setColumns] = useState<ColumnEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/sql/setup/schema", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host, apiKey }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to fetch schema.");
        const table = (data.tables as { name: string; columns: ColumnEntry[] }[]).find(
          (t) => t.name === physicalName
        );
        if (!table) throw new Error(`Table '${physicalName}' not found in schema.`);
        setColumns(table.columns);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [host, apiKey, physicalName]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1200] flex items-center justify-center">
        <div className="bg-white rounded-xl p-10 flex flex-col items-center gap-4 shadow-2xl">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-slate-500 text-sm">Fetching schema from database…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1200] flex items-center justify-center p-5">
        <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm border border-red-200">{error}</div>
          <div className="flex justify-end">
            <button
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={onCancel}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SqlFieldModal
      tableName={tableName}
      columns={columns}
      existingFields={existingFields}
      confirmLabel="Update Fields"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
