"use client";

import { useState, useEffect } from "react";
import CompanyList from "@/components/CompanyList";
import CompanyDetails from "@/components/CompanyDetails";
import LicenseInfo from "@/components/LicenseInfo";
import Logo from "../../assets/kibiai.png";
import Image from "next/image";

// -------------------- STATIC LOGIN DATA --------------------
const STATIC_ADMIN_EMAIL = "priya@kibizsystems.com";
const STATIC_ADMIN_PASSWORD = "kibiz";

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

const PLAN_DEFAULTS: Record<string, Partial<License>> = {
  "Free Trial": {
    price: "0",
    users: "1",
    workspaces: "1",
    reports: "3",
    charts: "Default Charts",
    AI_Features: "Basic only",
    licensingTerms: "7 days, no CC needed",
    support: "Community",
  },
  "Single End User": {
    price: "49",
    users: "1",
    workspaces: "1",
    reports: "5",
    charts: "Yes",
    AI_Features: "Full (core/AI)",
    licensingTerms: "Monthly/Annual",
    support: "Email",
  },
  Pro: {
    price: "100",
    users: "4",
    workspaces: "4",
    reports: "10",
    charts: "Yes",
    AI_Features: "All & Custom",
    licensingTerms: "Annual contract",
    support: "Priority",
  },
  Teams: {
    price: "149",
    users: "10",
    workspaces: "5",
    reports: "Unlimited",
    charts: "Yes",
    AI_Features: "Full (core/AI)",
    licensingTerms: "Monthly/Annual",
    support: "Priority",
  },
  "Custom/Enterprise": {
    price: "299",
    users: "Unlimited",
    workspaces: "Unlimited",
    reports: "Unlimited",
    charts: "Yes",
    AI_Features: "All & Custom",
    licensingTerms: "Annual contract",
    support: "Premium",
  },
  Private: {
    price: "499",
    users: "Unlimited",
    workspaces: "Unlimited",
    reports: "Unlimited",
    charts: "Yes",
    AI_Features: "All & Custom",
    licensingTerms: "Annual contract",
    support: "24/7",
  },
};

