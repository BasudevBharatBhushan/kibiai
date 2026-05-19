import type {
  AggregationType,
  AxisConfig,
  Dimension,
  MeasureConfig,
  PivotTableConfig,
} from "@mindfiredigital/pivothead";

export type PivotDataRow = Record<string, unknown>;

export type PivotValueMetadata = {
  field: string;
  aggregation: AggregationType;
};

export type PivotMetadata = {
  rows: string[];
  columns: string[];
  values: PivotValueMetadata[];
};

export type PivotFieldType = "string" | "number" | "date";

export type PivotField = {
  field: string;
  label: string;
  type: PivotFieldType;
};

export type PivotFieldAnalysis = {
  fields: PivotField[];
  dimensions: PivotField[];
  measures: PivotField[];
};

export const DEFAULT_PIVOT_METADATA: PivotMetadata = {
  rows: [],
  columns: [],
  values: [],
};

const DATE_LIKE_PATTERN =
  /^\d{4}-\d{1,2}-\d{1,2}(?:[T\s].*)?$|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/;

export function normalizePivotRows(data: unknown): PivotDataRow[] {
  if (!Array.isArray(data)) return [];

  return data
    .filter((row): row is PivotDataRow => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const normalized: PivotDataRow = {};
      Object.entries(row).forEach(([key, value]) => {
        normalized[key] = normalizePivotCell(value);
      });
      return normalized;
    });
}

export function normalizePivotMetadata(metadata: unknown): PivotMetadata {
  if (!metadata || typeof metadata !== "object") return DEFAULT_PIVOT_METADATA;

  const candidate = metadata as Partial<PivotMetadata>;
  return {
    rows: Array.isArray(candidate.rows)
      ? candidate.rows.filter((field): field is string => typeof field === "string" && field.length > 0)
      : [],
    columns: Array.isArray(candidate.columns)
      ? candidate.columns.filter((field): field is string => typeof field === "string" && field.length > 0)
      : [],
    values: Array.isArray(candidate.values)
      ? candidate.values
          .filter(
            (value): value is PivotValueMetadata =>
              Boolean(value) &&
              typeof value === "object" &&
              typeof value.field === "string" &&
              value.field.length > 0
          )
          .map((value) => ({
            field: value.field,
            aggregation: isAggregation(value.aggregation) ? value.aggregation : "sum",
          }))
      : [],
  };
}

export function analyzePivotFields(data: PivotDataRow[]): PivotFieldAnalysis {
  const firstRow = data.find((row) => Object.keys(row).length > 0);
  if (!firstRow) {
    return { fields: [], dimensions: [], measures: [] };
  }

  const fields = Object.keys(firstRow).map((field) => {
    const sampleValue = findFirstValue(data, field);
    const type = inferPivotFieldType(sampleValue);
    return {
      field,
      label: humanizeFieldName(field),
      type,
    };
  });

  const measures = fields.filter((field) => field.type === "number");
  const dimensions = fields.filter((field) => field.type !== "number");

  return { fields, dimensions, measures };
}

export function buildPivotTableConfig(
  data: PivotDataRow[],
  metadata: PivotMetadata
): PivotTableConfig<PivotDataRow> {
  const analysis = analyzePivotFields(data);
  const measureFields = new Set(analysis.measures.map((field) => field.field));
  const dimensionFields = new Set(analysis.dimensions.map((field) => field.field));

  const rows = metadata.rows
    .filter((field) => dimensionFields.has(field))
    .map((field) => toAxisConfig(field));
  const columns = metadata.columns
    .filter((field) => dimensionFields.has(field))
    .map((field) => toAxisConfig(field));
  const measures = metadata.values
    .filter((value) => measureFields.has(value.field))
    .map((value) => toMeasureConfig(value));

  return {
    data,
    rawData: data,
    rows,
    columns,
    measures,
    dimensions: analysis.dimensions.map(toDimension),
    defaultAggregation: "sum",
    isResponsive: true,
  };
}

export function getFieldLabel(fields: PivotField[], field: string): string {
  return fields.find((item) => item.field === field)?.label ?? humanizeFieldName(field);
}

function normalizePivotCell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

function findFirstValue(data: PivotDataRow[], field: string): unknown {
  for (const row of data) {
    const value = row[field];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return firstDefined(data[0]?.[field]);
}

function firstDefined(value: unknown): unknown {
  return value === undefined ? null : value;
}

function inferPivotFieldType(value: unknown): PivotFieldType {
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (typeof value === "string" && DATE_LIKE_PATTERN.test(value.trim()) && !Number.isNaN(Date.parse(value))) {
    return "date";
  }
  return "string";
}

function toAxisConfig(field: string): AxisConfig {
  return {
    uniqueName: field,
    caption: humanizeFieldName(field),
  };
}

function toMeasureConfig(value: PivotValueMetadata): MeasureConfig {
  return {
    uniqueName: value.field,
    caption: humanizeFieldName(value.field),
    aggregation: value.aggregation,
    format: {
      type: "number",
      locale: "en-US",
      decimals: value.aggregation === "count" ? 0 : 2,
    },
  };
}

function toDimension(field: PivotField): Dimension {
  return {
    field: field.field,
    label: field.label,
    type: field.type === "date" ? "date" : "string",
  };
}

function humanizeFieldName(field: string): string {
  return field
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function isAggregation(value: unknown): value is AggregationType {
  return value === "sum" || value === "avg" || value === "count" || value === "min" || value === "max";
}
