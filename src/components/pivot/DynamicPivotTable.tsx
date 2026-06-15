"use client";

import { PivotEngine } from "@mindfiredigital/pivothead";
import type { AggregationType } from "@mindfiredigital/pivothead";
import { Loader2, Plus, Save, Table2, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  analyzePivotFields,
  buildPivotTableConfig,
  DEFAULT_PIVOT_METADATA,
  getFieldLabel,
  normalizePivotMetadata,
  normalizePivotRows,
  type PivotDataRow,
  type PivotField,
  type PivotMetadata,
  type PivotValueMetadata,
} from "@/lib/pivot/pivotConfigGenerator";

const AGGREGATIONS: AggregationType[] = ["sum", "avg", "count", "min", "max"];
const MAX_RAW_ROWS = 500;

type DynamicPivotTableProps = {
  data: unknown;
  initialMetadata?: PivotMetadata | null;
  onSave?: (metadata: PivotMetadata) => Promise<void> | void;
};

type PivotMatrixColumn = {
  key: string;
  label: string;
  value: PivotValueMetadata;
};

type PivotMatrixRow = {
  rowKey: string;
  labels: string[];
  cells: Record<string, string>;
};

type PivotMatrix = {
  rowFields: string[];
  columns: PivotMatrixColumn[];
  rows: PivotMatrixRow[];
};

