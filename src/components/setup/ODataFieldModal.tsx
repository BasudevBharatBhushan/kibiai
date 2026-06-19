"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

interface FieldEntry {
  name: string;
  type: string;
}

interface ODataTableMeta {
  table: string;
  fields: FieldEntry[];
}

interface ODataFieldModalProps {
  tableMeta: ODataTableMeta;
  onConfirm: (selectedFields: string[]) => void;
  onCancel: () => void;
}

export function ODataFieldModal({ tableMeta, onConfirm, onCancel }: ODataFieldModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const filteredFields = tableMeta.fields.filter((f) =>
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
    if (selected.size === 0) {
      alert("Please select at least one field.");
      return;
    }
    onConfirm([...selected]);
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="odfm-backdrop" onClick={handleBackdrop}>
      <div className="odfm-modal">
        {/* Header */}
        <div className="odfm-header">
          <div className="odfm-title">
            Select Fields — <strong>{tableMeta.table}</strong>
          </div>
          <button className="odfm-close" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="odfm-toolbar">
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
          <button className="odfm-select-all-btn" onClick={toggleAll}>
            {allFilteredSelected ? "Deselect All" : "Select All"}
          </button>
        </div>

        {/* Field list */}
        <div className="odfm-list">
          {filteredFields.length === 0 ? (
            <div className="odfm-empty">No fields match your search.</div>
          ) : (
            <table className="odfm-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Field Name</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.map((field) => (
                  <tr
                    key={field.name}
                    className={selected.has(field.name) ? "odfm-row-selected" : ""}
                    onClick={() => toggleField(field.name)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(field.name)}
                        onChange={() => toggleField(field.name)}
                        onClick={(e) => e.stopPropagation()}
                        className="odfm-checkbox"
                      />
                    </td>
                    <td className="odfm-field-name">{field.name}</td>
                    <td>
                      <span className={`odfm-type-badge odfm-type-${field.type}`}>
                        {field.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="odfm-footer">
          <span className="odfm-count">
            {selected.size} of {tableMeta.fields.length} selected
          </span>
          <div className="odfm-actions">
            <button className="odfm-btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="odfm-btn-confirm"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              Add Selected Fields →
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .odfm-backdrop {
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

        .odfm-modal {
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 620px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 60px rgba(15, 23, 42, 0.25);
          animation: odfm-in 0.18s ease;
          overflow: hidden;
        }

        @keyframes odfm-in {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .odfm-header {
          padding: 18px 22px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #636ae8, #818cf8);
          color: #fff;
        }

        .odfm-title {
          font-size: 15px;
          color: #fff;
        }

        .odfm-close {
          background: rgba(255,255,255,0.15);
          border: none;
          color: #fff;
          border-radius: 6px;
          padding: 5px;
          cursor: pointer;
          display: flex;
          transition: background 0.15s;
        }

        .odfm-close:hover {
          background: rgba(255,255,255,0.25);
        }

        .odfm-toolbar {
          padding: 14px 20px;
          display: flex;
          gap: 12px;
          align-items: center;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
        }

        .odfm-select-all-btn {
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

        .odfm-select-all-btn:hover {
          background: #636ae8;
          color: #fff;
        }

        .odfm-list {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }

        .odfm-empty {
          text-align: center;
          padding: 40px;
          color: #94a3b8;
          font-size: 14px;
        }

        .odfm-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .odfm-table th,
        .odfm-table td {
          padding: 10px 16px;
          border-bottom: 1px solid #f1f5f9;
          text-align: left;
        }

        .odfm-table th {
          background: #f8f9fa;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .odfm-row-selected td {
          background: #eef2ff;
        }

        .odfm-table tr:hover td {
          background: #f5f8ff;
        }

        .odfm-checkbox {
          width: 15px;
          height: 15px;
          accent-color: #636ae8;
        }

        .odfm-field-name {
          font-weight: 500;
          color: #0f172a;
        }

        .odfm-type-badge {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .odfm-type-text { background: #e0e7ff; color: #3730a3; }
        .odfm-type-number { background: #dcfce7; color: #166534; }
        .odfm-type-date { background: #fef3c7; color: #92400e; }

        .odfm-footer {
          padding: 16px 22px;
          border-top: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
        }

        .odfm-count {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
        }

        .odfm-actions {
          display: flex;
          gap: 10px;
        }

        .odfm-btn-cancel {
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

        .odfm-btn-cancel:hover {
          border-color: #cbd5e1;
        }

        .odfm-btn-confirm {
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

        .odfm-btn-confirm:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(99, 106, 232, 0.4);
        }

        .odfm-btn-confirm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
