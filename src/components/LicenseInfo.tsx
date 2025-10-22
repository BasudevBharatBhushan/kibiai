"use client";

import { useState } from "react";
import {
  CreditCard,
  Users,
  Building2,
  FileText,
  BarChart3,
  Sparkles,
  FileCheck,
  Headphones,
  CheckCircle2,
  XCircle,
  Calendar,
  DollarSign,
  Award,
  Zap,
} from "lucide-react";

interface License {
  licenseId?: string;
  companyId?: string;
  plan?: string;
  price?: string;
  users?: string;
  workspaces?: string;
  reports?: string;
  charts?: string;
  AI_Features?: string;
  licensingTerms?: string;
  support?: string;
  isActive?: number;
  expiryDate?: string;
}

interface Company {
  CompanyID: string;
}

interface LicenseInfoProps {
  license: License | null;
  company: Company;
  onUpdateLicense: (
    licenseId: string,
    companyId: string,
    updates: any
  ) => Promise<{ success: boolean; error?: string }>;
  loading?: boolean;
}

const PLAN_OPTIONS = [
  "Free Trial",
  "Single End User",
  "Pro",
  "Teams",
  "Custom/Enterprise",
  "Private",
];
const CHARTS_OPTIONS = ["Default Charts", "Yes"];
const AI_FEATURES_OPTIONS = ["Basic only", "Full (core/AI)", "All & Custom"];
const LICENSING_TERMS_OPTIONS = [
  "7 days, no CC needed",
  "Monthly/Annual",
  "Annual contract",
];
const SUPPORT_OPTIONS = ["Community", "Email", "Priority", "Premium", "24/7"];

