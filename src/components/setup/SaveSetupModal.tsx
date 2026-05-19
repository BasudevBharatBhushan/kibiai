"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Save, Loader2, Database } from "lucide-react";

interface SaveSetupModalProps {
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
  isSaving: boolean;
}

export function SaveSetupModal({ onClose, onSave, isSaving }: SaveSetupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a name for this setup.");
      return;
    }
    setError(null);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save setup.");
    }
  };

  return (
    <div className="ssm-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ssm-modal">
        <div className="ssm-header">
          <div className="ssm-icon">
            <Database size={20} />
          </div>
          <div>
            <h3 className="ssm-title">Save as Reusable Setup</h3>
            <p className="ssm-subtitle">Give this configuration a name to use it in other templates.</p>
          </div>
          <button className="ssm-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="ssm-body">
          <div className="ssm-field">
            <label className="ssm-label">Setup Name</label>
            <input
              ref={inputRef}
              type="text"
              className="ssm-input"
              placeholder="e.g. Standard CRM Connection, Sales DB v2..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          <div className="ssm-field">
            <label className="ssm-label">Short Description</label>
            <textarea
              className="ssm-input ssm-textarea"
              placeholder="What does this setup include? (e.g. Sales, Contacts, and Products mapping)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            {error && <p className="ssm-error">{error}</p>}
          </div>
        </div>

        <div className="ssm-footer">
          <button className="ssm-btn-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="ssm-btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 size={16} className="ssm-spin" /> : <Save size={16} />}
            {isSaving ? "Saving..." : "Save Setup"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .ssm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        .ssm-modal {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 20px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05);
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ssm-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }

        .ssm-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #636ae8, #818cf8);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 8px 16px rgba(99, 106, 232, 0.25);
        }

        .ssm-title {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .ssm-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 4px 0 0;
          line-height: 1.4;
        }

        .ssm-close {
          margin-left: auto;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .ssm-close:hover {
          background: #f1f5f9;
          color: #475569;
        }

        .ssm-body {
          padding: 24px;
        }

        .ssm-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ssm-label {
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }

        .ssm-input {
          width: 100%;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s;
        }

        .ssm-input:focus {
          background: #fff;
          border-color: #636ae8;
          box-shadow: 0 0 0 4px rgba(99, 106, 232, 0.1);
        }

        .ssm-textarea {
          resize: none;
          min-height: 80px;
          line-height: 1.5;
        }

        .ssm-error {
          font-size: 12px;
          color: #ef4444;
          margin: 4px 0 0;
        }

        .ssm-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        .ssm-btn-cancel {
          flex: 1;
          padding: 10px;
          background: white;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ssm-btn-save {
          flex: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: linear-gradient(135deg, #636ae8, #818cf8);
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(99, 106, 232, 0.3);
          transition: all 0.2s;
        }

        .ssm-btn-save:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 106, 232, 0.4);
        }

        .ssm-spin {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
