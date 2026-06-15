import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { mapUiKindToTemplateType } from "@/lib/charts/supabaseAdapters";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

const layoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  i: z.string().optional(),
});

const subCardLayoutSchema = z.object({
  id: z.string(),
  layout: layoutSchema.optional(),
});

const chartStateSchema = z.object({
  id: z.string().min(1),
  kind: z.string().optional(),
  isActive: z.boolean().optional(),
  layout: layoutSchema.optional(),
  subCardLayouts: z.array(subCardLayoutSchema).optional(),
});

const patchBodySchema = z.object({
  layoutMode: z.string().optional(),
  charts: z.array(chartStateSchema),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.companyId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json(
        { success: false, error: "template_id is required" },
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

    const supabase = createAdminClient();
    const { data: existingCharts, error: fetchError } = await supabase
      .from("chart_templates")
      .select(
        "chart_template_id, chart_template_type, chart_template_canvas_state"
      )
      .eq("report_template_id", template_id)
      .eq("company_id", session.companyId);

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    const updatesById = new Map(
      parsed.data.charts.map((chart) => [chart.id, chart])
    );

    await Promise.all(
      (existingCharts ?? []).map(async (chart) => {
        const next = updatesById.get(chart.chart_template_id);
        const currentCanvas =
          (chart.chart_template_canvas_state as Record<string, unknown> | null) ?? {};

        if (!next && parsed.data.charts.length > 0) {
          return;
        }

        const mergedCanvasState = {
          ...currentCanvas,
          id: chart.chart_template_id,
          layoutMode: parsed.data.layoutMode ?? currentCanvas.layoutMode ?? "grid",
          kind: next?.kind ?? currentCanvas.kind,
          isActive:
            next?.isActive ??
            (parsed.data.charts.length === 0 ? false : currentCanvas.isActive ?? true),
          layout: next?.layout
            ? { ...next.layout, i: chart.chart_template_id }
            : currentCanvas.layout,
          // Store per-sub-card layouts so insight sub-cards can be individually positioned
          subCardLayouts: next?.subCardLayouts ?? currentCanvas.subCardLayouts ?? undefined,
        };

        const nextType =
          typeof mergedCanvasState.kind === "string"
            ? mapUiKindToTemplateType(mergedCanvasState.kind)
            : chart.chart_template_type;

        const { error: updateError } = await supabase
          .from("chart_templates")
          .update({
            chart_template_canvas_state: mergedCanvasState,
            chart_template_type: nextType,
            chart_template_status: mergedCanvasState.isActive === false ? "Inactive" : "Draft",
            updated_on: new Date().toISOString(),
          })
          .eq("chart_template_id", chart.chart_template_id)
          .eq("company_id", session.companyId);

        if (updateError) {
          throw updateError;
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: { updated_count: existingCharts?.length ?? 0 },
    });
  } catch (err: unknown) {
    console.error(
      "[PATCH /api/report-templates/[template_id]/charts/canvas-batch]",
      err
    );
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
