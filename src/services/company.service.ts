import { createAdminClient } from "@/utils/supabase/server";

export interface CompanyResolution {
  id: string;
  name: string;
  logo: string | null;
  status: string;
  plan: string;
  plan_name: string;
}

export class CompanyService {
  /**
   * Resolves a company by its slug.
   * Currently uses normalized company_name as slug.
   */
  static async resolveCompanyBySlug(slug: string): Promise<CompanyResolution | null> {
    if (!slug) return null;

    const adminClient = createAdminClient();
    
    // 1. Try resolving via allowed_subdomains table (source of truth for slugs)
    const { data: slugMapping, error: slugError } = await adminClient
      .from("allowed_subdomains")
      .select("company_id")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    let company = null;
    let error = slugError;

    if (slugMapping) {
      const { data: companyData, error: companyError } = await adminClient
        .from("companies")
        .select("*")
        .eq("company_id", slugMapping.company_id)
        .maybeSingle();
      
      company = companyData;
      error = companyError;
    }

    // 2. Fallback to heuristic matching (backward compatibility)
    if (!company && !error) {
      // Normalize slug to match potential company names
      const searchName = slug.replace(/-/g, " ");
      
      // Try exact match first (case-insensitive)
      const { data: exactMatch, error: exactError } = await adminClient
        .from("companies")
        .select("*")
        .ilike("company_name", searchName)
        .maybeSingle();

      company = exactMatch;
      error = exactError;

      // If still not found, try fuzzy prefix match
      if (!company && !error) {
        const { data: fuzzyMatch, error: fuzzyError } = await adminClient
          .from("companies")
          .select("*")
          .ilike("company_name", `${searchName}%`)
          .limit(1)
          .maybeSingle();
        
        company = fuzzyMatch;
        error = fuzzyError;
      }
    }

    if (error || !company) {
      return null;
    }

    // Fetch plan_name from licenses table
    const { data: license, error: licenseError } = await adminClient
      .from("licenses")
      .select("plan_name")
      .eq("company_id", company.company_id)
      .eq("is_active", true)
      .maybeSingle();

    if (licenseError) {
      console.error(`Error fetching license for company ${company.company_id}:`, licenseError);
    }

    const resolvedPlan = license?.plan_name ?? company.plan_code ?? "Free";
    
    return {
      id: company.company_id,
      name: company.company_name,
      logo: company.company_logo,
      status: company.status,
      plan: resolvedPlan,
      plan_name: resolvedPlan
    };
  }
}
