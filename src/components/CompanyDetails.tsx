"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Award,
} from "lucide-react";

interface Company {
  recordId: string;
  CompanyID: string;
  CompanyAuthID: string;
  CompanyPassword: string;
  LicenseID: string;
  CompanyName?: string;
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
  const [editedAuthId, setEditedAuthId] = useState(company.CompanyAuthID);
  const [editedPassword, setEditedPassword] = useState(company.CompanyPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  console.log("License Data:", license);

  useEffect(() => {
    setEditedAuthId(company.CompanyAuthID);
    setEditedPassword(company.CompanyPassword);
  }, [company]);

  const handleSave = async () => {
    const result = await onUpdateCompany(company.CompanyID, {
      companyAuthId: editedAuthId,
      companyPassword: editedPassword,
    });

    if (result.success) {
      setIsEditing(false);
      setError("");
    } else {
      setError(result.error || "Failed to update company");
    }
  };

  const handleCancel = () => {
    setEditedAuthId(company.CompanyAuthID);
    setEditedPassword(company.CompanyPassword);
    setIsEditing(false);
    setShowPassword(false);
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          {/* Company Name */}
          <h3 className="text-lg font-semibold text-gray-900 mb-3 md:mb-0">
            {company.CompanyName || "Unnamed Company"}
          </h3>

          {/* Company ID Box */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg shadow-sm">
            <Award className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-mono font-medium text-gray-900">
              {company.CompanyID}
            </span>
          </div>
        </div>

        {/* Grid Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {/* Company Auth Email */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Company Auth Email
            </label>
            <input
              type="text"
              value={editedAuthId}
              onChange={(e) => setEditedAuthId(e.target.value)}
              disabled={!isEditing}
              placeholder="Enter company auth email"
              className={`w-full px-4 py-2.5 border-2 rounded-lg text-sm transition-all ${
                isEditing
                  ? "border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  : "border-gray-200 bg-gradient-to-br from-gray-50 to-white text-gray-700"
              }`}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Password
            </label>
            <input
              type={
                isEditing && showPassword
                  ? "text"
                  : isEditing
                  ? "password"
                  : "text"
              }
              value={isEditing ? editedPassword : "••••••••••••"}
              onChange={(e) => setEditedPassword(e.target.value)}
              disabled={!isEditing}
              placeholder="Enter password"
              className={`w-full px-4 py-2.5 border-2 rounded-lg text-sm pr-10 transition-all ${
                isEditing
                  ? "border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  : "border-gray-200 bg-gradient-to-br from-gray-50 to-white text-gray-700"
              }`}
            />
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
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
                  companyId: company.CompanyID,
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
