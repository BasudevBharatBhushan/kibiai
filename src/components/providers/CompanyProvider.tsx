"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Role {
  role_id: string;
  role_name: string;
  is_super_admin: boolean;
}

interface Company {
  id: string;
  name: string;
  logo: string | null;
  status: string;
  plan: string;
  plan_name: string;
}

interface CompanyContextType {
  company: Company | null;
  roles: Role[];
  isLoading: boolean;
  error: string | null;
  fetchRoles: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const slug = params?.company_slug as string;
  
  const [company, setCompany] = useState<Company | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = async (companyId?: string) => {
    const id = companyId || company?.id;
    if (!id) return;

    try {
      const res = await fetch(`/api/company/roles?companyId=${id}`);
      const data = await res.json();
      if (data.success) {
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error("Failed to fetch roles", err);
    }
  };

  useEffect(() => {
    if (!slug) return;

    const fetchCompany = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/company/resolve/${slug}?v=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
          setCompany(data.company);
          if (data.company.status !== "Active") {
            setError("This company workspace is currently inactive.");
          } else {
            // Pass the ID directly since state update is async
            fetchRoles(data.company.id);
          }
        } else {
          setError(data.error || "Failed to load company workspace.");
        }
      } catch (err) {
        setError("An unexpected error occurred while loading the workspace.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompany();
  }, [slug]);

  return (
    <CompanyContext.Provider value={{ company, roles, isLoading, error, fetchRoles }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}

