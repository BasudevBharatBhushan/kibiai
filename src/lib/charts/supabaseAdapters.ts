import type { ChartKind, ReportChartSchema } from "@/lib/charts/ChartTypes";

type ChartTemplateRow = {
  chart_template_id: string;
  chart_template_name: string | null;
  chart_template_type: string | null;
  chart_template_setup_json: Record<string, unknown> | null;
  chart_template_dataset_json: Record<string, unknown> | null;
  chart_template_canvas_state: Record<string, unknown> | null;
};

export type NormalizedCanvasItem = {
  id: string;
  layout?: {
    x: number;
    y: number;
    w: number;
    h: number;
    i: string;
  };
  kind?: ChartKind;
  isActive?: boolean;
};

export type NormalizedDashboardPayload = {
  schemas: ReportChartSchema[];
  canvasState: NormalizedCanvasItem[];
  layoutMode: string;
};

function isCanvasLayout(
  value: unknown
): value is NonNullable<NormalizedCanvasItem["layout"]> {
  if (!value || typeof value !== "object") return false;

  const maybeLayout = value as Record<string, unknown>;
  return (
    typeof maybeLayout.x === "number" &&
    typeof maybeLayout.y === "number" &&
    typeof maybeLayout.w === "number" &&
    typeof maybeLayout.h === "number" &&
    typeof maybeLayout.i === "string"
  );
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

export function extractBodyRows(data: unknown): Array<Record<string, unknown>> {
  if (!data) return [];

  if (
    Array.isArray(data) &&
    data.length > 0 &&
    !data.some((item) => item?.Body || item?.TitleHeader)
  ) {
    return data;
  }

  const bodyRows: Array<Record<string, unknown>> = [];

  const search = (value: unknown) => {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach(search);
      return;
    }

    const maybeBody = value as {
      Body?: { BodyField?: Array<Record<string, unknown>> };
    };

    if (Array.isArray(maybeBody.Body?.BodyField)) {
      bodyRows.push(...maybeBody.Body.BodyField);
    }

    Object.values(value).forEach(search);
  };

  search(data);
  return bodyRows;
}

export function extractFieldNamesFromReportData(data: unknown): string[] {
  const rows = extractBodyRows(data);
  const keys = new Set<string>();

  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    Object.keys(row).forEach((key) => keys.add(key));
  });

  return Array.from(keys).filter(Boolean);
}

export function mapAiChartTypeToUiKind(chartType?: string | null): ChartKind {
  const normalized = String(chartType || "").trim().toLowerCase();

  switch (normalized) {
    case "bar":
    case "column":
      return "column";
    case "doughnut":
    case "donut":
      return "donut";
    case "pie":
      return "pie";
    case "line":
      return "line";
    case "area":
      return "area";
    case "insight":
      return "insight";
    default:
      return "column";
  }
}

export function mapUiKindToTemplateType(kind?: string | null): string {
  const normalized = String(kind || "").trim().toLowerCase();

  switch (normalized) {
    case "column":
    case "bar":
      return "Bar";
    case "donut":
    case "doughnut":
      return "Donut";
    case "pie":
      return "Pie";
    case "line":
      return "Line";
    case "area":
      return "Area";
    case "insight":
      return "Insight";
    default:
      return "Bar";
  }
}

function mapTemplateTypeToAiChartType(type?: string | null): string {
  const normalized = String(type || "").trim().toLowerCase();

  switch (normalized) {
    case "bar":
    case "column":
      return "bar";
    case "donut":
    case "doughnut":
      return "doughnut";
    case "pie":
      return "pie";
    case "line":
      return "line";
    case "area":
      return "area";
    case "insight":
      return "insight";
    default:
      return "bar";
  }
}

export function normalizeChartTemplates(
  rows: ChartTemplateRow[] | null | undefined
): NormalizedDashboardPayload {
  const chartRows = rows ?? [];
  let layoutMode = "grid";

  const canvasState: NormalizedCanvasItem[] = [];
  const schemas: ReportChartSchema[] = chartRows.map((row) => {
    const setupJson = (row.chart_template_setup_json ?? {}) as Partial<ReportChartSchema>;
    const canvasJson =
      (row.chart_template_canvas_state ?? {}) as Record<string, unknown>;
    const resolvedChartType =
      setupJson.chart_type ?? mapTemplateTypeToAiChartType(row.chart_template_type);

    if (typeof canvasJson.layoutMode === "string" && canvasJson.layoutMode) {
      layoutMode = canvasJson.layoutMode;
    }

    canvasState.push({
      id: row.chart_template_id,
      layout: isCanvasLayout(canvasJson.layout)
        ? canvasJson.layout
        : undefined,
      kind: typeof canvasJson.kind === "string"
        ? mapAiChartTypeToUiKind(canvasJson.kind)
        : mapAiChartTypeToUiKind(resolvedChartType),
      isActive:
        typeof canvasJson.isActive === "boolean" ? canvasJson.isActive : true,
    });

    return {
      ...setupJson,
      pKey: row.chart_template_id,
      supabaseId: row.chart_template_id,
      chart_title:
        typeof setupJson.chart_title === "string" && setupJson.chart_title
          ? setupJson.chart_title
          : row.chart_template_name || "Untitled Chart",
      chart_type:
        typeof resolvedChartType === "string" ? resolvedChartType : "bar",
      isActive:
        typeof canvasJson.isActive === "boolean"
          ? canvasJson.isActive
            ? 1
            : 0
          : setupJson.isActive,
    };
  });

  return {
    schemas,
    canvasState,
    layoutMode,
  };
}

export function buildChartTemplateInsertPayload(args: {
  companyId: string;
  reportTemplateId: string;
  chart: ReportChartSchema;
  layoutMode?: string;
}) {
  const { companyId, reportTemplateId, chart, layoutMode = "grid" } = args;
  const chartKind = mapAiChartTypeToUiKind(chart.chart_type);
  const canvasState = {
    id: chart.pKey,
    kind: chartKind,
    isActive:
      chart.isActive === undefined
        ? true
        : chart.isActive === true ||
          chart.isActive === 1 ||
          chart.isActive === "1",
    layoutMode,
  };

  const payload: Record<string, unknown> = {
    company_id: companyId,
    report_template_id: reportTemplateId,
    chart_template_name: chart.chart_title || "Untitled Chart",
    chart_template_type: mapUiKindToTemplateType(chartKind),
    chart_template_setup_json: {
      ...chart,
      supabaseId: chart.pKey,
    },
    chart_template_dataset_json: {
      group_field: chart.group_field ?? null,
      numerical_field: chart.numerical_field ?? null,
      subgroup_field: chart.subgroup_field ?? null,
      filters: chart.filters ?? [],
      chart_type: chart.chart_type,
    },
    chart_template_canvas_state: canvasState,
    chart_template_status: "Draft",
  };

  if (isUuid(chart.pKey)) {
    payload.chart_template_id = chart.pKey;
  }

  return payload;
}
