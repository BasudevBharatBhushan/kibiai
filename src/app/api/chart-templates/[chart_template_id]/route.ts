import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { mapUiKindToTemplateType } from "@/lib/charts/supabaseAdapters";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

const patchBodySchema = z.object({
  chart_template_name: z.string().min(1).optional(),
  chart_template_type: z.string().min(1).optional(),
  chart_template_setup_json: z.record(z.string(), z.unknown()).optional(),
  chart_template_dataset_json: z.record(z.string(), z.unknown()).optional(),
  chart_template_canvas_state: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chart_template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.companyId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { chart_template_id } = await params;
    if (!chart_template_id) {
      return NextResponse.json(
        { success: false, error: "chart_template_id is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_on: new Date().toISOString(),
    };

    if (parsed.data.chart_template_name !== undefined) {
      updatePayload.chart_template_name = parsed.data.chart_template_name;
    }
    if (parsed.data.chart_template_type !== undefined) {
      updatePayload.chart_template_type = parsed.data.chart_template_type;
    }
    if (parsed.data.chart_template_setup_json !== undefined) {
      updatePayload.chart_template_setup_json =
        parsed.data.chart_template_setup_json;
    }
    if (parsed.data.chart_template_dataset_json !== undefined) {
      updatePayload.chart_template_dataset_json =
        parsed.data.chart_template_dataset_json;
    }
    if (parsed.data.chart_template_canvas_state !== undefined) {
      updatePayload.chart_template_canvas_state =
        parsed.data.chart_template_canvas_state;
      const maybeKind = parsed.data.chart_template_canvas_state.kind;
      if (
        typeof maybeKind === "string" &&
        parsed.data.chart_template_type === undefined
      ) {
        updatePayload.chart_template_type = mapUiKindToTemplateType(maybeKind);
      }
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("chart_templates")
      .update(updatePayload)
      .eq("chart_template_id", chart_template_id)
      .eq("company_id", session.companyId)
      .select(
        "chart_template_id, chart_template_name, chart_template_type, chart_template_setup_json, chart_template_dataset_json, chart_template_canvas_state"
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Failed to update chart template",
        },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error("[PATCH /api/chart-templates/[chart_template_id]]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chart_template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.companyId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { chart_template_id } = await params;
    if (!chart_template_id) {
      return NextResponse.json(
        { success: false, error: "chart_template_id is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("chart_templates")
      .delete()
      .eq("chart_template_id", chart_template_id)
      .eq("company_id", session.companyId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/chart-templates/[chart_template_id]]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
