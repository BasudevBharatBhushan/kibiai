"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { FieldConfig } from "@/components/setup/types";

interface FieldEntry {
  name: string;
  type: string;
}

interface UpdateFieldsModalProps {
  tableName: string;
  host: string;
  protocol: "data-api" | "o-data-api";
  file: string;
  layout: string | null;
  username: string;
  password: string;
  existingFields: Record<string, FieldConfig>;
  onConfirm: (mergedFields: Record<string, FieldConfig>) => void;
  onCancel: () => void;
}

export function UpdateFieldsModal({
  tableName,
  host,
  protocol,
  file,
  layout,
  username,
  password,
  existingFields,
  onConfirm,
  onCancel,
}: UpdateFieldsModalProps) {
  const [search, setSearch] = useState("");
  const [fields, setFields] = useState<FieldEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(Object.keys(existingFields)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    fetchFields();
  }, []);

  const basicToken = () => btoa(`${username}:${password}`);

  const fetchFields = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "";
      let body: any = {};

      if (protocol === "data-api") {
        endpoint = "/api/filemaker/setup/fields";
        body = { host, database: file, layout };
      } else {
        // For OData, we can just fetch the tables/entities and find our table's fields
        endpoint = "/api/filemaker/setup/layouts"; // It actually fetches tables for OData
        body = { host, database: file, protocol: "o-data-api" };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicToken()}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch fields.");

      if (protocol === "data-api") {
        setFields(data.fields || []);
      } else {
        const tableData = data.tables?.find((t: any) => t.table === tableName);
        if (!tableData) throw new Error("Table not found in OData source.");
        setFields(tableData.fields || []);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching fields.");
    } finally {
      setLoading(false);
    }
  };

  const sortedFields = useMemo(() => {
    // Sort so that new (unselected) fields appear first
    return [...fields].sort((a, b) => {
      const aIsOld = Object.keys(existingFields).includes(a.name);
      const bIsOld = Object.keys(existingFields).includes(b.name);
      if (aIsOld === bIsOld) {
        return a.name.localeCompare(b.name);
      }
      return aIsOld ? 1 : -1; // new fields (not old) come first
    });
  }, [fields, existingFields]);

  const filteredFields = sortedFields.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected =
    filteredFields.length > 0 &&
    filteredFields.every((f) => selected.has(f.name));

  const toggleField = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredFields.forEach((f) => next.delete(f.name));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredFields.forEach((f) => next.add(f.name));
        return next;
      });
    }
  };

  const handleConfirm = () => {
    const mergedFields: Record<string, FieldConfig> = {};
    fields.forEach((f) => {
      if (selected.has(f.name)) {
        if (existingFields[f.name]) {
          // Preserve existing metadata
          mergedFields[f.name] = { ...existingFields[f.name] };
        } else {
          // New field
          mergedFields[f.name] = { type: f.type as FieldConfig["type"], label: f.name };
        }
      }
    });
    
    // Also preserve any selected fields that were somehow not returned by the API but were selected?
    // Usually it's better to strictly use what API returns. If a field was in existingFields but not in API,
    // and user kept it checked? Wait, if it's not in API it won't be displayed, so they can't uncheck it, 
    // but it won't be in `fields` array either. We will just preserve it if it's in `selected` to be safe.
    selected.forEach(fieldName => {
       if (!mergedFields[fieldName] && existingFields[fieldName]) {
           mergedFields[fieldName] = existingFields[fieldName];
       }
    });

    onConfirm(mergedFields);
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="ufm-backdrop" onClick={handleBackdrop}>
      <div className="ufm-modal">
        {/* Header */}
        <div className="ufm-header">
          <div className="ufm-title">
            Manage Fields — <strong>{tableName}</strong>
          </div>
          <button className="ufm-close" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 size={32} className="animate-spin text-indigo-500 mb-4" />
            <p className="text-slate-500 text-sm">Fetching fields from database...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm border border-red-200">
              {error}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="ufm-btn-cancel" onClick={onCancel}>Close</button>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="ufm-toolbar">
              <div className="ufm-search-wrap">
                <Search size={14} className="ufm-search-icon" />
                <input
                  ref={searchRef}
                  type="text"
                  className="ufm-search"
                  placeholder="Search fields…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="ufm-select-all-btn" onClick={toggleAll}>
                {allFilteredSelected ? "Deselect All" : "Select All"}
              </button>
            </div>

            {/* Field list */}
            <div className="ufm-list">
              {filteredFields.length === 0 ? (
                <div className="ufm-empty">No fields match your search.</div>
              ) : (
                <table className="ufm-table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Field Name</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFields.map((field) => {
                      const isOld = Object.keys(existingFields).includes(field.name);
                      return (
                        <tr
                          key={field.name}
                          className={selected.has(field.name) ? "ufm-row-selected" : ""}
                          onClick={() => toggleField(field.name)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.has(field.name)}
                              onChange={() => toggleField(field.name)}
                              onClick={(e) => e.stopPropagation()}
                              className="ufm-checkbox"
                            />
                          </td>
                          <td className="ufm-field-name">{field.name}</td>
                          <td>
                            <span className={`ufm-type-badge ufm-type-${field.type}`}>
                              {field.type}
                            </span>
                          </td>
                          <td>
                            {isOld ? (
                              <span className="text-[10px] uppercase font-bold text-slate-400">Existing</span>
                            ) : (
                              <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">New</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="ufm-footer">
              <span className="ufm-count">
                {selected.size} of {fields.length} selected
              </span>
              <div className="ufm-actions">
                <button className="ufm-btn-cancel" onClick={onCancel}>
                  Cancel
                </button>
                <button
                  className="ufm-btn-confirm"
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                >
                  Update Fields
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .ufm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(5px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .ufm-modal {
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 620px;
          height: 85vh;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 60px rgba(15, 23, 42, 0.25);
          animation: ufm-in 0.18s ease;
          overflow: hidden;
        }

        @keyframes ufm-in {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ufm-header {
          padding: 18px 22px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #636ae8, #818cf8);
          color: #fff;
          flex-shrink: 0;
        }

        .ufm-title {
          font-size: 15px;
          color: #fff;
        }

        .ufm-close {
          background: rgba(255,255,255,0.15);
          border: none;
          color: #fff;
          border-radius: 6px;
          padding: 5px;
          cursor: pointer;
          display: flex;
          transition: background 0.15s;
        }

        .ufm-close:hover {
          background: rgba(255,255,255,0.25);
        }

        .ufm-toolbar {
          padding: 14px 20px;
          display: flex;
          gap: 12px;
          align-items: center;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
          flex-shrink: 0;
        }

        .ufm-search-wrap {
          position: relative;
          flex: 1;
        }

        .ufm-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .ufm-search {
          width: 100%;
          padding: 8px 12px 8px 32px;
          border: 1.5px solid #d1d5db;
          border-radius: 7px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }

        .ufm-search:focus {
          border-color: #636ae8;
        }

        .ufm-select-all-btn {
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

        .ufm-select-all-btn:hover {
          background: #636ae8;
          color: #fff;
        }

        .ufm-list {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          position: relative;
        }

        .ufm-empty {
          text-align: center;
          padding: 40px;
          color: #94a3b8;
          font-size: 14px;
        }

        .ufm-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .ufm-table th,
        .ufm-table td {
          padding: 10px 16px;
          border-bottom: 1px solid #f1f5f9;
          text-align: left;
        }

        .ufm-table th {
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

        .ufm-row-selected td {
          background: #eef2ff;
        }

        .ufm-table tr:hover td {
          background: #f5f8ff;
        }

        .ufm-checkbox {
          width: 15px;
          height: 15px;
          accent-color: #636ae8;
        }

        .ufm-field-name {
          font-weight: 500;
          color: #0f172a;
        }

        .ufm-type-badge {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .ufm-type-text { background: #e0e7ff; color: #3730a3; }
        .ufm-type-number { background: #dcfce7; color: #166534; }
        .ufm-type-date { background: #fef3c7; color: #92400e; }

        .ufm-footer {
          padding: 16px 22px;
          border-top: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          flex-shrink: 0;
        }

        .ufm-count {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
        }

        .ufm-actions {
          display: flex;
          gap: 10px;
        }

        .ufm-btn-cancel {
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

        .ufm-btn-cancel:hover {
          border-color: #cbd5e1;
        }

        .ufm-btn-confirm {
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

        .ufm-btn-confirm:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(99, 106, 232, 0.4);
        }

        .ufm-btn-confirm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
