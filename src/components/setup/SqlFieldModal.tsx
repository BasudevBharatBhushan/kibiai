"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { FieldConfig } from "@/components/setup/types";

interface ColumnEntry {
  name: string;
  type: "text" | "number" | "date";
}

interface SqlFieldModalProps {
  tableName: string;
  columns: ColumnEntry[];
  existingFields?: Record<string, FieldConfig>;
  confirmLabel?: string;
  onConfirm: (mergedFields: Record<string, FieldConfig>) => void;
  onCancel: () => void;
}

export function SqlFieldModal({
  tableName,
  columns,
  existingFields = {},
  confirmLabel = "Add Selected Fields →",
  onConfirm,
  onCancel,
}: SqlFieldModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(Object.keys(existingFields).length > 0 ? Object.keys(existingFields) : [])
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const isUpdate = Object.keys(existingFields).length > 0;

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const sortedColumns = useMemo(() => {
    if (!isUpdate) return columns;
    return [...columns].sort((a, b) => {
      const aOld = a.name in existingFields;
      const bOld = b.name in existingFields;
      if (aOld === bOld) return a.name.localeCompare(b.name);
      return aOld ? 1 : -1;
    });
  }, [columns, existingFields, isUpdate]);

  const filtered = sortedColumns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.name));

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.name));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.add(c.name));
        return next;
      });
    }
  };

  const handleConfirm = () => {
    if (selected.size === 0) { alert("Please select at least one field."); return; }
    const merged: Record<string, FieldConfig> = {};
    columns.forEach((col) => {
      if (selected.has(col.name)) {
        merged[col.name] = existingFields[col.name]
          ? { ...existingFields[col.name] }
          : { type: col.type, label: col.name };
      }
    });
    // Preserve any selected fields that disappeared from the schema
    selected.forEach((name) => {
      if (!merged[name] && existingFields[name]) merged[name] = existingFields[name];
    });
    onConfirm(merged);
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="sfm-backdrop" onClick={handleBackdrop}>
      <div className="sfm-modal">
        <div className="sfm-header">
          <div className="sfm-title">
            Select Fields — <strong>{tableName}</strong>
          </div>
          <button className="sfm-close" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="sfm-toolbar">
          <div className="relative flex-1 flex items-center">
            <Search size={14} className="absolute left-3 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="Search fields…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="sfm-select-all-btn" onClick={toggleAll}>
            {allFilteredSelected ? "Deselect All" : "Select All"}
          </button>
        </div>

        <div className="sfm-list">
          {filtered.length === 0 ? (
            <div className="sfm-empty">No fields match your search.</div>
          ) : (
            <table className="sfm-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Field Name</th>
                  <th>Type</th>
                  {isUpdate && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((col) => {
                  const isOld = col.name in existingFields;
                  return (
                    <tr
                      key={col.name}
                      className={selected.has(col.name) ? "sfm-row-selected" : ""}
                      onClick={() => toggle(col.name)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(col.name)}
                          onChange={() => toggle(col.name)}
                          onClick={(e) => e.stopPropagation()}
                          className="sfm-checkbox"
                        />
                      </td>
                      <td className="sfm-field-name">{col.name}</td>
                      <td>
                        <span className={`sfm-type-badge sfm-type-${col.type}`}>
                          {col.type}
                        </span>
                      </td>
                      {isUpdate && (
                        <td>
                          {isOld ? (
                            <span className="text-[10px] uppercase font-bold text-slate-400">Existing</span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">New</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="sfm-footer">
          <span className="sfm-count">{selected.size} of {columns.length} selected</span>
          <div className="sfm-actions">
            <button className="sfm-btn-cancel" onClick={onCancel}>Cancel</button>
            <button
              className="sfm-btn-confirm"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sfm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(5px);
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .sfm-modal {
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 620px;
          height: 85vh;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 60px rgba(15, 23, 42, 0.25);
          animation: sfm-in 0.18s ease;
          overflow: hidden;
        }
        @keyframes sfm-in {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .sfm-header {
          padding: 18px 22px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #636ae8, #818cf8);
          color: #fff;
          flex-shrink: 0;
        }
        .sfm-title { font-size: 15px; color: #fff; }
        .sfm-close {
          background: rgba(255,255,255,0.15);
          border: none;
          color: #fff;
          border-radius: 6px;
          padding: 5px;
          cursor: pointer;
          display: flex;
          transition: background 0.15s;
        }
        .sfm-close:hover { background: rgba(255,255,255,0.25); }
        .sfm-toolbar {
          padding: 14px 20px;
          display: flex;
          gap: 12px;
          align-items: center;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
          flex-shrink: 0;
        }
        .sfm-select-all-btn {
          padding: 7px 14px;
          border: 1.5px solid #636ae8;
          border-radius: 7px;
          background: #fff;
          color: #636ae8;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .sfm-select-all-btn:hover { background: #636ae8; color: #fff; }
        .sfm-list { flex: 1; overflow-y: auto; padding: 0; position: relative; }
        .sfm-empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; }
        .sfm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sfm-table th, .sfm-table td {
          padding: 10px 16px;
          border-bottom: 1px solid #f1f5f9;
          text-align: left;
        }
        .sfm-table th {
          background: #f8f9fa;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          position: sticky;
          top: 0;
          z-index: 1;
          box-shadow: 0 1px 0 #e2e8f0;
        }
        .sfm-row-selected td { background: #eef2ff; }
        .sfm-table tr:hover td { background: #f5f8ff; }
        .sfm-checkbox { width: 15px; height: 15px; accent-color: #636ae8; }
        .sfm-field-name { font-weight: 500; color: #0f172a; }
        .sfm-type-badge {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .sfm-type-text   { background: #e0e7ff; color: #3730a3; }
        .sfm-type-number { background: #dcfce7; color: #166534; }
        .sfm-type-date   { background: #fef3c7; color: #92400e; }
        .sfm-footer {
          padding: 16px 22px;
          border-top: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          flex-shrink: 0;
        }
        .sfm-count { font-size: 13px; color: #6b7280; font-weight: 500; }
        .sfm-actions { display: flex; gap: 10px; }
        .sfm-btn-cancel {
          padding: 8px 16px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sfm-btn-cancel:hover { border-color: #cbd5e1; }
        .sfm-btn-confirm {
          padding: 8px 18px;
          background: linear-gradient(135deg, #636ae8, #818cf8);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(99, 106, 232, 0.3);
          transition: all 0.2s;
        }
        .sfm-btn-confirm:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(99, 106, 232, 0.4);
        }
        .sfm-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      `}</style>
    </div>
  );
}
