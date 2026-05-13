import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";
import { z } from "zod";

// POST body schema — all fields optional for partial updates
const postBodySchema = z.object({
  config_json: z.record(z.string(), z.any()).optional(),
  conversation_id: z.string().optional(),
  bump_version: z.boolean().optional(),
  preview_data_json: z.any().optional(),
});

// ── GET /api/templates/[template_id]/config ──────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.companyId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json({ success: false, error: "template_id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("report_templates")
      .select(
        "report_template_id, report_template_name, report_template_setup_json, setup_id, report_template_config_json, report_template_data_json, conversation_id, version_number, report_template_status"
      )
      .eq("report_template_id", template_id)
      .eq("company_id", session.companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    let setupJson = data.report_template_setup_json;
    
    // If local setup is empty but we have a linked setup_id, fetch from library
    if ((!setupJson || Object.keys(setupJson).length === 0) && data.setup_id) {
      const { data: reusableSetup } = await supabase
        .from("report_template_setups")
        .select("setup_json")
        .eq("setup_id", data.setup_id)
        .maybeSingle();
      
      if (reusableSetup) {
        setupJson = reusableSetup.setup_json;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        template_id: data.report_template_id,
        template_name: data.report_template_name,
        template_status: data.report_template_status,
        setup_json: setupJson ?? null,
        config_json: data.report_template_config_json ?? null,
        preview_data_json: data.report_template_data_json ?? null,
        conversation_id: data.conversation_id ?? null,
        version_number: data.version_number ?? 1,
        has_setup: setupJson !== null && Object.keys(setupJson || {}).length > 0,
        has_config: data.report_template_config_json !== null,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/templates/[id]/config]", err);
    return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}

// ── POST /api/templates/[template_id]/config ─────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.companyId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json({ success: false, error: "template_id is required" }, { status: 400 });
    }

    // Validate body
    const body = await req.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }

    const { config_json, conversation_id, bump_version, preview_data_json } = parsed.data;

    // Verify the template belongs to this company
    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("report_templates")
      .select("report_template_id, version_number")
      .eq("report_template_id", template_id)
      .eq("company_id", session.companyId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    // Build the update payload — only include fields that were provided
    const updatePayload: Record<string, any> = {
      updated_on: new Date().toISOString(),
    };

    if (config_json !== undefined) {
      updatePayload.report_template_config_json = config_json;
    }
    if (conversation_id !== undefined) {
      updatePayload.conversation_id = conversation_id;
    }
    if (preview_data_json !== undefined) {
      updatePayload.report_template_data_json = preview_data_json;
    }
    if (bump_version) {
      updatePayload.version_number = (existing.version_number ?? 1) + 1;
    }

    const { data: updated, error: updateError } = await supabase
      .from("report_templates")
      .update(updatePayload)
      .eq("report_template_id", template_id)
      .eq("company_id", session.companyId)
      .select("version_number, updated_on")
      .single();

    if (updateError || !updated) {
      console.error("[POST /api/templates/[id]/config] update error:", updateError);
      return NextResponse.json({ success: false, error: "Failed to update template config" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        version_number: updated.version_number,
        updated_on: updated.updated_on,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/templates/[id]/config]", err);
    return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}
