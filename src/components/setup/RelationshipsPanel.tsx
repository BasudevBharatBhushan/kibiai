"use client";

import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Relationship, TableConfig } from "@/components/setup/types";

interface RelationshipsPanelProps {
  tables: Record<string, TableConfig>;
  relationships: Relationship[];
  onAdd: () => void;
  onUpdate: (index: number, property: keyof Relationship, value: string) => void;
  onDelete: (index: number) => void;
}

export function RelationshipsPanel({
  tables,
  relationships,
  onAdd,
  onUpdate,
  onDelete,
}: RelationshipsPanelProps) {
  const tableNames = Object.keys(tables);

  const getTableFields = (tableName: string) =>
    tableName && tables[tableName] ? Object.keys(tables[tableName].fields) : [];

  return (
    <div className="rp-panel">
      {/* Header */}
      <div className="rp-header">
        <div className="rp-title">
          Relationships
        </div>
        <button
          id="add-relationship-btn"
          className="rp-add-btn"
          onClick={onAdd}
          disabled={tableNames.length < 2}
          title={tableNames.length < 2 ? "Add at least 2 tables first" : "Add relationship"}
        >
          <Plus size={14} />
          Add Relationship
        </button>
      </div>

      {/* Body */}
      <div className="rp-body">
        {tableNames.length < 2 && (
          <div className="rp-hint">
            Add at least 2 databases to define relationships between them.
          </div>
        )}

        {relationships.length === 0 && tableNames.length >= 2 && (
          <div className="rp-hint">
            No relationships defined. Click <strong>+ Add Relationship</strong> to create one.
          </div>
        )}

        <div className="rp-grid">
          {relationships.map((rel, index) => {
            const sourceFields = getTableFields(rel.primary_table);
            const targetFields = getTableFields(rel.joined_table);

            return (
              <div key={index} className="rp-rel-card">
                <div className="rp-rel-header">
                  <span className="rp-rel-label">Relationship {index + 1}</span>
                  <button
                    className="rp-del-btn"
                    onClick={() => onDelete(index)}
                    title="Delete relationship"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="rp-rel-fields">
                  
                  {/* Left Side (Source) */}
                  <div className="rp-rel-side">
                    <div className="rp-field">
                      <label className="rp-label">Primary Table</label>
                      <select
                        className="rp-select"
                        value={rel.primary_table}
                        onChange={(e) => onUpdate(index, "primary_table", e.target.value)}
                      >
                        <option value="">Select Table…</option>
                        {tableNames.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rp-field">
                      <label className="rp-label rp-label-field">Source Field</label>
                      <select
                        className="rp-select rp-select-field"
                        value={rel.source}
                        onChange={(e) => onUpdate(index, "source", e.target.value)}
                        disabled={!rel.primary_table || sourceFields.length === 0}
                      >
                        <option value="">Select Field…</option>
                        {sourceFields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Arrow Center */}
                  <div className="rp-arrow">
                    <ArrowRight size={24} />
                  </div>

                  {/* Right Side (Target) */}
                  <div className="rp-rel-side">
                    <div className="rp-field">
                      <label className="rp-label">Joined Table</label>
                      <select
                        className="rp-select"
                        value={rel.joined_table}
                        onChange={(e) => onUpdate(index, "joined_table", e.target.value)}
                      >
                        <option value="">Select Table…</option>
                        {tableNames.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rp-field">
                      <label className="rp-label rp-label-field">Target Field</label>
                      <select
                        className="rp-select rp-select-field"
                        value={rel.target}
                        onChange={(e) => onUpdate(index, "target", e.target.value)}
                        disabled={!rel.joined_table || targetFields.length === 0}
                      >
                        <option value="">Select Field…</option>
                        {targetFields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .rp-panel {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .rp-header {
          background: #f8fafc;
          padding: 16px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .rp-title {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
        }

        .rp-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .rp-add-btn:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .rp-add-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          background: #94a3b8;
        }

        .rp-body {
          padding: 24px;
        }

        .rp-hint {
          font-size: 14px;
          color: #64748b;
          text-align: center;
          padding: 32px 20px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px dashed #cbd5e1;
        }

        .rp-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .rp-rel-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background: #fdfdfd;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .rp-rel-header {
          background: #f8fafc;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e2e8f0;
        }

        .rp-rel-label {
          font-size: 12px;
          font-weight: 700;
          color: #1e3a8a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rp-del-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
        }

        .rp-del-btn:hover {
          background: #fef2f2;
        }

        .rp-rel-fields {
          padding: 20px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .rp-rel-side {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .rp-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          color: #2563eb;
          margin-top: 20px; /* Align visually with inputs */
        }

        .rp-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .rp-label {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rp-label-field {
          color: #64748b;
        }

        .rp-select {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          color: #0f172a;
          background: #fff;
          outline: none;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .rp-select-field {
          border: 1px dashed #cbd5e1;
          background: #f8fafc;
          font-weight: 400;
        }

        .rp-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
          border-style: solid;
        }

        .rp-select:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          border-style: solid;
        }

        @media (max-width: 768px) {
          .rp-rel-fields {
            flex-direction: column;
            gap: 20px;
          }
          .rp-rel-side {
            width: 100%;
          }
          .rp-arrow {
            transform: rotate(90deg);
            margin-top: 0;
            margin: 10px 0;
          }
        }
      `}</style>
    </div>
  );
}