export function DynamicPivotTable({
  data,
  initialMetadata,
  onSave,
}: DynamicPivotTableProps) {
  const sourceRows = useMemo(() => normalizePivotRows(data), [data]);
  const analysis = useMemo(() => analyzePivotFields(sourceRows), [sourceRows]);
  const [metadata, setMetadata] = useState<PivotMetadata>(() =>
    normalizePivotMetadata(initialMetadata ?? DEFAULT_PIVOT_METADATA)
  );
  const [isSaving, setIsSaving] = useState(false);

  const validMetadata = useMemo(() => {
    const dimensionSet = new Set(analysis.dimensions.map((field) => field.field));
    const measureSet = new Set(analysis.measures.map((field) => field.field));
    return {
      rows: metadata.rows.filter((field) => dimensionSet.has(field)),
      columns: metadata.columns.filter((field) => dimensionSet.has(field)),
      values: metadata.values.filter((value) => measureSet.has(value.field)),
    };
  }, [analysis.dimensions, analysis.measures, metadata]);

  const engine = useMemo(() => {
    const config = buildPivotTableConfig(sourceRows, validMetadata);
    return new PivotEngine<PivotDataRow>(config);
  }, [sourceRows, validMetadata]);

  const matrix = useMemo(
    () => buildPivotMatrix(sourceRows, validMetadata, analysis.fields, engine),
    [sourceRows, validMetadata, analysis.fields, engine]
  );

  const isPivotActive =
    validMetadata.rows.length > 0 ||
    validMetadata.columns.length > 0 ||
    validMetadata.values.length > 0;

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(validMetadata);
    } finally {
      setIsSaving(false);
    }
  };

  const addRowField = (field: string) => {
    if (!field || metadata.rows.includes(field)) return;
    setMetadata((prev) => ({ ...prev, rows: [...prev.rows, field] }));
  };

  const addColumnField = (field: string) => {
    if (!field || metadata.columns.includes(field)) return;
    setMetadata((prev) => ({ ...prev, columns: [...prev.columns, field] }));
  };

  const toggleMeasure = (field: string) => {
    setMetadata((prev) => {
      const exists = prev.values.some((value) => value.field === field);
      return {
        ...prev,
        values: exists
          ? prev.values.filter((value) => value.field !== field)
          : [...prev.values, { field, aggregation: "sum" }],
      };
    });
  };

  const updateMeasureAggregation = (field: string, aggregation: AggregationType) => {
    setMetadata((prev) => ({
      ...prev,
      values: prev.values.map((value) =>
        value.field === field ? { ...value, aggregation } : value
      ),
    }));
  };

  const removeField = (bucket: "rows" | "columns", field: string) => {
    setMetadata((prev) => ({
      ...prev,
      [bucket]: prev[bucket].filter((item) => item !== field),
    }));
  };

  if (sourceRows.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-center">
        <Table2 className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-bold text-slate-500">No preview rows available</p>
        <p className="mt-1 text-xs text-slate-400">
          Update the report configurator first to generate template preview data.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-120px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/70">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Table2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Pivot Builder</h2>
              <p className="text-[11px] font-medium text-slate-400">
                {sourceRows.length.toLocaleString()} rows / {analysis.fields.length} fields
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <FieldPicker
            title="Rows"
            fields={analysis.dimensions}
            selected={validMetadata.rows}
            blocked={new Set(validMetadata.columns)}
            onAdd={addRowField}
            onRemove={(field) => removeField("rows", field)}
          />

          <FieldPicker
            title="Columns"
            fields={analysis.dimensions}
            selected={validMetadata.columns}
            blocked={new Set(validMetadata.rows)}
            onAdd={addColumnField}
            onRemove={(field) => removeField("columns", field)}
          />

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                Measures
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {validMetadata.values.length}
              </span>
            </div>

            {analysis.measures.length === 0 ? (
              <p className="text-xs text-slate-400">No numeric fields were detected.</p>
            ) : (
              <div className="space-y-2">
                {analysis.measures.map((field) => {
                  const selected = validMetadata.values.find((value) => value.field === field.field);
                  return (
                    <div
                      key={field.field}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2"
                    >
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(selected)}
                          onChange={() => toggleMeasure(field.field)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600"
                        />
                        <span className="min-w-0 flex-1 truncate">{field.label}</span>
                      </label>
                      {selected && (
                        <select
                          value={selected.aggregation}
                          onChange={(event) =>
                            updateMeasureAggregation(
                              field.field,
                              event.target.value as AggregationType
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-teal-500"
                        >
                          {AGGREGATIONS.map((aggregation) => (
                            <option key={aggregation} value={aggregation}>
                              {aggregation.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={!onSave || isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Pivot Metadata
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div>
            <h1 className="text-sm font-extrabold text-slate-900">
              {isPivotActive ? "Pivot Preview" : "Tabular Preview"}
            </h1>
            <p className="text-[11px] font-medium text-slate-400">
              {isPivotActive
                ? "Selections rebuild the PivotHead engine and render a computed matrix."
                : "Initial state shows the report dataset without aggregation."}
            </p>
          </div>
          {isPivotActive && (
            <button
              type="button"
              onClick={() => setMetadata(DEFAULT_PIVOT_METADATA)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-slate-50"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-5">
          {isPivotActive ? (
            validMetadata.values.length === 0 ? (
              <EmptyPivotState />
            ) : (
              <PivotMatrixTable matrix={matrix} rowFields={validMetadata.rows} fields={analysis.fields} />
            )
          ) : (
            <RawDataTable rows={sourceRows} fields={analysis.fields} />
          )}
        </div>
      </main>
    </div>
  );
}

function FieldPicker({
  title,
  fields,
  selected,
  blocked,
  onAdd,
  onRemove,
}: {
  title: string;
  fields: PivotField[];
  selected: string[];
  blocked: Set<string>;
  onAdd: (field: string) => void;
  onRemove: (field: string) => void;
}) {
  const available = fields.filter((field) => !selected.includes(field.field) && !blocked.has(field.field));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
          {selected.length}
        </span>
      </div>

      <div className="space-y-2">
        {selected.map((field) => (
          <div
            key={field}
            className="flex items-center justify-between gap-2 rounded-lg bg-teal-50 px-2.5 py-2 text-xs font-bold text-teal-800"
          >
            <span className="min-w-0 truncate">{getFieldLabel(fields, field)}</span>
            <button
              type="button"
              onClick={() => onRemove(field)}
              className="rounded-md p-0.5 text-teal-600 hover:bg-teal-100"
              title={`Remove ${field}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <select
          value=""
          onChange={(event) => onAdd(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 outline-none focus:border-teal-500"
        >
          <option value="">Add {title.toLowerCase()} field...</option>
          {available.map((field) => (
            <option key={field.field} value={field.field}>
              {field.label}
            </option>
          ))}
        </select>

        {available.length === 0 && selected.length === 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Plus size={11} /> No available dimensions.
          </p>
        )}
      </div>
    </section>
  );
}

function EmptyPivotState() {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-center">
      <Table2 className="mb-3 h-10 w-10 text-slate-300" />
      <p className="text-sm font-bold text-slate-500">Choose at least one measure</p>
      <p className="mt-1 text-xs text-slate-400">
        Rows and columns define the grouping; measures define what gets aggregated.
      </p>
    </div>
  );
}

function RawDataTable({ rows, fields }: { rows: PivotDataRow[]; fields: PivotField[] }) {
  const visibleRows = rows.slice(0, MAX_RAW_ROWS);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-extrabold text-slate-700">Raw Dataset</p>
        <p className="text-[11px] font-medium text-slate-400">
          Showing {visibleRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows
        </p>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {fields.map((field) => (
                <th
                  key={field.field}
                  className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-extrabold text-slate-500"
                >
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={index} className="odd:bg-white even:bg-slate-50/60">
                {fields.map((field) => (
                  <td key={field.field} className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-700">
                    {formatRawValue(row[field.field])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PivotMatrixTable({
  matrix,
  rowFields,
  fields,
}: {
  matrix: PivotMatrix;
  rowFields: string[];
  fields: PivotField[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {rowFields.length > 0 ? (
                rowFields.map((field) => (
                  <th
                    key={field}
                    className="whitespace-nowrap border-b border-r border-slate-200 px-3 py-2 font-extrabold text-slate-500"
                  >
                    {getFieldLabel(fields, field)}
                  </th>
                ))
              ) : (
                <th className="whitespace-nowrap border-b border-r border-slate-200 px-3 py-2 font-extrabold text-slate-500">
                  Scope
                </th>
              )}
              {matrix.columns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right font-extrabold text-slate-500"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.rowKey} className="odd:bg-white even:bg-slate-50/60">
                {row.labels.length > 0 ? (
                  row.labels.map((label, index) => (
                    <td
                      key={`${row.rowKey}-${index}`}
                      className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2 font-semibold text-slate-700"
                    >
                      {label}
                    </td>
                  ))
                ) : (
                  <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2 font-semibold text-slate-700">
                    Total
                  </td>
                )}
                {matrix.columns.map((column) => (
                  <td
                    key={`${row.rowKey}-${column.key}`}
                    className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-700"
                  >
                    {row.cells[column.key] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildPivotMatrix(
  rows: PivotDataRow[],
  metadata: PivotMetadata,
  fields: PivotField[],
  engine: PivotEngine<PivotDataRow>
): PivotMatrix {
  const rowFields = metadata.rows;
  const columnFields = metadata.columns;
  const columnCombos = collectCombos(rows, columnFields);
  const rowCombos = collectCombos(rows, rowFields);
  const safeColumnCombos = columnFields.length > 0 ? columnCombos : [{ key: "__total__", labels: ["Total"] }];
  const safeRowCombos = rowFields.length > 0 ? rowCombos : [{ key: "__total__", labels: [] }];
  const groupedRows = groupRowsByPivotKeys(rows, rowFields, columnFields);

  const columns = safeColumnCombos.flatMap((combo) =>
    metadata.values.map((value) => ({
      key: `${combo.key}::${value.field}::${value.aggregation}`,
      label:
        columnFields.length > 0
          ? `${combo.labels.join(" / ")} / ${getFieldLabel(fields, value.field)} (${value.aggregation})`
          : `${getFieldLabel(fields, value.field)} (${value.aggregation})`,
      value,
    }))
  );

  const matrixRows = safeRowCombos.map((rowCombo) => {
    const cells: Record<string, string> = {};
    safeColumnCombos.forEach((columnCombo) => {
      const matchingRows = groupedRows.get(composePivotGroupKey(rowCombo.key, columnCombo.key)) ?? [];

      metadata.values.forEach((value) => {
        const columnKey = `${columnCombo.key}::${value.field}::${value.aggregation}`;
        const raw = aggregateRows(matchingRows, value);
        cells[columnKey] = engine.formatValue(raw, value.field);
      });
    });

    return {
      rowKey: rowCombo.key,
      labels: rowCombo.labels,
      cells,
    };
  });

  return {
    rowFields,
    columns,
    rows: matrixRows,
  };
}

function collectCombos(rows: PivotDataRow[], fields: string[]): Array<{ key: string; labels: string[] }> {
  if (fields.length === 0) return [];
  const combos = new Map<string, string[]>();

  rows.forEach((row) => {
    const labels = fields.map((field) => String(row[field] ?? ""));
    const key = labels.join("\u001f");
    if (!combos.has(key)) combos.set(key, labels);
  });

  return Array.from(combos.entries()).map(([key, labels]) => ({ key, labels }));
}

function groupRowsByPivotKeys(
  rows: PivotDataRow[],
  rowFields: string[],
  columnFields: string[]
): Map<string, PivotDataRow[]> {
  const groupedRows = new Map<string, PivotDataRow[]>();

  rows.forEach((row) => {
    const rowKey = rowFields.length > 0 ? fieldsToKey(row, rowFields) : "__total__";
    const columnKey = columnFields.length > 0 ? fieldsToKey(row, columnFields) : "__total__";
    const groupKey = composePivotGroupKey(rowKey, columnKey);
    const existing = groupedRows.get(groupKey);

    if (existing) existing.push(row);
    else groupedRows.set(groupKey, [row]);
  });

  return groupedRows;
}

function fieldsToKey(row: PivotDataRow, fields: string[]): string {
  return fields.map((field) => String(row[field] ?? "")).join("\u001f");
}

function composePivotGroupKey(rowKey: string, columnKey: string): string {
  return `${rowKey}\u001e${columnKey}`;
}

function aggregateRows(rows: PivotDataRow[], value: PivotValueMetadata): number {
  if (value.aggregation === "count") return rows.length;

  const values = rows
    .map((row) => Number(row[value.field]))
    .filter((item) => Number.isFinite(item));

  if (values.length === 0) return 0;

  switch (value.aggregation) {
    case "avg":
      return values.reduce((sum, item) => sum + item, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "sum":
    default:
      return values.reduce((sum, item) => sum + item, 0);
  }
}

function formatRawValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
