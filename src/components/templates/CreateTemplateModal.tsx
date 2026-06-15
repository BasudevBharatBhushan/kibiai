"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, FileText, Layers, Loader2, Database } from "lucide-react";

interface Module {
  module_id: string;
  module_name: string;
  module_code: string;
}

interface CreateTemplateModalProps {
  companyId: string;
  companySlug: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateTemplateModal({
  companyId,
  companySlug,
  onClose,
  onSuccess,
}: CreateTemplateModalProps) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);

  const [templateName, setTemplateName] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedSetupId, setSelectedSetupId] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [savedSetups, setSavedSetups] = useState<any[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [setupsLoading, setSetupsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-focus name input on open
  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Fetch modules for this company
  useEffect(() => {
    const fetchModules = async () => {
      setModulesLoading(true);
      try {
        const res = await fetch(`/api/company/modules?company_id=${companyId}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const contentType = res.headers.get("content-type");
        if (!contentType?.includes("application/json")) throw new Error("Non-JSON response");
        const data = await res.json();
        if (data.success) {
          setModules(data.modules || []);
        } else {
          console.error("Failed to fetch modules:", data.error);
        }
      } catch (err: any) {
        console.error("Modules fetch error:", err);
      } finally {
        setModulesLoading(false);
      }
    };
    if (companyId) fetchModules();
  }, [companyId]);

  // Fetch saved setups when module changes
  useEffect(() => {
    const fetchSetups = async () => {
      if (!selectedModuleId) {
        setSavedSetups([]);
        return;
      }
      setSetupsLoading(true);
      try {
        const res = await fetch(`/api/company/setups?company_id=${companyId}&module_id=${selectedModuleId}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (data.success) {
          setSavedSetups(data.setups || []);
        }
      } catch (err) {
        console.error("Setups fetch error:", err);
      } finally {
        setSetupsLoading(false);
      }
    };
    fetchSetups();
  }, [companyId, selectedModuleId]);

  const handleCreate = async () => {
    setError(null);
    if (!templateName.trim()) {
      setError("Template name is required.");
      nameRef.current?.focus();
      return;
    }
    if (!selectedModuleId) {
      setError("Please select a module.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/company/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: selectedModuleId,
          report_template_name: templateName.trim(),
          company_id: companyId,
          setup_id: selectedSetupId || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = `Error ${res.status}`;
        try { msg = JSON.parse(text).error || msg; } catch {}
        throw new Error(msg);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create template");

      const templateId = data.template.report_template_id;
      
      // If onSuccess is provided (e.g. from templates list page), call it
      if (onSuccess) onSuccess();
      
      router.push(`/${companySlug}/templates/${templateId}/setup`);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setCreating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="create-template-backdrop"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="create-template-title"
    >
      <div className="create-template-modal">
        {/* Header */}
        <div className="ctm-header">
          <div className="ctm-header-left">
            <div className="ctm-icon-wrap">
              <FileText size={20} />
            </div>
            <div>
              <h2 id="create-template-title" className="ctm-title">
                Create Report Template
              </h2>
              <p className="ctm-subtitle">
                Connect a data source and build your AI-powered report
              </p>
            </div>
          </div>
          <button className="ctm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ctm-body">
          {/* Template Name */}
          <div className="ctm-field">
            <label htmlFor="ctm-template-name" className="ctm-label">
              Template Name <span className="ctm-required">*</span>
            </label>
            <input
              id="ctm-template-name"
              ref={nameRef}
              type="text"
              className={`ctm-input ${error && !templateName.trim() ? "ctm-input-error" : ""}`}
              placeholder="e.g. Monthly Sales Report, Inventory Overview..."
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              maxLength={180}
            />
          </div>

          {/* Module */}
          <div className="ctm-field">
            <label htmlFor="ctm-module" className="ctm-label">
              <Layers size={14} style={{ display: "inline", marginRight: 5 }} />
              Module <span className="ctm-required">*</span>
            </label>
            {modulesLoading ? (
              <div className="ctm-module-loading">
                <Loader2 size={15} className="ctm-spin" />
                <span>Loading modules…</span>
              </div>
            ) : modules.length === 0 ? (
              <div className="ctm-no-modules">
                No modules found. Ask your admin to create modules first.
              </div>
            ) : (
              <select
                id="ctm-module"
                className={`ctm-select ${error && !selectedModuleId ? "ctm-input-error" : ""}`}
                value={selectedModuleId}
                onChange={(e) => {
                  setSelectedModuleId(e.target.value);
                  setError(null);
                }}
              >
                <option value="">Select a module…</option>
                {modules.map((m) => (
                  <option key={m.module_id} value={m.module_id}>
                    {m.module_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Reusable Setup */}
          <div className="ctm-field">
            <label htmlFor="ctm-setup" className="ctm-label">
              <Database size={14} style={{ display: "inline", marginRight: 5 }} />
              Database Setup (Optional)
            </label>
            {setupsLoading ? (
              <div className="ctm-module-loading">
                <Loader2 size={15} className="ctm-spin" />
                <span>Loading saved setups…</span>
              </div>
            ) : !selectedModuleId ? (
              <div className="ctm-no-modules" style={{ background: "#f8fafc", color: "#64748b", borderColor: "#e2e8f0" }}>
                Select a module first to see saved setups
              </div>
            ) : savedSetups.length === 0 ? (
              <div className="ctm-no-modules" style={{ background: "#f8fafc", color: "#64748b", borderColor: "#e2e8f0" }}>
                No saved setups for this module. You can create one from scratch.
              </div>
            ) : (
              <select
                id="ctm-setup"
                className="ctm-select"
                value={selectedSetupId}
                onChange={(e) => setSelectedSetupId(e.target.value)}
              >
                <option value="">Create from scratch (Manual Setup)</option>
                {savedSetups.map((s) => (
                  <option key={s.setup_id} value={s.setup_id}>
                    {s.setup_name}
                  </option>
                ))}
              </select>
            )}
            {selectedSetupId && (
              <div className="ctm-setup-preview">
                <p className="ctm-setup-desc-text">
                  {savedSetups.find(s => s.setup_id === selectedSetupId)?.setup_description || "No description provided."}
                </p>
              </div>
            )}
            <p className="ctm-help-text">
              Reusing a saved setup will pre-configure database connections and table mappings.
            </p>
          </div>

          {/* Error */}
          {error && <div className="ctm-error">{error}</div>}
        </div>

        {/* Footer */}
        <div className="ctm-footer">
          <button className="ctm-btn-cancel" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            className="ctm-btn-create"
            onClick={handleCreate}
            disabled={creating || modulesLoading}
          >
            {creating ? (
              <>
                <Loader2 size={15} className="ctm-spin" />
                Creating…
              </>
            ) : (
              "Create & Configure →"
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .create-template-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(6px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: ctm-fade-in 0.15s ease;
        }

        @keyframes ctm-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .create-template-modal {
          background: #fff;
          border-radius: 16px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 25px 60px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(0,0,0,0.05);
          animation: ctm-slide-up 0.2s ease;
          overflow: hidden;
        }

        @keyframes ctm-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ctm-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 24px 24px 0;
        }

        .ctm-header-left {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .ctm-icon-wrap {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #636ae8, #818cf8);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(99, 106, 232, 0.35);
        }

        .ctm-title {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 3px;
        }

        .ctm-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .ctm-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          border-radius: 8px;
          padding: 6px;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }

        .ctm-close:hover {
          background: #f1f5f9;
          color: #475569;
        }

        .ctm-body {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .ctm-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .ctm-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          display: flex;
          align-items: center;
        }

        .ctm-required {
          color: #ef4444;
          margin-left: 3px;
        }

        .ctm-input,
        .ctm-select {
          width: 100%;
          padding: 10px 13px;
          border: 1.5px solid #e2e8f0;
          border-radius: 9px;
          font-size: 14px;
          color: #0f172a;
          background: #fff;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .ctm-input:focus,
        .ctm-select:focus {
          border-color: #636ae8;
          box-shadow: 0 0 0 3px rgba(99, 106, 232, 0.12);
        }

        .ctm-input-error {
          border-color: #fca5a5 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
        }

        .ctm-input::placeholder {
          color: #94a3b8;
        }

        .ctm-module-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #64748b;
          padding: 10px 0;
        }

        .ctm-no-modules {
          font-size: 13px;
          color: #ef4444;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 10px 13px;
        }

        .ctm-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 10px 13px;
          font-size: 13px;
          color: #b91c1c;
        }

        .ctm-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px;
          background: #f8fafc;
          border-top: 1px solid #e9ecef;
        }

        .ctm-btn-cancel {
          padding: 9px 18px;
          border: 1.5px solid #e2e8f0;
          border-radius: 9px;
          background: #fff;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ctm-btn-cancel:hover:not(:disabled) {
          border-color: #cbd5e1;
          color: #475569;
        }

        .ctm-btn-create {
          padding: 9px 20px;
          background: linear-gradient(135deg, #636ae8, #818cf8);
          color: #fff;
          border: none;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          box-shadow: 0 4px 12px rgba(99, 106, 232, 0.3);
          transition: all 0.2s;
        }

        .ctm-btn-create:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5, #636ae8);
          box-shadow: 0 6px 18px rgba(99, 106, 232, 0.4);
          transform: translateY(-1px);
        }

        .ctm-btn-create:disabled,
        .ctm-btn-cancel:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .ctm-spin {
          animation: ctm-spin 0.8s linear infinite;
        }

        .ctm-help-text {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
          padding-left: 2px;
        }

        @keyframes ctm-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .ctm-setup-preview {
          margin-top: 4px;
          padding: 8px 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .ctm-setup-desc-text {
          font-size: 12px;
          color: #475569;
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
