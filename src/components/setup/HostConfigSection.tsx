"use client";

interface HostConfigSectionProps {
  host: string;
  protocol: "data-api" | "o-data-api";
  onHostChange: (val: string) => void;
  onProtocolChange: (val: "data-api" | "o-data-api") => void;
  disabled?: boolean;
  isSql?: boolean;
  apiKey?: string;
}

export function HostConfigSection({
  host,
  protocol,
  onHostChange,
  onProtocolChange,
  disabled = false,
  isSql = false,
  apiKey = "",
}: HostConfigSectionProps) {
  return (
    <div className="hcs-section">
      <div className="hcs-db-selector">
        <div className={`hcs-db-option ${!isSql ? 'active' : ''}`} title="FileMaker">
          <img
            src="https://www.productivecomputing.com/wp-content/uploads/2024/05/Claris-Filemaker-icon-color-dark_1200.png"
            alt="FileMaker"
            className="hcs-db-logo"
          />
        </div>
        <div className={`hcs-db-option ${isSql ? 'active' : ''}`} title="SQLite">
          <img
            src="https://www.sqlite.org/images/sqlite370_banner.gif"
            alt="SQLite"
            className="hcs-db-logo"
          />
        </div>
        <div className="hcs-db-option disabled" title="Supabase (Support coming soon)">
          <img
            src="https://supabase.com/favicon/favicon-196x196.png"
            alt="Supabase"
            className="hcs-db-logo"
            style={{ borderRadius: '50%' }}
          />
        </div>
        <div className="hcs-db-option disabled" title="PostgreSQL (Support coming soon)">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg"
            alt="PostgreSQL"
            className="hcs-db-logo"
          />
        </div>
        <div className="hcs-db-option disabled" title="MongoDB (Support coming soon)">
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtQumHnpFMwppHBTkHJlIhEOkFPumg9ZAtVw&s"
            alt="MongoDB"
            className="hcs-db-logo"
          />
        </div>
      </div>

      <div className="hcs-form-row">
        <div className="hcs-form-group">
          <input
            id="setup-host"
            type="text"
            className="hcs-input"
            placeholder={isSql ? "Server URL (e.g. https://api.example.com/sqlite)" : "Host address (e.g. kibiz.smtech.cloud)"}
            value={host}
            onChange={(e) => onHostChange(e.target.value)}
            disabled={disabled}
          />
        </div>

        {isSql ? (
          <div className="hcs-form-group hcs-protocol-group">
            <input
              type="password"
              className="hcs-input"
              placeholder="API Key"
              value={apiKey}
              disabled
            />
          </div>
        ) : (
          <div className="hcs-form-group hcs-protocol-group">
            <select
              id="setup-protocol"
              className="hcs-select"
              value={protocol}
              onChange={(e) => onProtocolChange(e.target.value as "data-api" | "o-data-api")}
              disabled={disabled}
            >
              <option value="data-api">Data API</option>
              <option value="o-data-api">OData API</option>
            </select>
          </div>
        )}
      </div>

      <style jsx>{`
        .hcs-section {
          background: #fff;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          padding: 8px 16px;
          gap: 20px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .hcs-db-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          border-right: 1px solid #e2e8f0;
          padding-right: 20px;
        }

        .hcs-db-option {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          transition: all 0.2s;
        }

        .hcs-db-option.active {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .hcs-db-option.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .hcs-db-logo {
          max-width: 20px;
          max-height: 20px;
          object-fit: contain;
        }

        .hcs-form-row {
          display: flex;
          gap: 16px;
          flex: 1;
        }

        .hcs-form-group {
          flex: 1;
        }

        .hcs-protocol-group {
          flex: 0 0 160px;
        }

        .hcs-input,
        .hcs-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          color: #0f172a;
          background: #f8fafc;
          outline: none;
          transition: all 0.2s ease;
        }

        .hcs-input:focus,
        .hcs-select:focus {
          border-color: #2563eb;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        @media (max-width: 640px) {
          .hcs-section {
            flex-direction: column;
            align-items: stretch;
          }
          .hcs-db-selector {
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
            padding-right: 0;
            padding-bottom: 12px;
            margin-bottom: 4px;
          }
        }
      `}</style>
    </div>
  );
}
