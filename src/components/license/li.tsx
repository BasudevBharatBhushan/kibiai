"use client";

import { useState } from "react";

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
}: LicenseInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLicense, setEditedLicense] = useState<License>({});
  const [error, setError] = useState("");

  // Remove the early return and handle both cases
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">License Info</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {!hasLicense ? (
        <div className="text-center py-12 text-gray-500">
          No license assigned to this company. Create a license in the Company
          Details section.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Your existing license form fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                License ID
              </label>
              <input
                type="text"
                value={license.licenseId}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-600 text-sm"
              />
            </div>

            {/* ... rest of your form fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan/Tier
              </label>
              {isEditing ? (
                <select
                  value={getValue("plan")}
                  onChange={(e) => updateField("plan", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PLAN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={getValue("plan") || "N/A"}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-600 text-sm"
                />
              )}
            </div>

            {/* ... include all other form fields */}
          </div>

          <div className="flex gap-3">
            {!isEditing ? (
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
              >
                Edit License
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
