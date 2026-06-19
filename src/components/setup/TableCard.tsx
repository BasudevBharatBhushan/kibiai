"use client";

import { useState } from "react";

import { Trash2, Search, X } from "lucide-react";
import { TableConfig, FieldConfig } from "@/components/setup/types";

interface TableCardProps {
  tableName: string;
  tableConfig: TableConfig;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onUpdateProperty: (property: keyof Omit<TableConfig, "fields">, value: string) => void;
  onUpdateField: (fieldName: string, property: keyof FieldConfig, value: string) => void;
  onDeleteField: (fieldName: string) => void;
  onManageFields: () => void;
}

export function TableCard({
  tableName,
  tableConfig,
  onDelete,
  onRename,
  onUpdateProperty,
  onUpdateField,
  onDeleteField,
  onManageFields,
}: TableCardProps) {
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleDelete = () => {
    if (confirm(`Delete table '${tableName}' and all its fields?`)) {
      onDelete();
    }
  };

  const handleDeleteField = (fieldName: string) => {
    if (confirm(`Delete field '${fieldName}' from '${tableName}'?`)) {
      onDeleteField(fieldName);
    }
  };

  const handlePasswordFocus = () => {
    setIsEditingPassword(true);
    setTempPassword("");
  };

  const handlePasswordBlur = () => {
    setIsEditingPassword(false);
    if (tempPassword) {
      onUpdateProperty("password", tempPassword);
    }
  };

  return (
    <div className="tc-container">
      {/* Header */}
      <div className="tc-header">
        <div className="tc-header-left">
          <h2 className="tc-table-name">{tableName}</h2>
          <span className="tc-field-count">{Object.keys(tableConfig.fields).length} fields</span>
        </div>
        <button
          className="tc-delete-btn"
          onClick={handleDelete}
          title="Delete table"
        >
          <Trash2 size={14} />
          Delete Database
        </button>
      </div>

      <div className="tc-content">
        {/* Table properties */}
        <div className="tc-row">
          <div className="tc-field-group">
            <label className="tc-label">Table Name</label>
            <input
              type="text"
              className="tc-input"
              defaultValue={tableName}
              onBlur={(e) => {
                const newName = e.target.value.trim();
                if (newName && newName !== tableName) onRename(newName);
                else e.target.value = tableName; // reset if invalid
              }}
            />
          </div>
          <div className="tc-field-group">
            <label className="tc-label">Layout Name</label>
            <input
              type="text"
              className="tc-input"
              value={tableConfig.layout ?? ""}
              onChange={(e) => onUpdateProperty("layout", e.target.value)}
              placeholder="Layout name"
            />
          </div>
          <div className="tc-field-group">
            <label className="tc-label">File</label>
            <input
              type="text"
              className="tc-input"
              value={tableConfig.file}
              onChange={(e) => onUpdateProperty("file", e.target.value)}
            />
          </div>
        </div>

        <div className="tc-row">
          <div className="tc-field-group">
            <label className="tc-label">Username</label>
            <input
              type="text"
              className="tc-input"
              value={tableConfig.username}
              onChange={(e) => onUpdateProperty("username", e.target.value)}
            />
          </div>
          <div className="tc-field-group">
            <label className="tc-label">Password</label>
            <input
              type="password"
              className="tc-input"
              value={isEditingPassword ? tempPassword : (tableConfig.password ? "••••••••" : "")}
              onFocus={handlePasswordFocus}
              onBlur={handlePasswordBlur}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder={isEditingPassword ? "Type new to change" : "Password"}
              autoComplete="new-password"
            />
          </div>
          <div className="tc-field-group" />{/* spacer */}
        </div>

        {/* Fields table */}
        <div className="tc-fields-header">
          <div className="tc-fields-header-left">
            <strong>Fields ({Object.keys(tableConfig.fields).length})</strong>
            
            <div className="tc-search-wrapper">
              <span className="tc-search-icon">
                <Search size={13} />
              </span>
              <input
                type="text"
                className="tc-search-input"
                placeholder="Search fields or labels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="tc-search-clear" onClick={() => setSearchQuery("")} title="Clear search">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <button className="tc-manage-btn" onClick={onManageFields} title="Update or sync fields from database">
            Update Fields
          </button>
        </div>
        <div className="tc-table-wrapper">
          <table className="tc-table">
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Type</th>
                <th>Label</th>
                <th>Prefix</th>
                <th>Suffix</th>
                <th>Value List</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filteredKeys = Object.keys(tableConfig.fields).filter((fieldName) => {
                  const field = tableConfig.fields[fieldName];
                  const query = searchQuery.toLowerCase().trim();
                  if (!query) return true;
                  return (
                    fieldName.toLowerCase().includes(query) ||
                    (field.label || "").toLowerCase().includes(query)
                  );
                });

                if (filteredKeys.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="tc-td-empty">
                        No fields match "{searchQuery}"
                      </td>
                    </tr>
                  );
                }

                return filteredKeys.map((fieldName) => {
                  const field = tableConfig.fields[fieldName];
                  return (
                    <tr key={fieldName}>
                      <td className="tc-td-name">
                        <strong>{fieldName}</strong>
                      </td>
                      <td>
                        <span className={`tc-type-badge tc-type-${field.type}`}>
                          {field.type}
                        </span>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tc-cell-input"
                          value={field.label}
                          onChange={(e) => onUpdateField(fieldName, "label", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tc-cell-input tc-cell-short"
                          value={field.prefix || ""}
                          placeholder="$"
                          onChange={(e) => onUpdateField(fieldName, "prefix", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tc-cell-input tc-cell-short"
                          value={field.suffix || ""}
                          placeholder="%"
                          onChange={(e) => onUpdateField(fieldName, "suffix", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tc-cell-input"
                          value={field.valuelist || ""}
                          placeholder="A, B, C"
                          onChange={(e) => onUpdateField(fieldName, "valuelist", e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          className="tc-delete-field-btn"
                          onClick={() => handleDeleteField(fieldName)}
                          title="Delete field"
                        >
                          ╳
                        </button>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .tc-container {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .tc-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
        }

        .tc-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .tc-table-name {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin: 0;
        }

        .tc-field-count {
          font-size: 12px;
          background: #f1f5f9;
          color: #475569;
          padding: 2px 10px;
          border-radius: 20px;
          font-weight: 600;
        }

        .tc-delete-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid #fecaca;
          border-radius: 6px;
          background: #fff;
          color: #dc2626;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tc-delete-btn:hover {
          background: #fef2f2;
        }

        .tc-content {
          padding: 24px;
        }

        .tc-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .tc-field-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tc-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tc-input {
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          color: #0f172a;
          background: #fff;
          outline: none;
          transition: all 0.2s ease;
        }

        .tc-input:focus {
          border-color: #636ae8;
          box-shadow: 0 0 0 3px rgba(99, 106, 232, 0.1);
        }

        .tc-fields-header {
          font-size: 14px;
          color: #0f172a;
          margin: 12px 0 16px;
          padding-top: 12px;
          border-top: 1px dashed #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tc-manage-btn {
          padding: 6px 12px;
          border-radius: 6px;
          background: #eef2ff;
          color: #4f46e5;
          border: 1px solid #c7d2fe;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tc-manage-btn:hover {
          background: #e0e7ff;
          border-color: #a5b4fc;
        }

        .tc-table-wrapper {
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .tc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .tc-table th,
        .tc-table td {
          border-bottom: 1px solid #e2e8f0;
          padding: 12px 16px;
          text-align: left;
          white-space: nowrap;
        }

        .tc-table th {
          background: #f8fafc;
          font-weight: 600;
          font-size: 12px;
          color: #475569;
        }

        .tc-table tr:last-child td {
          border-bottom: none;
        }

        .tc-table tr:hover td {
          background: #f8fafc;
        }

        .tc-td-name {
          min-width: 120px;
          color: #0f172a;
        }

        .tc-type-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .tc-type-text { background: #e0e7ff; color: #3730a3; }
        .tc-type-number { background: #dcfce7; color: #166534; }
        .tc-type-date { background: #fef3c7; color: #92400e; }

        .tc-cell-input {
          width: 100%;
          min-width: 120px;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          color: #0f172a;
          background: #fff;
          outline: none;
          transition: all 0.2s ease;
        }

        .tc-cell-short {
          min-width: 60px;
        }

        .tc-cell-input:focus {
          border-color: #636ae8;
        }

        .tc-delete-field-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 6px;
          transition: all 0.2s ease;
          font-weight: 700;
        }

        .tc-delete-field-btn:hover {
          background: #fef2f2;
        }

        @media (max-width: 640px) {
          .tc-row {
            grid-template-columns: 1fr;
          }
        }

        .tc-fields-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .tc-search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 240px;
        }

        .tc-search-icon {
          position: absolute;
          left: 10px;
          color: #94a3b8;
          pointer-events: none;
          display: flex;
          align-items: center;
          z-index: 10;
        }

        .tc-search-input {
          width: 100%;
          padding: 6px 30px 6px 28px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 12px;
          outline: none;
          color: #0f172a;
          background: #f8fafc;
          transition: all 0.2s ease;
        }

        .tc-search-input:focus {
          border-color: #636ae8;
          background: #fff;
          box-shadow: 0 0 0 2px rgba(99, 106, 232, 0.08);
        }

        .tc-search-clear {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          border-radius: 4px;
          transition: all 0.15s;
        }

        .tc-search-clear:hover {
          background: #f1f5f9;
          color: #475569;
        }

        .tc-td-empty {
          padding: 24px !important;
          text-align: center !important;
          color: #94a3b8;
          font-size: 13px;
          font-style: italic;
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}
