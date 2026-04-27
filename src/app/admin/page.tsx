"use client";

import { useState, useEffect } from "react";
import CompanyList from "@/components/CompanyList";
import CompanyDetails from "@/components/CompanyDetails";
import LicenseInfo from "@/components/LicenseInfo";
import PaymentSection from "@/components/PaymentSection";
import Logo from "../../assets/kibiai.png";
import Image from "next/image";

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

// const PLAN_DEFAULTS: Record<string, Partial<License>> = {
//   "Free Trial": {
//     price: "0",
//     users: "1",
//     workspaces: "1",
//     reports: "3",
//     charts: "Default Charts",
//     AI_Features: "Basic only",
//     licensingTerms: "7 days, no CC needed",
//     support: "Community",
//   },
//   "Single End User": {
//     price: "49",
//     users: "1",
//     workspaces: "1",
//     reports: "5",
//     charts: "Yes",
//     AI_Features: "Full (core/AI)",
//     licensingTerms: "Monthly/Annual",
//     support: "Email",
//   },
//   Pro: {
//     price: "100",
//     users: "4",
//     workspaces: "4",
//     reports: "10",
//     charts: "Yes",
//     AI_Features: "All & Custom",
//     licensingTerms: "Annual contract",
//     support: "Priority",
//   },
//   Teams: {
//     price: "149",
//     users: "10",
//     workspaces: "5",
//     reports: "Unlimited",
//     charts: "Yes",
//     AI_Features: "Full (core/AI)",
//     licensingTerms: "Monthly/Annual",
//     support: "Priority",
//   },
//   "Custom/Enterprise": {
//     price: "299",
//     users: "Unlimited",
//     workspaces: "Unlimited",
//     reports: "Unlimited",
//     charts: "Yes",
//     AI_Features: "All & Custom",
//     licensingTerms: "Annual contract",
//     support: "Premium",
//   },
//   Private: {
//     price: "499",
//     users: "Unlimited",
//     workspaces: "Unlimited",
//     reports: "Unlimited",
//     charts: "Yes",
//     AI_Features: "All & Custom",
//     licensingTerms: "Annual contract",
//     support: "24/7",
//   },
// };
const PLAN_DEFAULTS: Record<string, Partial<License>> = {
  "FREE TRIAL": {
    price: "0",
    users: "2", // 1 Admin + 1 End User
    workspaces: "1",
    reports: "Unlimited",
    charts: "Yes",
    AI_Features: "Basic only",
    licensingTerms: "7 days Free Trial",
    support: "Email Support",
  },
  "SINGLE USER": {
    price: "19",
    users: "2", // 1 Admin + 1 End User
    workspaces: "1",
    reports: "Unlimited",
    charts: "Yes",
    AI_Features: "Full (core/AI)",
    licensingTerms: "Monthly/Annual",
    support: "Email Support",
  },
  PRO: {
    price: "79",
    users: "6", // 1 Admin + 5 End Users
    workspaces: "2",
    reports: "Unlimited",
    charts: "Yes",
    AI_Features: "All & Custom",
    licensingTerms: "Monthly/Annual",
    support: "Priority Support",
  },
  TEAMS: {
    price: "149",
    users: "12", // 2 Admin + 10 End Users
    workspaces: "5",
    reports: "Unlimited",
    charts: "Yes",
    AI_Features: "Full (core/AI)",
    licensingTerms: "Monthly/Annual",
    support: "Priority Support",
  },
  CUSTOM: {
    price: "Custom Quote",
    users: "Unlimited",
    workspaces: "Unlimited",
    reports: "Unlimited",
    charts: "Yes",
    AI_Features: "All & Custom",
    licensingTerms: "Annual Contract",
    support: "Premium Support",
  },
};

export default function AdminPage() {
  // -------------------- LOGIN HOOKS --------------------
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user.accountType === 'platform_admin') {
            setIsLoggedIn(true);
          }
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        setSessionChecked(true);
      }
    };
    checkSession();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError("");
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.user.accountType === 'platform_admin') {
          setIsLoggedIn(true);
        } else {
          await fetch("/api/auth/logout", { method: "POST" });
          setLoginError("Access denied. You are not a Platform Admin.");
        }
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (err) {
      setLoginError("An unexpected error occurred");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsLoggedIn(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // -------------------- DASHBOARD HOOKS (Always stay here to avoid hook order issues) --------------------
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);


  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/company", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error (${response.status}): ${text || response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from server (expected JSON)");
      }

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

  const fetchLicense = async (company_id: string) => {
    try {
      setLicenseLoading(true);
      const response = await fetch(`/api/license?company_id=${company_id}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch license");
      }

      const data = await response.json();
      setLicense(data.license);
    } catch (err: any) {
      console.error("License fetch error:", err);
      setLicense(null);
    } finally {
      setLicenseLoading(false);
    }
  };

  const createCompany = async (
    companyName: string,
    adminEmail: string,
    adminPassword: string
  ) => {
    try {
      setGlobalLoading(true);
      const response = await fetch("/api/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyAuthId: adminEmail,
          companyPassword: adminPassword,
          companyName,
          planCode: "FREE TRIAL",
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
    company_id: string,
    updates: Partial<Company>
  ) => {
    try {
      setGlobalLoading(true);

      const response = await fetch("/api/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_id, ...updates }),
      });

      const data = await response.json();
      if (!data.success) return { success: false, error: data.error };

      const updatedCompanies = companies.map((company) =>
        company.company_id === company_id
          ? { ...company, ...updates }
          : company
      );

      setCompanies(updatedCompanies);
      const freshCompany = updatedCompanies.find(
        (c) => c.company_id === company_id
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
        },
        body: JSON.stringify(licenseData),
      });

      const data = await response.json();

      if (data.success) {
        if (selectedCompany) {
          await fetchLicense(selectedCompany.company_id);
        }
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
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_id: licenseId,
          company_id: companyId,
          ...updates,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (selectedCompany)
          await fetchLicense(selectedCompany.company_id);
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
    if (isLoggedIn) {
      fetchCompanies();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (selectedCompany)
      fetchLicense(selectedCompany.company_id);
    else setLicense(null);
  }, [selectedCompany]);

  const handleCompanySelect = (company: Company) => setSelectedCompany(company);
  const clearError = () => setError(null);

  // -------------------- SINGLE RETURN (NO HOOK ORDER ISSUES) --------------------
  
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
      </div>
    );
  }

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
              disabled={isLoggingIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm transition disabled:opacity-50"
            >
              {isLoggingIn ? "Logging in..." : "Login"}
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
                    {!licenseLoading && license && (
                      <div className="mt-8">
                        <PaymentSection
                          company={selectedCompany}
                          license={license}
                        />
                      </div>
                    )}
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
