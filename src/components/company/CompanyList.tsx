"use client";

import { useState } from "react";
import {
  Building2,
  PlusCircle,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface Company {
  recordId: string;
  CompanyID: string;
  CompanyAuthID: string;
  CompanyPassword: string;
  LicenseID: string;
  CompanyName?: string;
}

interface CompanyListProps {
  companies: Company[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  onCreateCompany: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
}

export default function CompanyList({
  companies,
  selectedCompany,
  onSelectCompany,
  onCreateCompany,
  loading,
}: CompanyListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddCompany = async () => {
    if (!newCompanyName.trim() || !newPassword.trim()) {
      setError("Company name and password are required");
      return;
    }

    setSubmitting(true);
    const result = await onCreateCompany(
      newCompanyName,
      newCompanyEmail,
      newPassword
    );
    setSubmitting(false);

    if (result.success) {
      setIsAdding(false);
      setNewCompanyName("");
      setNewCompanyEmail("");
      setNewPassword("");
      setError("");
    } else {
      setError(result.error || "Failed to create company");
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewCompanyName("");
    setNewCompanyEmail("");
    setNewPassword("");
    setError("");
  };

  return (
    <div className="bg-white h-full rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
      {/* Sticky Slim Gradient Header */}
      <div className="bg-indigo-500 px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Company Directory
        </h2>

        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-md backdrop-blur-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {/* Body scroll area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Add Form */}
        {isAdding && (
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
            <h3 className="text-sm font-semibold text-indigo-700 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-indigo-600" />
              New Company Details
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-md text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Company Email
                </label>
                <input
                  type="email"
                  value={newCompanyEmail}
                  onChange={(e) => setNewCompanyEmail(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-md text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-md text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 placeholder-gray-500"
                />
              </div>

              {error && (
                <div className="p-2 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                  <span className="text-xs text-red-700">{error}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                <button
                  onClick={handleAddCompany}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm rounded-md hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {submitting ? "Creating..." : "Save"}
                </button>

                <button
                  onClick={handleCancel}
                  className="border border-gray-200 flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Company List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 flex flex-col items-center">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
            Loading companies...
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No companies yet. Click &quot;Add&quot; to create one.
          </div>
        ) : (
          companies.map((company) => (
            <button
              key={company.recordId}
              onClick={() => onSelectCompany(company)}
              className={`w-full text-left p-3 border rounded-md transition-all ${
                selectedCompany?.recordId === company.recordId
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-gray-900 truncate">
                <Building2 className="w-4 h-4 text-indigo-600" />
                {company.CompanyName || "Unnamed Company"}
              </p>
              <p className="text-xs text-gray-600 truncate mt-0.5">
                {company.CompanyAuthID || company.CompanyID}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
