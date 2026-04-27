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
    
    // Normalize slug to match potential company names
    const searchName = slug.replace(/-/g, " ");
    
    // Try exact match first (case-insensitive)
    let { data: company, error } = await adminClient
      .from("companies")
      .select("*")
      .ilike("company_name", searchName)
      .maybeSingle();

    // If not found, try removing dots from the company_name in the query
    // or just match with a wildcard if the searchName is a prefix
    if (!company && !error) {
       const { data: fuzzyMatch, error: fuzzyError } = await adminClient
        .from("companies")
        .select("*")
        .ilike("company_name", `${searchName}%`)
        .limit(1)
        .maybeSingle();
       
       if (fuzzyMatch) company = fuzzyMatch;
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
