import { NextRequest, NextResponse } from "next/server";
import { SchemaResponse } from "@/lib/sql/types";

type MappedType = "text" | "number" | "date";

function mapColumnType(raw: string): MappedType {
  const t = raw.toUpperCase();
  if (t.includes("INT") || t.includes("REAL") || t.includes("NUMERIC") || t.includes("FLOAT") || t.includes("DOUBLE") || t.includes("DECIMAL")) {
    return "number";
  }
  if (t.includes("DATE") || t.includes("TIME")) {
    return "date";
  }
  return "text";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { host, apiKey } = body as { host?: string; apiKey?: string };

    if (!host || typeof host !== "string") {
      return NextResponse.json({ success: false, error: "Missing host." }, { status: 400 });
    }
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ success: false, error: "Missing API key." }, { status: 400 });
    }

    const schemaUrl = `${host.replace(/\/$/, "")}/schema`;

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(schemaUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch {
      return NextResponse.json(
        { success: false, error: "Could not reach the SQLite server. Check the host URL." },
        { status: 502 }
      );
    }

    if (upstreamRes.status === 401 || upstreamRes.status === 403) {
      return NextResponse.json({ success: false, error: "Invalid API key." }, { status: 401 });
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { success: false, error: `SQLite server returned ${upstreamRes.status}.` },
        { status: 502 }
      );
    }

    const raw = (await upstreamRes.json()) as SchemaResponse;
    // Server returns { schema: [...] }; fall back to tables for forward-compat.
    const tableList = raw.schema ?? raw.tables ?? [];

    const tables = tableList.map((t) => ({
      name: t.name,
      columns: (t.columns ?? []).map((c) => ({
        name: c.name,
        type: mapColumnType(c.type),
      })),
    }));

    return NextResponse.json({ success: true, tables });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
