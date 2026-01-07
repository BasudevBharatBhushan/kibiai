import { ReportConfig, ReportSetup } from "@/lib/types/reportConfigTypes";
import { API_ENDPOINTS, API_HEADERS } from "@/constants/api";

class ApiError extends Error {
  constructor(public message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

// 1. Centralized Fetch Wrapper 
async function apiClient<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...API_HEADERS.DEFAULT, ...options.headers },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || data.detail || "Request failed", response.status);
    }

    return data;
  } catch (error) {
    console.error(`[API Error] ${url}:`, error);
    throw error;
  }
}

// 2. Service Methods
export const reportService = {
  getReportConfig: async (reportId: string) => {
    return apiClient<{
      fmRecordId: string;
      config: ReportConfig;
      setup: ReportSetup;
      reportStructuredData?: any;
    }>(`${API_ENDPOINTS.CONFIG}?id=${reportId}`);
  },

  saveReportConfig: async (fmRecordId: string, config: ReportConfig) => {
    return apiClient(API_ENDPOINTS.CONFIG, {
      method: "POST",
      body: JSON.stringify({ fmRecordId, config }),
    });
  },

  generatePreview: async (setup: ReportSetup, config: ReportConfig) => {
    const result = await apiClient<{
      status: string;
      report_structure_json: any;
    }>(API_ENDPOINTS.GENERATE, {
      method: "POST",
      body: JSON.stringify({ report_setup: setup, report_config: config }),
    });
    return result.report_structure_json;
  },
};