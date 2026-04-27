"use client";

import { useState, useEffect } from "react";
import { SetupConfig } from "@/components/setup/types";
import { Code, X, Save, AlertCircle } from "lucide-react";

interface SetupJsonPreviewProps {
  config: SetupConfig;
  show: boolean;
  onToggle: () => void;
  onSave: (newConfig: SetupConfig) => void;
}

export function SetupJsonPreview({ config, show, onToggle, onSave }: SetupJsonPreviewProps) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setJsonText(JSON.stringify(config, null, 2));
      setError(null);
    }
  }, [show, config]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      // Basic validation
      if (typeof parsed !== "object" || !parsed) throw new Error("JSON must be an object");
      if (typeof parsed.tables !== "object") throw new Error("Missing 'tables' object");
      if (!Array.isArray(parsed.relationships)) throw new Error("Missing 'relationships' array");
      
      onSave(parsed);
      setError(null);
      onToggle(); // close modal
    } catch (err: any) {
      setError(err.message || "Invalid JSON format");
    }
  };

  if (!show) return null;

  return (
    <div className="sjp-overlay">
      <div className="sjp-modal">
        <div className="sjp-header">
          <div className="sjp-title">
            <Code size={16} />
            Preview Setup JSON
          </div>
          <button className="sjp-close-btn" onClick={onToggle}>
            <X size={18} />
          </button>
        </div>

        <div className="sjp-body">
          <textarea
            className="sjp-textarea"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
          {error && (
            <div className="sjp-error">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        <div className="sjp-footer">
          <button className="sjp-cancel-btn" onClick={onToggle}>
            Cancel
          </button>
          <button className="sjp-save-btn" onClick={handleSave}>
            <Save size={14} />
            Update Config
          </button>
        </div>
      </div>

      <style jsx>{`
        .sjp-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }

        .sjp-modal {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .sjp-header {
          background: #1e293b;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sjp-title {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sjp-close-btn {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .sjp-close-btn:hover {
          color: #fff;
        }

        .sjp-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
          background: #0f172a;
          gap: 12px;
          min-height: 400px;
        }

        .sjp-textarea {
          flex: 1;
          background: transparent;
          border: none;
          color: #94d4a4;
          font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
          font-size: 13px;
          line-height: 1.5;
          resize: none;
          outline: none;
          width: 100%;
        }

        .sjp-error {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #7f1d1d;
          color: #fecaca;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
        }

        .sjp-footer {
          padding: 16px 20px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .sjp-cancel-btn {
          padding: 8px 16px;
          background: #fff;
          border: 1px solid #cbd5e1;
          color: #475569;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sjp-cancel-btn:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .sjp-save-btn {
          padding: 8px 16px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .sjp-save-btn:hover {
          background: #1d4ed8;
        }
      `}</style>
    </div>
  );
}
