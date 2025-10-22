export interface Company {
  companyId: string;
  companyName?: string;
  companyAuthId: string;
  companyPassword: string;
  recordId?: string;
}

export interface License {
  licenseId: string;
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
  price?: string;
  recordId?: string;
  scope?: any; // As per your API response
}

export interface ApiResponse {
  success: boolean;
  error?: string;
  action?: string;
  companyId?: string;
  licenseId?: string;
  recordId?: string;
  scope?: any;
}

// Constants from your pricing table
export const PLANS = [
  "Free Trial",
  "Single End User",
  "Pro Dev 1",
  "Teams Dev 2",
  "Custom/Enterprise",
  "Private",
] as const;

export const LICENSING_TERMS = ["Monthly", "Annual"] as const;
export const SUPPORT_LEVELS = [
  "Community",
  "Email",
  "Priority",
  "Premium",
  "24/7",
] as const;
export const AI_FEATURES = [
  "Basic only",
  "Full (core/AI)",
  "All & Custom",
  "All",
] as const;

// Pricing data from your table
export const PLAN_PRICES = {
  "Free Trial": "$0",
  "Single End User": "$19",
  "Pro Dev 1": "$79/mo",
  "Teams Dev 2": "$149/Mo",
  "Custom/Enterprise": "Quote",
  Private: "Quote",
} as const;

export const PLAN_USERS = {
  "Free Trial": "1",
  "Single End User": "1",
  "Pro Dev 1": "Up to 5",
  "Teams Dev 2": "10",
  "Custom/Enterprise": "Unlimited",
  Private: "Unlimited",
} as const;

export const PLAN_WORKSPACES = {
  "Free Trial": "1",
  "Single End User": "1",
  "Pro Dev 1": "1",
  "Teams Dev 2": "5",
  "Custom/Enterprise": "Unlimited",
  Private: "Unlimited",
} as const;
