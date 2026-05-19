import { describe, expect, it } from "vitest";

import {
  analyzePivotFields,
  buildPivotTableConfig,
  normalizePivotMetadata,
  normalizePivotRows,
} from "@/lib/pivot/pivotConfigGenerator";

describe("pivotConfigGenerator", () => {
  it("infers numeric fields as measures and string/date fields as dimensions", () => {
    const rows = normalizePivotRows([
      {
        region: "North",
        report_date: "2026-05-19",
        revenue: 1200,
      },
    ]);

    const analysis = analyzePivotFields(rows);

    expect(analysis.measures.map((field) => field.field)).toEqual(["revenue"]);
    expect(analysis.dimensions.map((field) => field.field)).toEqual([
      "region",
      "report_date",
    ]);
    expect(analysis.fields.find((field) => field.field === "report_date")?.type).toBe("date");
  });

  it("normalizes invalid metadata to the minimal persisted shape", () => {
    const metadata = normalizePivotMetadata({
      rows: ["region", 12, ""],
      columns: ["report_date"],
      values: [
        { field: "revenue", aggregation: "avg" },
        { field: "margin", aggregation: "invalid" },
        { aggregation: "sum" },
      ],
    });

    expect(metadata).toEqual({
      rows: ["region"],
      columns: ["report_date"],
      values: [
        { field: "revenue", aggregation: "avg" },
        { field: "margin", aggregation: "sum" },
      ],
    });
  });

  it("builds a PivotHead config from selected rows, columns, and measures", () => {
    const rows = normalizePivotRows([
      { region: "North", product: "A", revenue: 10, units: 2 },
      { region: "South", product: "B", revenue: 20, units: 3 },
    ]);

    const config = buildPivotTableConfig(rows, {
      rows: ["region"],
      columns: ["product"],
      values: [{ field: "revenue", aggregation: "sum" }],
    });

    expect(config.rows).toEqual([{ uniqueName: "region", caption: "Region" }]);
    expect(config.columns).toEqual([{ uniqueName: "product", caption: "Product" }]);
    expect(config.measures).toMatchObject([
      { uniqueName: "revenue", caption: "Revenue", aggregation: "sum" },
    ]);
    expect(config.dimensions.map((field) => field.field)).toEqual(["region", "product"]);
    expect(config.data).toBe(rows);
    expect(config.rawData).toBe(rows);
  });
});