export default function LicenseInfo({
  license,
  company,
  onUpdateLicense,
  loading = false,
}: LicenseInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLicense, setEditedLicense] = useState<License>({});
  const [error, setError] = useState("");

  const hasLicense = license?.licenseId;

  const handleEdit = () => {
    setEditedLicense({ ...license });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!license?.licenseId) return;

    const result = await onUpdateLicense(
      license.licenseId,
      company.CompanyID,
      editedLicense
    );

    if (result.success) {
      setIsEditing(false);
      setError("");
    } else {
      setError(result.error || "Failed to update license");
    }
  };

  const handleCancel = () => {
    setEditedLicense({});
    setIsEditing(false);
    setError("");
  };

  const getValue = (field: keyof License) => {
    return isEditing ? editedLicense[field] : license?.[field];
  };

  const updateField = (field: keyof License, value: any) => {
    setEditedLicense((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            License Information
          </h2>
        </div>
        <div className="p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-500">Loading license information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-500 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            License Information
          </h2>
          {hasLicense && license.isActive === 1 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-400/20 backdrop-blur-sm rounded-full text-white text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Active
            </span>
          )}
          {hasLicense && license.isActive === 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-red-400/20 backdrop-blur-sm rounded-full text-white text-sm font-medium">
              <XCircle className="w-4 h-4" />
              Inactive
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3 animate-in slide-in-from-top">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {!hasLicense ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 mb-6">
              <CreditCard className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No License Assigned
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              This company doesn't have an active license yet. Create a new
              license in the Company Details section to get started.
            </p>
          </div>
        ) : (
          <>
            {/* License ID Banner */}
            <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Award className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">
                    License ID
                  </p>
                  <p className="text-sm font-mono font-semibold text-gray-900">
                    {license.licenseId}
                  </p>
                </div>
              </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Plan/Tier */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg group-hover:from-blue-200 group-hover:to-blue-100 transition-colors">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  Plan/Tier
                </label>
                {isEditing ? (
                  <select
                    value={getValue("plan")}
                    onChange={(e) => updateField("plan", e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    {PLAN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-4 py-2.5 border-2 border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-white">
                    <span className="text-sm font-medium text-gray-900">
                      {getValue("plan") || "N/A"}
                    </span>
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-green-100 to-green-50 rounded-lg group-hover:from-green-200 group-hover:to-green-100 transition-colors">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                  Price (USD)
                </label>
                <input
                  type="text"
                  value={getValue("price") || ""}
                  onChange={(e) => updateField("price", e.target.value)}
                  disabled={!isEditing}
                  placeholder="Enter price"
                  className={`w-full px-4 py-2.5 border-2 rounded-lg text-sm transition-all ${
                    isEditing
                      ? "border-gray-200 text-gray-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      : "border-gray-200 bg-gradient-to-br from-gray-50 to-white text-gray-700 font-medium"
                  }`}
                />
              </div>

              {/* Users */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg group-hover:from-purple-200 group-hover:to-purple-100 transition-colors">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  Users
                </label>
                <input
                  type="text"
                  value={getValue("users") || ""}
                  onChange={(e) => updateField("users", e.target.value)}
                  disabled={!isEditing}
                  placeholder="Enter number"
                  className={`w-full px-4 py-2.5 border-2 rounded-lg text-sm transition-all ${
                    isEditing
                      ? "border-gray-200 text-gray-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      : "border-gray-200 bg-gradient-to-br from-gray-50 to-white text-gray-700 font-medium"
                  }`}
                />
              </div>

              {/* Workspaces */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg group-hover:from-orange-200 group-hover:to-orange-100 transition-colors">
                    <Building2 className="w-4 h-4 text-orange-600" />
                  </div>
                  Workspaces
                </label>
                <input
                  type="text"
                  value={getValue("workspaces") || ""}
                  onChange={(e) => updateField("workspaces", e.target.value)}
                  disabled={!isEditing}
                  placeholder="Enter number"
                  className={`w-full px-4 py-2.5 border-2 rounded-lg text-sm transition-all ${
                    isEditing
                      ? "border-gray-200 text-gray-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      : "border-gray-200 bg-gradient-to-br from-gray-50 to-white text-gray-700 font-medium"
                  }`}
                />
              </div>

              {/* Reports */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-cyan-100 to-cyan-50 rounded-lg group-hover:from-cyan-200 group-hover:to-cyan-100 transition-colors">
                    <FileText className="w-4 h-4 text-cyan-600" />
                  </div>
                  Reports
                </label>
                <input
                  type="text"
                  value={getValue("reports") || ""}
                  onChange={(e) => updateField("reports", e.target.value)}
                  disabled={!isEditing}
                  placeholder="Enter number"
                  className={`w-full px-4 py-2.5 border-2 rounded-lg text-sm transition-all ${
                    isEditing
                      ? "border-gray-200 text-gray-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      : "border-gray-200 bg-gradient-to-br from-gray-50 to-white text-gray-700 font-medium"
                  }`}
                />
              </div>

              {/* Charts */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-pink-100 to-pink-50 rounded-lg group-hover:from-pink-200 group-hover:to-pink-100 transition-colors">
                    <BarChart3 className="w-4 h-4 text-pink-600" />
                  </div>
                  Charts
                </label>
                {isEditing ? (
                  <select
                    value={getValue("charts")}
                    onChange={(e) => updateField("charts", e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    {CHARTS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-4 py-2.5 border-2 border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-white">
                    <span className="text-sm font-medium text-gray-900">
                      {getValue("charts") || "N/A"}
                    </span>
                  </div>
                )}
              </div>

              {/* AI Features */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-violet-100 to-violet-50 rounded-lg group-hover:from-violet-200 group-hover:to-violet-100 transition-colors">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                  </div>
                  AI Features
                </label>
                {isEditing ? (
                  <select
                    value={getValue("AI_Features")}
                    onChange={(e) => updateField("AI_Features", e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    {AI_FEATURES_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-4 py-2.5 border-2 border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-white">
                    <span className="text-sm font-medium text-gray-900">
                      {getValue("AI_Features") || "N/A"}
                    </span>
                  </div>
                )}
              </div>

              {/* Licensing Terms */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg group-hover:from-amber-200 group-hover:to-amber-100 transition-colors">
                    <FileCheck className="w-4 h-4 text-amber-600" />
                  </div>
                  Licensing Terms
                </label>
                {isEditing ? (
                  <select
                    value={getValue("licensingTerms")}
                    onChange={(e) =>
                      updateField("licensingTerms", e.target.value)
                    }
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    {LICENSING_TERMS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-4 py-2.5 border-2 border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-white">
                    <span className="text-sm font-medium text-gray-900">
                      {getValue("licensingTerms") || "N/A"}
                    </span>
                  </div>
                )}
              </div>

              {/* Support */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-teal-100 to-teal-50 rounded-lg group-hover:from-teal-200 group-hover:to-teal-100 transition-colors">
                    <Headphones className="w-4 h-4 text-teal-600" />
                  </div>
                  Support
                </label>
                {isEditing ? (
                  <select
                    value={getValue("support")}
                    onChange={(e) => updateField("support", e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    {SUPPORT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-4 py-2.5 border-2 border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-white">
                    <span className="text-sm font-medium text-gray-900">
                      {getValue("support") || "N/A"}
                    </span>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg group-hover:from-emerald-200 group-hover:to-emerald-100 transition-colors">
                    {getValue("isActive") === 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  Status
                </label>
                {isEditing ? (
                  <select
                    value={getValue("isActive")}
                    onChange={(e) =>
                      updateField("isActive", parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                ) : (
                  <div
                    className={`px-4 py-2.5 border-2 rounded-lg ${
                      getValue("isActive") === 1
                        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                        : "border-red-200 bg-gradient-to-br from-red-50 to-white"
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold ${
                        getValue("isActive") === 1
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {getValue("isActive") === 1 ? "Active" : "Inactive"}
                    </span>
                  </div>
                )}
              </div>

              {/* Expiry Date */}
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <div className="p-1.5 bg-gradient-to-br from-rose-100 to-rose-50 rounded-lg group-hover:from-rose-200 group-hover:to-rose-100 transition-colors">
                    <Calendar className="w-4 h-4 text-rose-600" />
                  </div>
                  Expiry Date
                </label>
                <input
                  type="text"
                  value={getValue("expiryDate") || ""}
                  onChange={(e) => updateField("expiryDate", e.target.value)}
                  disabled={!isEditing}
                  placeholder="MM/DD/YYYY"
                  className={`w-full px-4 py-2.5 border-2 rounded-lg text-sm transition-all ${
                    isEditing
                      ? "border-gray-200 text-gray-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      : "border-gray-200 bg-gradient-to-br from-gray-50 to-white text-gray-700 font-medium"
                  }`}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indi transition-all shadow-sm hover:shadow-md text-sm font-medium"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit License
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Save Changes
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
          </>
        )}
      </div>
    </div>
  );
}