export default function AdminPage() {
  // -------------------- LOGIN HOOKS --------------------
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleLogin = () => {
    // TODO: Replace with API login later
    if (email === STATIC_ADMIN_EMAIL && password === STATIC_ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("Invalid credentials");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
  };

  // -------------------- DASHBOARD HOOKS (Always stay here to avoid hook order issues) --------------------
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/company", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setCompanies(data.companies);
        if (data.companies.length > 0 && !selectedCompany) {
          setSelectedCompany(data.companies[0]);
        }
      } else {
        setError(data.error || "Failed to fetch companies");
      }
    } catch (err) {
      setError("Network error while fetching companies");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLicense = async (companyAuthId: string, password: string) => {
    try {
      setLicenseLoading(true);
      const credentials = btoa(`${companyAuthId}:${password}`);
      const response = await fetch("/api/license/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        setLicense(data.license);
      } else {
        setLicense(null);
      }
    } catch (err) {
      console.error("Error fetching license:", err);
      setLicense(null);
    } finally {
      setLicenseLoading(false);
    }
  };

  const createCompany = async (
    companyName: string,
    companyEmail: string,
    password: string
  ) => {
    try {
      setGlobalLoading(true);
      const companyId = `COMP-${Date.now()}`;
      const companyAuthId = companyEmail;
      const response = await fetch("/api/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          companyId,
          companyAuthId,
          companyPassword: password,
          companyName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchCompanies();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: "Network error" };
    } finally {
      setGlobalLoading(false);
    }
  };

  const updateCompany = async (
    companyId: string,
    updates: Partial<Company>
  ) => {
    try {
      setGlobalLoading(true);

      const normalizedUpdates: Partial<Company> = {};
      if ("companyAuthId" in updates)
        normalizedUpdates.CompanyAuthID = updates.companyAuthId as string;
      if ("companyPassword" in updates)
        normalizedUpdates.CompanyPassword = updates.companyPassword as string;
      if ("companyName" in updates)
        normalizedUpdates.CompanyName = updates.companyName as string;

      const payload = { companyId, ...updates };
      const response = await fetch("/api/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) return { success: false, error: data.error };

      const updatedCompanies = companies.map((company) =>
        company.CompanyID === companyId
          ? { ...company, ...normalizedUpdates }
          : company
      );

      setCompanies(updatedCompanies);
      const freshCompany = updatedCompanies.find(
        (c) => c.CompanyID === companyId
      );
      if (freshCompany) setSelectedCompany(freshCompany);

      return { success: true };
    } catch {
      return { success: false, error: "Network error" };
    } finally {
      setGlobalLoading(false);
    }
  };

  const createLicense = async (licenseData: any) => {
    try {
      setGlobalLoading(true);
      const response = await fetch("/api/license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify(licenseData),
      });

      const data = await response.json();

      if (data.success) {
        if (selectedCompany) {
          await fetchLicense(
            selectedCompany.CompanyAuthID,
            selectedCompany.CompanyPassword
          );
        }
        await fetchCompanies();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: "Network error" };
    } finally {
      setGlobalLoading(false);
    }
  };

  const updateLicense = async (
    licenseId: string,
    companyId: string,
    updates: any
  ) => {
    try {
      setGlobalLoading(true);
      const response = await fetch("/api/license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          licenseId,
          companyId,
          ...updates,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (license) setLicense({ ...license, ...updates });
        if (selectedCompany)
          await fetchLicense(
            selectedCompany.CompanyAuthID,
            selectedCompany.CompanyPassword
          );
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch {
      return { success: false, error: "Network error" };
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany)
      fetchLicense(
        selectedCompany.CompanyAuthID,
        selectedCompany.CompanyPassword
      );
    else setLicense(null);
  }, [selectedCompany]);

  const handleCompanySelect = (company: Company) => setSelectedCompany(company);
  const clearError = () => setError(null);

  // -------------------- SINGLE RETURN (NO HOOK ORDER ISSUES) --------------------
  return (
    <>
      {/* LOGIN UI */}
      {!isLoggedIn && (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm text-center">
            <Image
              src={Logo}
              alt="KiBiAI Logo"
              width={80}
              height={80}
              className="mx-auto mb-4"
            />
            <h2 className="text-xl font-semibold mb-6 text-gray-800">
              KiBiAI Admin Login
            </h2>

            <input
              type="text"
              placeholder="Email"
              className="w-full mb-3 px-3 py-2 border rounded text-sm text-black placeholder-gray-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full mb-4 px-3 py-2 border rounded text-sm text-black placeholder-gray-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {loginError && (
              <p className="text-red-500 text-xs mb-3">{loginError}</p>
            )}

            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm transition"
            >
              Login
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD UI */}
      {isLoggedIn && (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <header className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Image
                    src={Logo}
                    alt="KiBiAI Logo"
                    width={60}
                    height={60}
                    className="w-auto h-auto"
                  />
                  <div className="border-l border-gray-300 pl-4">
                    <h1 className="text-2xl font-bold text-gray-900">
                      KiBiAI Admin
                    </h1>
                    <p className="text-sm text-gray-500">
                      Company & License Management
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">
                      Kibizsystems
                    </p>
                    <p className="text-xs text-gray-500">
                      {companies.length} Companies
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                    A
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          {globalLoading && (
            <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-right">
              <div className="bg-white rounded-lg shadow-xl border border-blue-200 px-5 py-3 flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                <span className="text-sm font-medium text-gray-700">
                  Processing...
                </span>
              </div>
            </div>
          )}

          <main className="max-w-7xl mx-auto px-6 py-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm flex justify-between items-center animate-in slide-in-from-top">
                <span className="text-sm font-medium text-red-800">
                  {error}
                </span>
                <button
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-3">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <CompanyList
                    companies={companies}
                    selectedCompany={selectedCompany}
                    onSelectCompany={setSelectedCompany}
                    onCreateCompany={createCompany}
                    loading={loading}
                  />
                </div>
              </div>

              <div className="col-span-9 space-y-6">
                {selectedCompany ? (
                  <>
                    <CompanyDetails
                      company={selectedCompany}
                      license={license}
                      onUpdateCompany={updateCompany}
                      onCreateLicense={createLicense}
                      licenseDefaults={PLAN_DEFAULTS}
                    />

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <LicenseInfo
                        license={license}
                        company={selectedCompany}
                        onUpdateLicense={updateLicense}
                        loading={licenseLoading}
                        licenseDefaults={PLAN_DEFAULTS}
                      />
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
                    <p className="text-gray-500 text-sm">
                      Select a company to view details
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>

          <footer className="mt-12 pb-8">
            <div className="max-w-7xl mx-auto px-6">
              <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
                <p>© 2025 KiBiAI. All rights reserved. Admin Dashboard v1.0</p>
              </div>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}
