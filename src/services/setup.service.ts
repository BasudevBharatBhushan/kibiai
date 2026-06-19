import { createAdminClient } from "@/utils/supabase/server";

export interface SetupData {
  setup_id?: string;
  company_id: string;
  module_id: string;
  setup_name: string;
  setup_description?: string | null;
  setup_json: any;
  created_by_user_id?: string | null;
}

export class SetupService {
  /**
   * List saved setups for a company, optionally filtered by module.
   */
  static async getSavedSetups(companyId: string, moduleId?: string) {
    const adminClient = createAdminClient();
    let query = adminClient
      .from("report_template_setups")
      .select(`
        setup_id, 
        setup_name, 
        setup_description,
        setup_json,
        module_id, 
        created_on, 
        updated_on,
        modules(module_name)
      `)
      .eq("company_id", companyId);

    if (moduleId) {
      query = query.eq("module_id", moduleId);
    }

    const { data, error } = await query.order("setup_name", { ascending: true });
    if (error) throw error;
    return data;
  }

  /**
   * Get a specific setup by ID.
   */
  static async getSetupById(setupId: string, companyId?: string) {
    const adminClient = createAdminClient();
    let query = adminClient
      .from("report_template_setups")
      .select("*")
      .eq("setup_id", setupId);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Create a new saved setup.
   */
  static async createSetup(data: SetupData) {
    const adminClient = createAdminClient();
    const { data: setup, error } = await adminClient
      .from("report_template_setups")
      .insert({
        company_id: data.company_id,
        module_id: data.module_id,
        setup_name: data.setup_name,
        setup_description: data.setup_description,
        setup_json: data.setup_json,
        created_by_user_id: data.created_by_user_id
      })
      .select("*")
      .single();

    if (error) throw error;
    return setup;
  }

  /**
   * Update an existing setup.
   */
  static async updateSetup(setupId: string, companyId: string, data: Partial<SetupData>) {
    const adminClient = createAdminClient();
    const { data: setup, error } = await adminClient
      .from("report_template_setups")
      .update({
        ...data,
        updated_on: new Date().toISOString()
      })
      .eq("setup_id", setupId)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) throw error;
    return setup;
  }

  /**
   * Delete a setup.
   */
  static async deleteSetup(setupId: string, companyId: string) {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("report_template_setups")
      .delete()
      .eq("setup_id", setupId)
      .eq("company_id", companyId);

    if (error) throw error;
    return true;
  }
}
