import { NextResponse } from "next/server";
import {
  fetchChartConfiguration,
  fetchReportData,
} from "@/app/api/charts/api";

/**
 * GET /api/charts/data?report_id=<id>
 *
 * Client-friendly wrapper around the server-only chart data fetchers.
 * Since the Charts page is a client component, it cannot call the server
 * functions directly — this API route acts as the bridge.
 *
 * Returns:
 *   { schemas, rows, canvasState, layoutMode, reportRecordId }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("report_id");

  if (!reportId) {
    return NextResponse.json(
      { error: "Missing report_id parameter" },
      { status: 400 }
    );
  }

  try {
    const [schemas, report] = await Promise.all([
      fetchChartConfiguration(reportId),
      fetchReportData(reportId),
    ]);

    return NextResponse.json({
      schemas,
      rows: report.rows,
      canvasState: report.canvasState,
      layoutMode: report.layoutMode,
      reportRecordId: report.reportRecordId,
    });
  } catch (error) {
    console.error("[charts/data GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}
