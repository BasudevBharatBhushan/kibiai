"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Award,
  Users,
  Link,
  Copy,
  ExternalLink,
  Upload,
  Loader2
} from "lucide-react";

interface Company {
  company_id: string;
  company_name: string;
  plan_code: string;
  status: string;
  license_key?: string;
  company_logo?: string;
  company_address?: string;
  created_on: string;
  superadmins: { userId: string; email: string; fullName: string }[];
}

interface License {
  licenseId?: string;
  isActive?: number;
}

interface CompanyDetailsProps {
  company: Company;
  license: License | null;
  licenseDefaults?: Record<string, Partial<License>>;
  onUpdateCompany: (
    companyId: string,
    updates: any
  ) => Promise<{ success: boolean; error?: string }>;
  onCreateLicense: (
    licenseData: any
  ) => Promise<{ success: boolean; error?: string }>;
}

export default function CompanyDetails({
  company,
  license,
  licenseDefaults = {},
  onUpdateCompany,
  onCreateLicense,
}: CompanyDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")  // remove special chars (matches server-side toSlug)
      .replace(/\s+/g, "-")           // spaces → hyphens
      .replace(/-+/g, "-")            // collapse multiple hyphens
      .replace(/^-|-$/g, "");         // trim leading/trailing hyphens
  };

  const companySlug = slugify(company.company_name);

  /**
   * In production: use subdomain URL → https://slug.domain.com/login
   * In dev/localhost: use path URL   → http://localhost:3000/slug/login
   */
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "";
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.startsWith("192.168."));

  const workspaceUrl = isLocalhost
    ? `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/${companySlug}/login`
    : `https://${companySlug}.${baseDomain}/login`;

  // Also provide the raw subdomain URL for display (without /login path)
  const subdomainUrl = isLocalhost
    ? null
    : `https://${companySlug}.${baseDomain}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(workspaceUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleOpenWorkspace = () => {
    window.open(workspaceUrl, "_blank");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be less than 2MB");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", company.company_id);

      const res = await fetch("/api/company/logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        // Update local state if needed or trigger refresh
        // For now, we rely on the parent component to refresh via onUpdateCompany if we were using that,
        // but since we updated the DB directly in the API, we might need a refresh or manual update.
        window.location.reload(); 
      } else {
        setError(data.error || "Failed to upload logo");
      }
    } catch (err) {
      setError("An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    // Reset state when company changes
  }, [company]);

  const handleSave = async () => {
    // Other updates would go here
    setIsEditing(false);
    setError("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError("");
  };

  const getStatusBadge = () => {
    if (!license?.licenseId)
      return "bg-gray-300 text-gray-700 border border-gray-400";
    return license.isActive === 1
      ? "bg-green-600 text-white"
      : "bg-red-600 text-white";
  };

  const getStatusText = () => {
    if (!license?.licenseId) return "No License";
    return license.isActive === 1 ? "Active" : "Inactive";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      {/* HEADER */}
      <div className=" bg-indigo-500 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Company Info
        </h2>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge()}`}
        >
          {getStatusText()}
        </span>
      </div>

      {/* BODY */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Name + ID Row */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 gap-6">
          <div className="flex-1 flex gap-6">
            {/* Logo Preview/Upload */}
            <div className="relative group">
              <div className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-300">
                {company.company_logo ? (
                  <img 
                    src={company.company_logo} 
                    alt={company.company_name} 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-10 h-10 text-gray-300" />
                )}
                
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                  </div>
                )}
              </div>
              
              <label className="absolute -bottom-2 -right-2 p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg cursor-pointer hover:bg-indigo-700 transition-all opacity-0 group-hover:opacity-100">
                <Upload className="w-4 h-4" />
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploading}
                />
              </label>
            </div>

            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {company.company_name || "Unnamed Company"}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Award className="w-4 h-4 text-indigo-500" />
                <span className="font-mono">{company.company_id}</span>
              </div>
            </div>
          </div>

          {/* Workspace Login Section */}
          <div className="w-full md:w-auto p-4 bg-indigo-50 border border-indigo-100 rounded-xl min-w-[260px]">
            <div className="flex items-center gap-2 mb-3">
              <Link className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Workspace URL
              </h4>
              {!isLocalhost && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                  Production
                </span>
              )}
            </div>

            {/* Subdomain URL display (production only) */}
            {subdomainUrl && (
              <div className="flex items-center gap-1.5 bg-indigo-100/60 px-2.5 py-1.5 rounded-md mb-2">
                <span className="text-[10px] text-indigo-400 font-mono shrink-0">https://</span>
                <code className="text-xs text-indigo-700 font-bold font-mono truncate">
                  {companySlug}.{baseDomain}
                </code>
              </div>
            )}

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-indigo-100 mb-3">
              <code className="text-xs text-indigo-600 font-mono flex-1 truncate max-w-[220px]">
                {workspaceUrl}
              </code>
              <button
                id="btn-copy-workspace-url"
                onClick={handleCopyUrl}
                className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-md transition-colors"
                title="Copy workspace URL"
              >
                {copySuccess ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              id="btn-open-workspace"
              onClick={handleOpenWorkspace}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Workspace
            </button>
          </div>
        </div>

        {/* Superadmins Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Company Superadmins
            </h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {company.superadmins && company.superadmins.length > 0 ? (
              company.superadmins.map((admin) => (
                <div 
                  key={admin.userId}
                  className="flex flex-col p-3 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg shadow-sm hover:border-indigo-200 transition-colors"
                >
                  <span className="text-xs font-bold text-gray-900 truncate">
                    {admin.fullName || "Unnamed Admin"}
                  </span>
                  <span className="text-xs text-gray-500 truncate">
                    {admin.email}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-4 text-center border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500 italic">No superadmins found</p>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3">
          {!(license && license.licenseId) && (
            <button
              onClick={() => {
                const freeTrialDefaults = licenseDefaults["Free Trial"] || {};
                const expiryDate = new Date(
                  Date.now() + 7 * 24 * 60 * 60 * 1000
                ).toLocaleDateString("en-US"); // +7 days

                onCreateLicense({
                  companyId: company.company_id,
                  plan: "Free Trial",
                  isActive: 1,
                  expiryDate,
                  ...freeTrialDefaults, // pull from props
                });
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r bg-indigo-600 hover:bg-indigo-700  text-white rounded-lg transition-all text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4" />
              New License
            </button>
          )}

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-medium"
            >
              Edit Company Info
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm font-medium"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
