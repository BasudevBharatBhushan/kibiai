import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/utils/auth";
import { isSqlSetup } from "@/lib/sql/types";
import type { ViewMode } from "@/lib/sql/types";
import { runSqlReport } from "@/lib/sql/sqlReportEngine";
import type { ReportConfig } from "@/lib/reportConfigTypes";

// ---------------------------------------------------------------------------
// POST /api/sql-report/generate
//
// Mirror of /api/generate-report for the SQL (SQLite) engine.
// Body: { report_setup, report_config, view_mode?, group_path?, confirm_large? }
// Response envelope mirrors /api/generate-report so downstream orchestration
// routes (templates/[id]/generate and .../stream) work without changes.
// ---------------------------------------------------------------------------

export const maxDuration = 300; // Vercel Pro max

export async function POST(req: NextRequest) {
  // 1. Auth — consistent with the existing generate routes
  const session = await getSession();
  if (!session || (session.accountType !== "platform_admin" && !session.companyId)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const {
    report_setup,
    report_config,
    view_mode,
    group_path,
    confirm_large,
    group_offset,
    group_limit,
  } = body as Record<string, unknown>;

  // 3. Validate required fields
  if (!report_setup || !report_config) {
    return NextResponse.json(
      {
        success: false,
        error: "Both report_setup and report_config are required",
      },
      { status: 400 }
    );
  }

  // 4. Parse setup / config if they arrived as strings
  let setupParsed: unknown;
  let configParsed: unknown;
  try {
    setupParsed =
      typeof report_setup === "string" ? JSON.parse(report_setup) : report_setup;
    configParsed =
      typeof report_config === "string"
        ? JSON.parse(report_config)
        : report_config;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid JSON in report_setup or report_config: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 400 }
    );
  }

  // 5. Validate that setup is a SQL setup (discriminator guard)
  if (!isSqlSetup(setupParsed)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'report_setup must be a SQL setup (data_source_type === "sql"). Use /api/generate-report for FileMaker setups.',
      },
      { status: 422 }
    );
  }

  // 6. Resolve view_mode (default: 'collapsed')
  const resolvedViewMode: ViewMode =
    view_mode === "drilldown" ||
    view_mode === "expand_all" ||
    view_mode === "print"
      ? (view_mode as ViewMode)
      : "collapsed";

  // 7. Validate group_path shape (pass-through — SA-7 owns drilldown)
  type GroupPathEntry = { table: string; field: string; value: unknown };
  let resolvedGroupPath: GroupPathEntry[] | undefined;
  if (group_path !== undefined) {
    if (!Array.isArray(group_path)) {
      return NextResponse.json(
        { success: false, error: "group_path must be an array" },
        { status: 400 }
      );
    }
    resolvedGroupPath = group_path as GroupPathEntry[];
  }

  // 8. Run the SQL report engine
  try {
    const result = await runSqlReport({
      setup: setupParsed,
      config: configParsed as ReportConfig,
      viewMode: resolvedViewMode,
      groupPath: resolvedGroupPath,
      confirmLarge:
        confirm_large === true || confirm_large === "true" ? true : undefined,
      groupOffset: typeof group_offset === "number" ? group_offset : undefined,
      groupLimit: typeof group_limit === "number" ? group_limit : undefined,
    });

    // 9. Return envelope matching what the orchestration routes expect.
    //    Keys mirror /api/generate-report's success response so that the
    //    downstream handling (saving preview, streaming logs) works unchanged.
    return NextResponse.json(
      {
        success: true,
        status: "ok",
        report_structure_json: result.report_structure_json ?? null,
        nested: result.nested ?? null,
        row_count: result.row_count ?? null,
        warn_large: result.warn_large ?? null,
        // group_rows is present for drilldown mode when warn_large is false.
        group_rows: result.group_rows ?? null,
        processing_logs: result.processing_logs,
        sql_steps: result.sql_steps,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: message,
        processing_logs: [],
      },
      { status: 500 }
    );
  }
}
