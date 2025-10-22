import { Company, License, ApiResponse } from "./license";

class ApiService {
  private getAuthHeaders(): HeadersInit {
    const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN;

    if (!token) {
      console.warn("NEXT_PUBLIC_ADMIN_TOKEN is not set");
    }

    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use default message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Company APIs - EXACTLY as per your backend
  async createCompany(company: {
    companyId: string;
    companyAuthId: string;
    companyPassword: string;
  }): Promise<ApiResponse> {
    return this.fetchWithAuth("/api/company", {
      method: "POST",
      body: JSON.stringify(company),
    });
  }

  async updateCompany(company: {
    companyId: string;
    companyAuthId?: string;
    companyPassword?: string;
  }): Promise<ApiResponse> {
    return this.fetchWithAuth("/api/company", {
      method: "POST",
      body: JSON.stringify(company),
    });
  }

  // License APIs - EXACTLY as per your backend
  async createLicense(license: {
    companyId: string;
    plan: string;
    users: string;
    workspaces: string;
    reports: string;
    charts: string;
    AI_Features: string;
    licensingTerms: string;
    support: string;
    isActive: number;
    expiryDate: string;
  }): Promise<ApiResponse> {
    return this.fetchWithAuth("/api/license", {
      method: "POST",
      body: JSON.stringify(license),
    });
  }

  async updateLicense(license: {
    licenseId: string;
    companyId: string;
    plan?: string;
    users?: string;
    workspaces?: string;
    reports?: string;
    charts?: string;
    AI_Features?: string;
    licensingTerms?: string;
    support?: string;
    isActive?: number;
    expiryDate?: string;
  }): Promise<ApiResponse> {
    return this.fetchWithAuth("/api/license", {
      method: "POST",
      body: JSON.stringify(license),
    });
  }

  // Client-facing license fetch (Basic auth) - for client applications
  async fetchLicenseClient(
    companyAuthId: string,
    password: string
  ): Promise<any> {
    const credentials = btoa(`${companyAuthId}:${password}`);

    const response = await fetch("/api/license/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use default message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Helper methods for the admin dashboard (you'll need to implement these in your backend)
  // These are NOT in your current API spec, so they're optional

  async getCompanies(): Promise<Company[]> {
    // Note: This endpoint doesn't exist in your current API spec
    // You'll need to implement it in your backend or use mock data
    console.warn("getCompanies endpoint not implemented in current API spec");
    return [];
  }

  async getLicenses(companyId: string): Promise<License[]> {
    // Note: This endpoint doesn't exist in your current API spec
    // You'll need to implement it in your backend or use mock data
    console.warn("getLicenses endpoint not implemented in current API spec");
    return [];
  }
}

export const apiService = new ApiService();
