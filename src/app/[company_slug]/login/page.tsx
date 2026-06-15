"use client";

import React, { useState, useEffect } from "react";
import { useCompany } from "@/components/providers/CompanyProvider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import kibiaiLogo from "@/assets/kibiai.png";
import { useAccessControl } from "@/context/AccessControlContext";

export default function CompanyLoginPage() {
  const { company, isLoading, error } = useCompany();
  const { accountId, isLoading: isAuthLoading } = useAccessControl();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const { company_slug } = useParams();

  useEffect(() => {
    if (!isAuthLoading && accountId) {
      router.replace(`/${company_slug}`);
    }
  }, [accountId, isAuthLoading, company_slug, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, companyId: company?.id }),
      });

      const data = await res.json();

      if (data.success) {
        window.location.href = `/${company_slug}`;
      } else {
        setAuthError(data.error || "Login failed");
      }
    } catch (err) {
      setAuthError("An error occurred. Please try again.");
    }
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Workspace Error</h1>
        <p className="text-gray-600">{error || "This company workspace does not exist."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          {company.logo ? (
            <img src={company.logo} alt={company.name} className="h-20 mb-4 object-contain" />
          ) : (
            <div className="h-20 w-20 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
              <span className="text-3xl font-bold text-indigo-600">{company.name[0]}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{company.name}</h1>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Workspace Login</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {authError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-center">
              {authError}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-500">Don't have an account? </span>
          <Link href={`/${company_slug}/signup`} className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
            Request Access
          </Link>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col items-center">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-widest font-bold">Powered By</p>
          <Image 
            src={kibiaiLogo} 
            alt="KiBiAI Logo" 
            className="h-8 w-auto opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
