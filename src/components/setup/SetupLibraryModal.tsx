"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Database, 
  FileJson, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Settings,
  Code,
  Info,
  Layers,
  Save,
  ArrowLeft
} from "lucide-react";
import { SetupConfig } from "@/components/setup/types";
import clsx from "clsx";

interface ReusableSetup {
  setup_id: string;
  setup_name: string;
  setup_description: string | null;
  setup_json: SetupConfig;
  module_id: string;
  modules?: {
    module_name: string;
  };
  created_on: string;
  updated_on?: string;
}

interface SetupLibraryModalProps {
  companyId: string;
  onClose: () => void;
}

// ── Skeleton Loader Component ────────────────────────────────────────────────

function SetupSkeleton() {
  return (
    <div className="slm-skeleton-item">
      <div className="slm-skel-left">
        <div className="slm-skel-icon" />
        <div className="slm-skel-text-wrap">
          <div className="slm-skel-title" />
          <div className="slm-skel-subtitle" />
        </div>
      </div>
      <div className="slm-skel-right" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SetupLibraryModal({ companyId, onClose }: SetupLibraryModalProps) {
  const [setups, setSetups] = useState<ReusableSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modules, setModules] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Detail / Edit State
  const [selectedSetup, setSelectedSetup] = useState<ReusableSetup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editModuleId, setEditModuleId] = useState("");
  const [editJson, setEditJson] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    fetchSetups();
    fetchModules();
  }, []);

  const fetchSetups = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/company/setups?company_id=${companyId}`);
      const data = await res.json();
      if (data.success) {
        setSetups(data.setups);
      }
    } catch (error) {
      console.error("Failed to fetch setups", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await fetch(`/api/company/modules?company_id=${companyId}`);
      const data = await res.json();
      if (data.success) {
        setModules(data.modules);
      }
    } catch (error) {
      console.error("Failed to fetch modules", error);
    }
  };

  const filteredSetups = useMemo(() => {
    return setups.filter(s => 
      s.setup_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.setup_description || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [setups, searchQuery]);

  const handleSelectSetup = (setup: ReusableSetup) => {
    setIsCreating(false);
    setSelectedSetup(setup);
    setEditName(setup.setup_name);
    setEditDesc(setup.setup_description || "");
    setEditModuleId(setup.module_id);
    setEditJson(JSON.stringify(setup.setup_json, null, 2));
    setEditorError(null);
  };

  const handleInitCreate = () => {
    setSelectedSetup(null);
    setIsCreating(true);
    setEditName("");
    setEditDesc("");
    setEditModuleId(modules[0]?.module_id || "");
    setEditJson(JSON.stringify({
      host: "",
      data_fetching_protocol: "data-api",
      tables: {},
      relationships: []
    }, null, 2));
    setEditorError(null);
  };

  const validateJson = (text: string): SetupConfig | null => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || !parsed) throw new Error("JSON must be an object");
      if (typeof parsed.tables !== "object") throw new Error("Missing 'tables' object");
      if (!Array.isArray(parsed.relationships)) throw new Error("Missing 'relationships' array");
      return parsed;
    } catch (err: any) {
      setEditorError(err.message || "Invalid JSON format");
      return null;
    }
  };

  const handleSave = async () => {
    const config = validateJson(editJson);
    if (!config) return;

    if (!editName.trim()) {
      setEditorError("Setup name is required");
      return;
    }

    if (!editModuleId) {
      setEditorError("Module selection is required");
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    try {
      const url = selectedSetup 
        ? `/api/company/setups/${selectedSetup.setup_id}`
        : `/api/company/setups`;
      
      const method = selectedSetup ? "PUT" : "POST";
      const body = { 
        setup_name: editName, 
        setup_description: editDesc, 
        module_id: editModuleId, 
        setup_json: config,
        company_id: companyId 
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Setup ${selectedSetup ? 'updated' : 'created'} successfully` });
        fetchSetups();
        if (isCreating) {
          setIsCreating(false);
          setSelectedSetup(data.setup);
        } else if (selectedSetup) {
           setSelectedSetup(prev => prev ? { ...prev, ...body, setup_json: config } : null);
        }
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error(data.error || "Failed to save setup");
      }
    } catch (error: any) {
      setEditorError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSetup) return;
    if (!window.confirm("Are you sure you want to delete this setup? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/company/setups/${selectedSetup.setup_id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: "Setup deleted successfully" });
        setSelectedSetup(null);
        fetchSetups();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  return (
    <div className="slm-overlay">
      <div className="slm-modal">
        {/* Header */}
        <div className="slm-header">
          <div className="slm-title-wrap">
            <div className="slm-icon-main">
              <Database size={20} />
            </div>
            <div>
              <h2 className="slm-title">Setups Library</h2>
              <p className="slm-subtitle">Global configurations for your database integration</p>
            </div>
          </div>
          <button className="slm-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Split Layout */}
        <div className="slm-split">
          
          {/* ── Left Side: List ────────────────────────────────────────────── */}
          <div className="slm-sidebar">
            <div className="slm-sidebar-header">
              <div className="slm-search-wrap">
                <Search size={14} className="slm-search-icon" />
                <input 
                  type="text" 
                  placeholder="Search library..."
                  className="slm-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="slm-add-btn" onClick={handleInitCreate} title="Create New Setup">
                <Plus size={16} />
              </button>
            </div>

            <div className="slm-list-scroll">
              {loading ? (
                <div className="slm-skeletons">
                  {[...Array(6)].map((_, i) => <SetupSkeleton key={i} />)}
                </div>
              ) : filteredSetups.length === 0 ? (
                <div className="slm-list-empty">
                  <Database size={32} className="slm-dim-icon" />
                  <p>No setups found</p>
                </div>
              ) : (
                filteredSetups.map((s) => {
                  const isActive = selectedSetup?.setup_id === s.setup_id;
                  const tableCount = Object.keys(s.setup_json?.tables || {}).length;
                  
                  return (
                    <div 
                      key={s.setup_id} 
                      className={clsx("slm-list-item", isActive && "active")}
                      onClick={() => handleSelectSetup(s)}
                    >
                      <div className="slm-li-icon">
                        <Settings size={14} />
                      </div>
                      <div className="slm-li-content">
                        <div className="slm-li-name">{s.setup_name}</div>
                        <div className="slm-li-meta">
                          {s.modules?.module_name || "General"} · {tableCount} Tables
                        </div>
                      </div>
                      <ChevronRight size={14} className="slm-li-arrow" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right Side: Detail/Edit ────────────────────────────────────── */}
          <div className="slm-content">
            {message && (
              <div className={`slm-global-alert slm-alert-${message.type}`}>
                {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {message.text}
              </div>
            )}

            {!selectedSetup && !isCreating ? (
              <div className="slm-content-empty">
                <div className="slm-empty-artwork">
                  <div className="slm-art-circle pulse" />
                  <div className="slm-art-circle secondary" />
                  <Database size={48} className="slm-art-icon" />
                </div>
                <h3>Select a Setup</h3>
                <p>Pick a configuration from the list to view or edit its details, or create a new one to get started.</p>
                <button className="slm-empty-create-btn" onClick={handleInitCreate}>
                  <Plus size={16} />
                  New Reusable Setup
                </button>
              </div>
            ) : (
              <div className="slm-editor">
                {/* Editor Top Bar */}
                <div className="slm-editor-nav">
                  <div className="slm-editor-info">
                    <div className="slm-editor-badge">
                      {isCreating ? "CREATING NEW" : "EDITING SETUP"}
                    </div>
                    <div className="slm-editor-id">
                      {isCreating ? "Draft" : `#${selectedSetup?.setup_id.split("-")[0]}`}
                    </div>
                  </div>
                  <div className="slm-editor-actions">
                    {!isCreating && (
                      <button className="slm-btn-delete-text" onClick={handleDelete}>
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                    <button 
                      className="slm-btn-save" 
                      onClick={handleSave} 
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {isCreating ? "Create Setup" : "Save Changes"}
                    </button>
                  </div>
                </div>

                <div className="slm-editor-scroll">
                  {/* Basic Info Section */}
                  <div className="slm-edit-section">
                    <div className="slm-section-label">
                      <Info size={14} />
                      Basic Information
                    </div>
                    <div className="slm-edit-grid">
                      <div className="slm-field">
                        <label>Setup Name</label>
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={e => setEditName(e.target.value)}
                          placeholder="e.g. Sales Production Cluster"
                        />
                      </div>
                      <div className="slm-field">
                        <label>Target Module</label>
                        <select value={editModuleId} onChange={e => setEditModuleId(e.target.value)}>
                          {modules.map(m => (
                            <option key={m.module_id} value={m.module_id}>{m.module_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="slm-field full">
                        <label>Description</label>
                        <textarea 
                          className="slm-desc-area"
                          value={editDesc} 
                          onChange={e => setEditDesc(e.target.value)}
                          placeholder="What data does this setup provide? (e.g. Invoices, Line Items, and Customer data)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* JSON Config Section */}
                  <div className="slm-edit-section">
                    <div className="slm-section-label">
                      <Code size={14} />
                      Configuration JSON
                      <span className="slm-label-hint">Defines host, tables, and relationships</span>
                    </div>
                    
                    <div className="slm-json-container">
                      <div className="slm-json-header">
                        <div className="slm-json-stats">
                          <Layers size={12} />
                          {(() => {
                            try {
                              const p = JSON.parse(editJson);
                              return `${Object.keys(p.tables || {}).length} Tables · ${p.relationships?.length || 0} Joins`;
                            } catch { return "Invalid JSON"; }
                          })()}
                        </div>
                        <FileJson size={14} className="slm-json-type" />
                      </div>
                      <textarea 
                        className="slm-json-editor"
                        value={editJson}
                        onChange={e => setEditJson(e.target.value)}
                        spellCheck={false}
                      />
                    </div>

                    {editorError && (
                      <div className="slm-inline-error">
                        <AlertCircle size={14} />
                        {editorError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .slm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(8, 10, 15, 0.65);
          backdrop-filter: blur(12px);
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: slm-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .slm-modal {
          background: #ffffff;
          border-radius: 12px;
          width: 100%;
          max-width: 1100px;
          height: 800px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        /* Header */
        .slm-header {
          padding: 16px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          z-index: 10;
        }

        .slm-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slm-icon-main {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: #fff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
        }

        .slm-title {
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .slm-subtitle {
          font-size: 12px;
          color: #64748b;
          margin: 2px 0 0;
        }

        .slm-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #94a3b8;
          transition: all 0.2s;
          border: none;
          background: transparent;
          cursor: pointer;
        }

        .slm-close:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        /* Split Layout */
        .slm-split {
          flex: 1;
          display: flex;
          overflow: hidden;
          background: #f8fafc;
        }

        /* Sidebar */
        .slm-sidebar {
          width: 320px;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          background: #fff;
        }

        .slm-sidebar-header {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .slm-search-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slm-search-icon {
          color: #94a3b8;
          flex-shrink: 0;
        }

        .slm-search-input {
          flex: 1;
          padding: 7px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          transition: all 0.2s;
          background: #f8fafc;
        }

        .slm-search-input:focus {
          border-color: #6366f1;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
        }

        .slm-add-btn {
          width: 28px;
          height: 28px;
          background: #0f172a;
          color: #fff;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          flex-shrink: 0;
        }

        .slm-add-btn:hover {
          background: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }

        .slm-list-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .slm-list-item {
          padding: 10px 12px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 4px;
          border: 1px solid transparent;
        }

        .slm-list-item:hover {
          background: #f8fafc;
        }

        .slm-list-item.active {
          background: #eef2ff;
          border-color: #e0e7ff;
        }

        .slm-li-icon {
          width: 32px;
          height: 32px;
          background: #f1f5f9;
          color: #64748b;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .slm-list-item.active .slm-li-icon {
          background: #6366f1;
          color: #fff;
        }

        .slm-li-content {
          flex: 1;
          min-width: 0;
        }

        .slm-li-name {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .slm-li-meta {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 1px;
        }

        .slm-li-arrow {
          color: #cbd5e1;
          transition: transform 0.2s;
        }

        .slm-list-item.active .slm-li-arrow {
          color: #6366f1;
          transform: translateX(2px);
        }

        /* Content Area */
        .slm-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #fff;
          position: relative;
        }

        .slm-content-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          text-align: center;
          background: radial-gradient(circle at top, #f8fafc 0%, #fff 100%);
        }

        .slm-empty-artwork {
          position: relative;
          margin-bottom: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .slm-art-circle {
          position: absolute;
          width: 100px;
          height: 100px;
          border: 1px solid #e2e8f0;
          border-radius: 50%;
        }

        .slm-art-circle.pulse {
          animation: slm-pulse 3s infinite;
          border-color: #6366f1;
          opacity: 0.1;
        }

        .slm-art-circle.secondary {
          width: 140px;
          height: 140px;
          animation: slm-pulse 4s infinite reverse;
          opacity: 0.05;
        }

        .slm-art-icon {
          color: #cbd5e1;
          position: relative;
          z-index: 2;
        }

        .slm-content-empty h3 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 10px;
        }

        .slm-content-empty p {
          font-size: 14px;
          color: #64748b;
          max-width: 360px;
          line-height: 1.6;
          margin: 0 0 24px;
        }

        .slm-empty-create-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #6366f1;
          color: #fff;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }

        /* Editor */
        .slm-editor {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .slm-editor-nav {
          padding: 12px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
        }

        .slm-editor-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slm-editor-badge {
          background: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          letter-spacing: 0.05em;
        }

        .slm-editor-id {
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          font-family: monospace;
        }

        .slm-editor-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slm-btn-delete-text {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #ef4444;
          font-size: 13px;
          font-weight: 600;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px 12px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .slm-btn-delete-text:hover {
          background: #fef2f2;
        }

        .slm-btn-save {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 16px;
          background: #0f172a;
          color: #fff;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .slm-btn-save:hover:not(:disabled) {
          background: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .slm-btn-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .slm-editor-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 28px;
        }

        .slm-edit-section {
          margin-bottom: 32px;
        }

        .slm-section-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 800;
          color: #6366f1;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 16px;
        }

        .slm-label-hint {
          color: #94a3b8;
          font-weight: 400;
          margin-left: 8px;
          text-transform: none;
          letter-spacing: 0;
        }

        .slm-edit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .slm-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slm-field.full {
          grid-column: span 2;
        }

        .slm-field label {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }

        .slm-field input, .slm-field select, .slm-desc-area {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          transition: all 0.2s;
          background: #fff;
        }

        .slm-field input:focus, .slm-field select:focus, .slm-desc-area:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .slm-desc-area {
          min-height: 80px;
          resize: vertical;
          font-family: inherit;
        }

        /* JSON Container */
        .slm-json-container {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          background: #0f172a;
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15);
        }

        .slm-json-header {
          padding: 10px 16px;
          background: #1e293b;
          border-bottom: 1px solid #334155;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .slm-json-stats {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .slm-json-type {
          color: #6366f1;
        }

        .slm-json-editor {
          width: 100%;
          min-height: 380px;
          background: #0f172a;
          color: #94d4a4;
          font-family: 'Fira Code', 'Roboto Mono', monospace;
          font-size: 13px;
          padding: 20px;
          border: none;
          resize: vertical;
          outline: none;
          line-height: 1.6;
        }

        .slm-inline-error {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #fef2f2;
          color: #b91c1c;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid #fee2e2;
        }

        /* Global Alert */
        .slm-global-alert {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 700;
          z-index: 100;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          animation: slm-slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .slm-alert-success { background: #10b981; color: #fff; }
        .slm-alert-error { background: #ef4444; color: #fff; }

        /* Skeleton */
        .slm-skeleton-item {
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          opacity: 0.6;
        }

        .slm-skel-icon { width: 32px; height: 32px; background: #f1f5f9; border-radius: 8px; }
        .slm-skel-text-wrap { flex: 1; }
        .slm-skel-title { width: 100px; height: 10px; background: #f1f5f9; border-radius: 4px; margin-bottom: 6px; }
        .slm-skel-subtitle { width: 140px; height: 8px; background: #f1f5f9; border-radius: 4px; }
        .slm-skel-right { width: 14px; height: 14px; background: #f1f5f9; border-radius: 4px; }

        .slm-list-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: #94a3b8;
        }

        .slm-dim-icon { opacity: 0.3; margin-bottom: 12px; }

        @keyframes slm-pulse {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(1.1); opacity: 0.2; }
        }

        @keyframes slm-slide-down {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }

        @keyframes slm-fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
