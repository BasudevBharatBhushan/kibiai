"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import "@/styles/classicview.css";
import { ChevronDown, ChevronRight, X, Printer, ChevronLeft } from "lucide-react";
import type { ReportMetadata } from "@/lib/utils/reportMetadata";
import { formatDisplayDate } from "@/lib/utils/reportMetadata";
import type {
  NestedReport,
  NestedGroupNode,
  DrilldownResult,
} from "@/lib/sql/structureAdapter";
import { LARGE_ROW_THRESHOLD } from "@/lib/sql/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drill-down request emitted to the parent in nested mode.
 * `groupPath` is reconstructed from the clicked subsummary's groupId.
 * Exported so SA-9 (ReportPreview) can type its drill callback.
 */
export interface DrillRequest {
  groupPath: Array<{ field: string; label: string }>;
  count: number;
}

/** Drill-down result the parent resolves to (SA-7 shape). */
export type DrillResult = DrilldownResult;

// NestedGroupNode now carries optional totalFields and bodyRows directly
// (added in Task 0 of SA-9). No local extension type needed.

interface ClassicReportViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonData: any[];
  showAvg: boolean;
  collapseBody: boolean;
  paginate?: boolean;
  dateBreakdown?: { field: string; interval: "Month" | "Quarter" };
  metadata?: ReportMetadata;
  /** Active field→value filter selections (controlled by parent via ClassicViewSettings) */
  activeFilters?: Record<string, string>;
  /** Rendering mode. 'flat' (default) = existing FileMaker path, unchanged. */
  mode?: "flat" | "nested";
  /** Pre-computed nested SQL report payload (required when mode === 'nested'). */
  nestedData?: NestedReport;
  /** Async drill-down handler invoked for collapsed drillable leaf groups (nested mode). */
  onDrillDown?: (req: DrillRequest) => Promise<DrillResult>;
  /** Group pagination info for capped nested SQL reports. */
  groupCountInfo?: { label: string; loaded: number; total: number; capped: boolean };
  /** Triggered when the user clicks "Load more groups". */
  onLoadMore?: () => void;
  loadMoreLoading?: boolean;
}

interface SubsummaryDef {
  SubsummaryFields: string[];
  SubsummaryTotal: string[];
  SubsummaryDisplay: string[];
  SortOrder: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseSortValue(val: unknown): number | string {
  if (val === null || val === undefined || val === "") return "";
  const s = String(val).trim();
  if (!isNaN(Number(s)) && s !== "") return Number(s);
  if (s.length > 5) {
    const ts = Date.parse(s);
    if (!isNaN(ts)) return ts;
  }
  return s.toLowerCase();
}

function fmt(val: number, prefix: string, suffix: string): string {
  const formatted = val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${prefix}${formatted}${suffix}`;
}

function fmtCell(
  raw: unknown,
  field: string,
  prefixMap: Record<string, string>,
  suffixMap: Record<string, string>
): string {
  if (raw === undefined || raw === null) return "—";
  const prefix = prefixMap[field] ?? prefixMap[field.trim()] ?? "";
  const suffix = suffixMap[field] ?? suffixMap[field.trim()] ?? "";
  const s = String(raw).trim();
  if (s === "" || s === "--") return s;
  // Reformat ISO date strings (YYYY-MM-DD) → MM/DD/YYYY.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${m}-${d}-${y}`;
  }
  const num = parseFloat(s);
  // Apply 2-decimal formatting when the field has any prefix/suffix (currency,
  // percentage, etc.) — these come from the setup definition and only appear on
  // explicitly typed numeric fields. Also cover name-pattern fallback for FM flat mode.
  if (!isNaN(num) && isFinite(num) && (prefix !== "" || suffix !== "" || /total|sum|price|cost|amount/i.test(field))) {
    return (
      prefix +
      num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      suffix
    );
  }
  return prefix + s + suffix;
}

function groupBy(
  arr: Record<string, unknown>[],
  key: string
): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of arr) {
    const k = String(row[key] ?? "").trim();
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(row);
  }
  return map;
}

function sortMap(
  map: Map<string, Record<string, unknown>[]>,
  order: string
): [string, Record<string, unknown>[]][] {
  const entries = Array.from(map.entries());
  entries.sort(([a], [b]) => {
    const va = parseSortValue(a);
    const vb = parseSortValue(b);
    if (va < vb) return order === "asc" ? -1 : 1;
    if (va > vb) return order === "asc" ? 1 : -1;
    return 0;
  });
  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill-down Modal
// ─────────────────────────────────────────────────────────────────────────────

interface DrillModalProps {
  title: string;
  rows: Record<string, unknown>[];
  fieldOrder: string[];
  prefixMap: Record<string, string>;
  suffixMap: Record<string, string>;
  numericFields: Set<string>;
  totalFields: string[];
  onClose: () => void;
  /** Nested mode: show a loading state while drill rows are fetched. */
  loading?: boolean;
  /** Nested mode: show an error message instead of the table. */
  error?: string;
  /** Nested mode: pre-computed totals (label → sum); used instead of reducing rows. */
  totals?: Record<string, number>;
}

function DrillModal({
  title,
  rows,
  fieldOrder,
  prefixMap,
  suffixMap,
  numericFields,
  totalFields,
  onClose,
  loading = false,
  error,
  totals,
}: DrillModalProps) {
  // Keyboard: close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Compute footers (totals for numeric/total columns).
  // Nested mode supplies `totals` directly; flat mode reduces the rows as before.
  const footerTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const f of totalFields) {
      const key = f.trim();
      t[key] =
        totals !== undefined
          ? totals[f] ?? totals[key] ?? 0
          : rows.reduce((s, r) => s + (parseFloat(String(r[key] ?? "")) || 0), 0);
    }
    return t;
  }, [totalFields, rows, totals]);

  const footerEntries = Object.entries(footerTotals);

  return (
    <div className="cv-dd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cv-dd-card">
        {/* Header */}
        <div className="cv-dd-head">
          <div>
            <p className="cv-dd-title">{title}</p>
            <div className="cv-dd-meta">
              <span>
                {loading ? (
                  "Loading…"
                ) : (
                  <>
                    <strong>{rows.length}</strong> record{rows.length !== 1 ? "s" : ""}
                  </>
                )}
              </span>
              {!loading && !error && footerEntries.map(([f, v]) => {
                const prefix = prefixMap[f] ?? "";
                const suffix = suffixMap[f] ?? "";
                return (
                  <span key={f}>
                    {f}: <strong>{fmt(v, prefix, suffix)}</strong>
                  </span>
                );
              })}
            </div>
          </div>
          <button className="cv-dd-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="cv-dd-body">
          {loading ? (
            <table className="cv-dd-tbl">
              <thead>
                <tr>
                  {(fieldOrder.length > 0 ? fieldOrder : Array.from({ length: 4 }, (_, i) => String(i))).map((f) => (
                    <th key={f}>
                      <div className="cv-skel-cell" style={{ width: "80%" }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, ri) => (
                  <tr key={ri}>
                    {(fieldOrder.length > 0 ? fieldOrder : Array.from({ length: 4 }, (_, i) => String(i))).map((f, fi) => (
                      <td key={f}>
                        <div className="cv-skel-cell" style={{ width: fi === 0 ? "60%" : "45%" }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : error ? (
            <div className="cv-dd-empty">{error}</div>
          ) : rows.length === 0 ? (
            <div className="cv-dd-empty">No records found</div>
          ) : (
            <table className="cv-dd-tbl">
              <thead>
                <tr>
                  {fieldOrder.map((f) => (
                    <th key={f} className={numericFields.has(f) ? "cv-nr" : ""}>{f.trim()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {fieldOrder.map((f) => (
                      <td key={f} className={numericFields.has(f) ? "cv-nr" : ""}>
                        {fmtCell(row[f], f, prefixMap, suffixMap)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer totals */}
        {!loading && !error && footerEntries.length > 0 && (
          <div className="cv-dd-foot">
            {footerEntries.map(([f, v]) => {
              const prefix = prefixMap[f] ?? "";
              const suffix = suffixMap[f] ?? "";
              return (
                <div key={f}>
                  <div className="cv-dd-foot-label">{f}</div>
                  <div className="cv-dd-foot-value">{fmt(v, prefix, suffix)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ClassicReportView({
  jsonData,
  showAvg,
  collapseBody,
  paginate = false,
  dateBreakdown,
  metadata,
  activeFilters: activeFiltersProp = {},
  mode = "flat",
  nestedData,
  onDrillDown,
  groupCountInfo,
  onLoadMore,
  loadMoreLoading = false,
}: ClassicReportViewProps) {
  const isNested = mode === "nested" && !!nestedData;
  // ── Parse JSON structure ──────────────────────────────────────────────────
  const titleHeader = useMemo(
    () => jsonData.find((x) => "TitleHeader" in x)?.TitleHeader,
    [jsonData]
  );
  const bodyItem = useMemo(() => jsonData.find((x) => "Body" in x)?.Body, [jsonData]);
  const bodyData: Record<string, unknown>[] = useMemo(() => bodyItem?.BodyField ?? [], [bodyItem]);
  const fieldOrder: string[] = useMemo(
    () =>
      isNested && nestedData
        ? nestedData.fieldOrder
        : bodyItem?.BodyFieldOrder ?? Object.keys(bodyData[0] ?? {}),
    [isNested, nestedData, bodyItem, bodyData]
  );
  const prefixMap: Record<string, string> = useMemo(
    () => (isNested && nestedData ? nestedData.fieldPrefix : bodyItem?.FieldPrefix ?? {}),
    [isNested, nestedData, bodyItem]
  );
  const suffixMap: Record<string, string> = useMemo(
    () => (isNested && nestedData ? nestedData.fieldSuffix : bodyItem?.FieldSuffix ?? {}),
    [isNested, nestedData, bodyItem]
  );

  // BodySortOrder: [{Column, Order}] — same structure the print view already uses
  const bodySortOrder: Array<{ Column: string; Order: string }> = useMemo(
    () => bodyItem?.BodySortOrder ?? [],
    [bodyItem]
  );

  const subsummaries: SubsummaryDef[] = useMemo(
    () => jsonData.filter((x) => "Subsummary" in x).map((x) => x.Subsummary),
    [jsonData]
  );
  const trailingSummaryFields: string[] = useMemo(
    () =>
      jsonData.find((x) => "TrailingGrandSummary" in x)?.TrailingGrandSummary
        ?.TrailingGrandSummary ?? [],
    [jsonData]
  );

  // ── All total fields across all subsummaries ──────────────────────────────
  const allTotalFields = useMemo(
    () => [...new Set(subsummaries.flatMap((ss) => ss.SubsummaryTotal ?? []))],
    [subsummaries]
  );

  // ── Hide subsummary group-by fields from the visible columns ─────────────
  // (same as the HTML reference: grouping fields are shown only in the subsummary
  //  label, not as redundant columns in the detail rows or header)
  
  const effectiveSubsummaries = useMemo(() => {
    const arr = [...subsummaries];
    if (dateBreakdown?.field) {
      arr.unshift({
        SubsummaryFields: ["_date_breakdown"],
        SubsummaryTotal: allTotalFields,
        SubsummaryDisplay: [],
        SortOrder: "asc"
      });
    }
    return arr;
  }, [subsummaries, dateBreakdown, allTotalFields]);

  const hiddenFields = useMemo(() => {
    const s = new Set<string>();
    s.add("_date_breakdown");
    for (const ss of effectiveSubsummaries) {
      for (const f of ss.SubsummaryFields) {
        s.add(f.trim());
        s.add(f);
      }
    }
    return s;
  }, [effectiveSubsummaries]);

  // Visible field order used for headers and detail rows (excludes group-by fields)
  const visibleFieldOrder = useMemo(
    () => fieldOrder.filter((f) => !hiddenFields.has(f) && !hiddenFields.has(f.trim())),
    [fieldOrder, hiddenFields]
  );
  // Nested mode: find the first available leaf body row to refine numeric alignment.
  const nestedSampleRow = useMemo<Record<string, unknown> | undefined>(() => {
    if (!isNested || !nestedData) return undefined;
    const findSample = (
      nodes: NestedGroupNode[] | undefined
    ): Record<string, unknown> | undefined => {
      if (!nodes) return undefined;
      for (const node of nodes) {
        if (node.bodyRows && node.bodyRows.length > 0) return node.bodyRows[0];
        const child = findSample(node.children as NestedGroupNode[] | undefined);
        if (child) return child;
      }
      return undefined;
    };
    return findSample(nestedData.groups as NestedGroupNode[]);
  }, [isNested, nestedData]);

  const numericFields = useMemo(() => {
    const set = new Set<string>();
    const sample = isNested ? nestedSampleRow : bodyData[0];
    for (const f of fieldOrder) {
      const v = sample?.[f];
      const prefix = prefixMap[f] ?? "";
      if (prefix === "$" || /total|sum|price|cost|amount|qty|quantity/i.test(f)) {
        set.add(f);
      } else if (
        v !== undefined &&
        !isNaN(parseFloat(String(v))) &&
        String(v).trim() !== ""
      ) {
        set.add(f);
      }
    }
    return set;
  }, [bodyData, visibleFieldOrder, fieldOrder, prefixMap, isNested, nestedSampleRow]);

  // ── Filters — driven by parent (ClassicViewSettings) ─────────────────────
  const filteredBodyData = useMemo(() => {
    let base = bodyData;
    if (Object.keys(activeFiltersProp).length > 0) {
      base = bodyData.filter((row) =>
        Object.entries(activeFiltersProp).every(
          ([field, val]) => !val || String(row[field] ?? "").trim() === val
        )
      );
    }
    
    // Inject date breakdown if active
    if (dateBreakdown?.field) {
      const { field, interval } = dateBreakdown;
      base = base.map(row => {
        const val = row[field];
        let breakdownVal = "Unknown Date";
        if (val) {
          const d = new Date(val as string);
          if (!isNaN(d.getTime())) {
            if (interval === "Month") {
              breakdownVal = d.toLocaleDateString("en-US", { year: 'numeric', month: 'long' });
            } else if (interval === "Quarter") {
              const q = Math.floor(d.getMonth() / 3) + 1;
              breakdownVal = `Q${q} ${d.getFullYear()}`;
            }
          }
        }
        return { ...row, _date_breakdown: breakdownVal };
      });
    }
    return base;
  }, [bodyData, activeFiltersProp, dateBreakdown]);

  // ── Apply BodySortOrder (same logic as the print view) ────────────────────
  const sortedBodyData = useMemo(() => {
    if (!bodySortOrder.length) return filteredBodyData;
    return [...filteredBodyData].sort((a, b) => {
      for (const spec of bodySortOrder) {
        const col = spec.Column;
        const order = spec.Order.toLowerCase();
        if (a[col] === undefined || b[col] === undefined) continue;
        const va = parseSortValue(a[col]);
        const vb = parseSortValue(b[col]);
        if (va !== vb) return order === "asc" ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
      }
      return 0;
    });
  }, [filteredBodyData, bodySortOrder]);

  // ── Collapse state ────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Reset per-group overrides whenever the global collapseBody default changes.
  // Using useEffect instead of a render-time setState avoids React strict mode
  // warnings about updating state during render.
  const prevCollapseBody = React.useRef(collapseBody);
  useEffect(() => {
    if (prevCollapseBody.current !== collapseBody) {
      prevCollapseBody.current = collapseBody;
      setCollapsedGroups(new Set());
    }
  }, [collapseBody]);

  const isCollapsed = useCallback(
    (id: string) => {
      const inSet = collapsedGroups.has(id);
      return collapseBody ? !inSet : inSet;
    },
    [collapsedGroups, collapseBody]
  );

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Flat-mode drill modal (nested mode uses inline expansion instead) ────────
  const [drillModal, setDrillModal] = useState<{
    title: string;
    rows: Record<string, unknown>[];
    totalFields: string[];
    fieldOrder?: string[];
    totals?: Record<string, number>;
    loading?: boolean;
    error?: string;
  } | null>(null);

  // ── Nested-mode inline drill state ───────────────────────────────────────────
  // Keyed by groupId. Tracks loading / loaded / error for each drilled group.
  type DrillState = {
    loading: boolean;
    rows: Record<string, unknown>[];
    fieldOrder: string[];
    totals: Record<string, number>;
    totalFields: string[];
    error?: string;
  };
  const [drilledGroups, setDrilledGroups] = React.useState<Map<string, DrillState>>(
    () => new Map()
  );

  // Reset inline-drilled rows whenever the underlying nested data changes
  // (new report generated).
  const prevNestedDataRef = React.useRef(nestedData);
  if (prevNestedDataRef.current !== nestedData) {
    prevNestedDataRef.current = nestedData;
    if (drilledGroups.size > 0) setDrilledGroups(new Map());
  }

  // ── Nested-mode inline drill handler (kept for skeleton retry button) ────────
  const handleDrillInline = useCallback(
    async (groupId: string, count: number, totalFields: string[]) => {
      if (!onDrillDown) return;
      const groupPath = groupId
        .split("|")
        .slice(1)
        .map((seg) => {
          const idx = seg.indexOf(":");
          return idx === -1
            ? { field: seg, label: "" }
            : { field: seg.slice(0, idx), label: seg.slice(idx + 1) };
        });
      setDrilledGroups((prev) => {
        const next = new Map(prev);
        next.set(groupId, { loading: true, rows: [], fieldOrder: [], totals: {}, totalFields });
        return next;
      });
      if (isCollapsed(groupId)) toggleGroup(groupId);
      try {
        const result = await onDrillDown({ groupPath, count });
        setDrilledGroups((prev) => {
          const next = new Map(prev);
          next.set(groupId, { loading: false, rows: result.bodyRows, fieldOrder: result.fieldOrder, totals: result.totals, totalFields: result.totalFields });
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load records.";
        setDrilledGroups((prev) => {
          const next = new Map(prev);
          next.set(groupId, { loading: false, rows: [], fieldOrder: [], totals: {}, totalFields, error: message });
          return next;
        });
      }
    },
    [onDrillDown, isCollapsed, toggleGroup]
  );

  // ── Nested-mode modal drill handler ──────────────────────────────────────────
  // Opens the shared DrillModal with a loading spinner immediately, fetches rows
  // via onDrillDown, then populates the modal — same UX as flat (FM) mode.
  const handleDrillModal = useCallback(
    async (groupId: string, title: string, count: number, totalFields: string[]) => {
      if (!onDrillDown) return;

      if (count > LARGE_ROW_THRESHOLD) {
        const proceed = window.confirm(
          `This group has ${count.toLocaleString("en-US")} rows and may take a moment to load. Continue?`
        );
        if (!proceed) return;
      }

      const groupPath = groupId
        .split("|")
        .slice(1)
        .map((seg) => {
          const idx = seg.indexOf(":");
          return idx === -1
            ? { field: seg, label: "" }
            : { field: seg.slice(0, idx), label: seg.slice(idx + 1) };
        });

      setDrillModal({ title, rows: [], totalFields, loading: true });

      try {
        const result = await onDrillDown({ groupPath, count });
        setDrillModal({
          title,
          rows: result.bodyRows,
          fieldOrder: result.fieldOrder,
          totals: result.totals,
          totalFields: result.totalFields,
          loading: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load records.";
        setDrillModal({ title, rows: [], totalFields, loading: false, error: message });
      }
    },
    [onDrillDown]
  );

  // ── Grand totals ──────────────────────────────────────────────────────────
  // Nested mode: return the pre-computed grandTotals directly (no reduction).
  const grandTotals = useMemo(() => {
    if (isNested && nestedData) return nestedData.grandTotals;
    const totals: Record<string, number> = {};
    for (const f of trailingSummaryFields) {
      totals[f.trim()] = sortedBodyData.reduce(
        (s, r) => s + (parseFloat(String(r[f.trim()] ?? "")) || 0),
        0
      );
    }
    return totals;
  }, [isNested, nestedData, trailingSummaryFields, sortedBodyData]);

  // Record count used for the grand-summary row / averages.
  const grandTotalCount = useMemo(
    () => (isNested && nestedData ? nestedData.grandTotalCount : filteredBodyData.length),
    [isNested, nestedData, filteredBodyData]
  );

  // ── Build rows recursively ────────────────────────────────────────────────
  type RowSpec =
    | {
        kind: "ss";
        groupId: string;
        level: number;
        label: string;
        field: string;
        displayFields: string[];
        totalFields: string[];
        rows: Record<string, unknown>[];
        displayValues: Record<string, unknown>;
        /** Nested mode: pre-computed totals (label → sum); undefined in flat mode. */
        totals?: Record<string, number>;
        /** Nested mode: pre-computed row count; undefined in flat mode. */
        count?: number;
        /** Nested mode: true when this leaf has no rendered children/body rows (drillable). */
        drillable?: boolean;
      }
    | { kind: "det"; groupId: string; row: Record<string, unknown> }
    | { kind: "skel"; groupId: string; count: number }
    | { kind: "gs" };

  const buildRows = useCallback(
    (data: Record<string, unknown>[], ssLevel: number, parentId: string): RowSpec[] => {
      if (ssLevel >= effectiveSubsummaries.length) {
        return data.map((row) => ({ kind: "det" as const, groupId: parentId, row }));
      }
      const ss = effectiveSubsummaries[ssLevel];
      const groupField = ss.SubsummaryFields[0];
      const grouped = groupBy(data, groupField);
      const sorted = sortMap(grouped, (ss.SortOrder || "asc").toLowerCase());
      const out: RowSpec[] = [];

      for (const [groupValue, groupRows] of sorted) {
        const groupId = `${parentId}|${groupField}:${groupValue}`;
        const displayValues: Record<string, unknown> = {};
        for (const df of ss.SubsummaryDisplay ?? []) {
          displayValues[df] = groupRows[0]?.[df];
        }
        out.push({
          kind: "ss",
          groupId,
          level: ssLevel,
          label: groupValue || "(blank)",
          field: groupField,
          displayFields: ss.SubsummaryDisplay ?? [],
          totalFields: ss.SubsummaryTotal ?? [],
          rows: groupRows,
          displayValues,
        });
        out.push(...buildRows(groupRows, ssLevel + 1, groupId));
      }
      return out;
    },
    [effectiveSubsummaries]
  );

  const flatRows = useMemo(() => {
    if (!sortedBodyData.length) return [];
    const allRows = buildRows(sortedBodyData, 0, "root");
    if (trailingSummaryFields.length > 0) {
      allRows.push({ kind: "gs" });
    }
    return allRows;
  }, [sortedBodyData, buildRows, trailingSummaryFields]);

  // ── Nested mode adapter ─────────────────────────────────────────────────────
  // Walks nestedData.groups and emits the SAME RowSpec[] the flat buildRows
  // produces, so the rest of the renderer is reused verbatim. The groupId
  // convention `${parentId}|${field}:${label}` matches the flat path so
  // isCollapsed/toggleGroup/isRowVisible work unchanged.
  const nestedRows = useMemo<RowSpec[]>(() => {
    if (!isNested || !nestedData) return [];
    const out: RowSpec[] = [];

    const walk = (nodes: NestedGroupNode[], level: number, parentId: string) => {
      for (const node of nodes) {
        const labelStr = String(node.value ?? "").trim() || "(blank)";
        // Use the raw DB value (groupKeyValue) as the filter key encoded in
        // groupId so that when the user drills down the WHERE clause receives
        // the same value the SQL engine produced (e.g. "2024-01-15" ISO date),
        // not the human-formatted display string (e.g. "01/15/2024").
        // NOTE: do NOT apply the "(blank)" fallback to filterVal — blank groups
        // have rawValue="" and the SQL filter must send "" not "(blank)".
        const filterVal = String(node.groupKeyValue ?? node.value ?? "").trim();
        const groupId = `${parentId}|${node.field}:${filterVal}`;
        const hasChildren = !!node.children && node.children.length > 0;
        const hasBodyRows = !!node.bodyRows && node.bodyRows.length > 0;
        const drillState = drilledGroups.get(groupId);
        const isDrillLoading = drillState?.loading === true;
        const hasDrillError = !isDrillLoading && !!drillState?.error;
        const hasDrilledRows = !isDrillLoading && (drillState?.rows?.length ?? 0) > 0;
        // Drillable: leaf with no rows yet (not loading, not loaded, no error).
        // Error state is retriable — treat as drillable so click retries.
        const drillable = !hasChildren && !hasBodyRows && !hasDrilledRows && !isDrillLoading;

        out.push({
          kind: "ss",
          groupId,
          level,
          label: labelStr,
          field: node.label,
          displayFields: Object.keys(node.display ?? {}),
          totalFields: node.totalFields ?? Object.keys(node.totals ?? {}),
          rows: node.bodyRows ?? [],
          displayValues: node.display ?? {},
          totals: node.totals ?? {},
          count: node.count,
          drillable,
        });

        if (hasChildren) {
          walk(node.children as NestedGroupNode[], level + 1, groupId);
        } else if (isDrillLoading || hasDrillError) {
          out.push({ kind: "skel", groupId, count: node.count });
        } else if (hasDrilledRows) {
          for (const row of drillState!.rows) {
            out.push({ kind: "det", groupId, row });
          }
        } else if (hasBodyRows) {
          for (const row of node.bodyRows!) {
            out.push({ kind: "det", groupId, row });
          }
        }
        // undrilled drillable leaf: emit no rows yet.
      }
    };

    walk(nestedData.groups as NestedGroupNode[], 0, "root");

    if (nestedData.grandTotalFields.length > 0) {
      out.push({ kind: "gs" });
    }
    return out;
  }, [isNested, nestedData, drilledGroups]);

  const rows = useMemo(
    () => (isNested ? nestedRows : flatRows),
    [isNested, nestedRows, flatRows]
  );

  // ── Visibility helper ─────────────────────────────────────────────────────
  const isRowVisible = useCallback(
    (spec: RowSpec): boolean => {
      if (spec.kind === "gs") return true;
      const groupId = spec.groupId;
      const parts = groupId.split("|");
      // For detail/skeleton rows, groupId is the parent's group ID, so we check all ancestors.
      // For subsummary rows, groupId is the row's own group ID, so we check ancestors excluding the last part (itself).
      const checkLimit = spec.kind === "det" || spec.kind === "skel" ? parts.length : parts.length - 1;
      // We start i from 2 to skip "root" which is at parts[0]
      for (let i = 2; i <= checkLimit; i++) {
        const ancestorId = parts.slice(0, i).join("|");
        if (isCollapsed(ancestorId)) return false;
      }
      return true;
    },
    [isCollapsed]
  );

  // ── Recalculate pagination based on collapsed view ────────────────────────
  const visibleRowsList = useMemo(() => {
    return rows.filter(isRowVisible);
  }, [rows, isRowVisible]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [sortedBodyData, paginate, dateBreakdown, collapsedGroups]);

  const totalPages = paginate ? Math.ceil(visibleRowsList.length / pageSize) : 1;

  // Clamp current page to valid page range when pagination recalculates
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const visibleRows = useMemo(() => {
    if (!paginate) return visibleRowsList;
    const start = (currentPage - 1) * pageSize;
    return visibleRowsList.slice(start, start + pageSize);
  }, [visibleRowsList, paginate, currentPage, pageSize]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '', 'width=900,height=1200');
    if (!printWindow) {
        alert("Pop-up blocked. Please allow pop-ups for this site to print.");
        return;
    }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');
      
    // Print the entire table (all pages, respecting collapsed states)
    const tableHtml = document.getElementById('classic-print-area')?.innerHTML || '';
    const headerHtml = document.querySelector('.cv-report-header')?.outerHTML || '';
    const footerHtml = document.querySelector('.cv-foot')?.outerHTML || '';
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Classic View</title>
          ${styles}
          <style>
            body { font-family: sans-serif; padding: 20px; background: white; }
            .cv-wrap { max-width: 100%; border: none; box-shadow: none; }
            .cv-scroll-x { overflow: visible !important; }
            .cv-table { width: 100%; }
            .no-print { display: none !important; }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="cv-wrap">
            ${headerHtml}
            <div class="cv-scroll-x">
              ${tableHtml}
            </div>
            ${footerHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
  }, []);

  const renderTableRows = useCallback((rowsToRender: RowSpec[], isPrintView = false) => {
    return rowsToRender.flatMap((spec, rowIdx) => {
      // ── Grand Summary ──
      if (spec.kind === "gs") {
        const gtItems = Object.entries(grandTotals).map(([f, sum]) => {
          const value = showAvg && grandTotalCount > 0 ? sum / grandTotalCount : sum;
          const prefix = prefixMap[f] ?? prefixMap[f.trim()] ?? "";
          const suffix = suffixMap[f] ?? suffixMap[f.trim()] ?? "";
          return { f, value, prefix, suffix };
        });
        const remaining = groupCountInfo
          ? groupCountInfo.total - groupCountInfo.loaded
          : 0;
        const rows: React.ReactElement[] = [];
        // When groups are capped, inject a visual separator before the grand total
        // so the user understands the total is for all data, not just the visible groups.
        if (groupCountInfo?.capped && !isPrintView) {
          rows.push(
            <tr key="load-more-marker" className="no-print">
              <td colSpan={visibleFieldOrder.length} className="px-4 py-2">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex-1 h-px bg-slate-200" />
                  <span className="text-slate-500">
                    {remaining.toLocaleString()} more group{remaining !== 1 ? "s" : ""} not loaded
                  </span>
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={loadMoreLoading}
                    className="text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadMoreLoading ? "Loading…" : "Load more groups"}
                  </button>
                  <span className="flex-1 h-px bg-slate-200" />
                </div>
              </td>
            </tr>
          );
        }
        rows.push(
          <tr key={`gs-${isPrintView ? "print" : "normal"}`} className="cv-gs">
            <td colSpan={visibleFieldOrder.length}>
              <div className="cv-ss-row">
                <div className="cv-ss-label-side">
                  <span className="cv-ss-label-text">
                    Grand Total ({grandTotalCount} record{grandTotalCount !== 1 ? "s" : ""})
                  </span>
                </div>
                <div className="cv-ss-total-side">
                  {gtItems.map(({ f, value, prefix, suffix }) => (
                    <div key={f} className="cv-ss-total-item">
                      <span className="cv-ss-total-field">{f.trim()}</span>
                      <span className="cv-ss-total-value">{fmt(value, prefix, suffix)}</span>
                      {showAvg && <span className="cv-avg-line">avg</span>}
                    </div>
                  ))}
                </div>
              </div>
            </td>
          </tr>
        );
        return rows;
      }

      // ── Skeleton / Error Row (nested inline drill loading) ──
      if (spec.kind === "skel") {
        const drillState = drilledGroups.get(spec.groupId);
        const isError = drillState && !drillState.loading && !!drillState.error;
        return (
          <tr key={`skel-${isPrintView ? "print-" : ""}${spec.groupId}`} className="cv-det">
            <td colSpan={visibleFieldOrder.length} style={{ padding: "10px 16px" }}>
              {isError ? (
                <span style={{ color: "#dc2626", fontSize: "13px" }}>
                  {drillState!.error}
                  {" "}
                  <button
                    style={{ marginLeft: "8px", fontSize: "12px", color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    onClick={() => handleDrillInline(spec.groupId, spec.count, drillState!.totalFields)}
                  >
                    Retry
                  </button>
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#78716c", fontSize: "13px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "14px",
                      height: "14px",
                      border: "2px solid #d4d4d4",
                      borderTopColor: "#78716c",
                      borderRadius: "50%",
                      animation: "cv-spin 0.7s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                  {`Loading ${spec.count.toLocaleString("en-US")} record${spec.count !== 1 ? "s" : ""}…`}
                </span>
              )}
            </td>
          </tr>
        );
      }

      // ── Detail Row ──
      if (spec.kind === "det") {
        const rowsToReturn = [];
        if (rowIdx === 0 || rowsToRender[rowIdx - 1].kind !== "det") {
          rowsToReturn.push(
            <tr key={`det-header-${isPrintView ? "print-" : ""}${rowIdx}`} className="cv-det-header">
              {visibleFieldOrder.map((f) => (
                <th key={`th-${f}`} className={`cv-subgroup-th ${numericFields.has(f) ? "cv-nr" : ""}`}>
                  {f.trim()}
                </th>
              ))}
            </tr>
          );
        }
        rowsToReturn.push(
          <tr
            key={`det-${isPrintView ? "print-" : ""}${rowIdx}`}
            className="cv-det"
          >
            {visibleFieldOrder.map((f) => (
              <td key={`td-${f}`} className={numericFields.has(f) ? "cv-nr" : ""}>
                {fmtCell(spec.row[f], f, prefixMap, suffixMap)}
              </td>
            ))}
          </tr>
        );
        return rowsToReturn;
      }

      // ── Subsummary Row ──
      const collapsed = isCollapsed(spec.groupId);
      const levelClass = spec.level >= 1 ? "cv-lv2" : "";

      // Nested mode carries pre-computed count; flat mode uses the in-memory rows.
      const count = spec.count ?? spec.rows.length;
      // A nested drillable leaf is an ss node with no rendered children/body rows.
      const isNestedDrillLeaf = isNested && spec.drillable === true;

      const displayTitle = spec.field.trim() === "_date_breakdown"
        ? spec.label
        : `${spec.field}: ${spec.label}`;

      const handleSsClick = () => {
        if (isPrintView) return;
        if (isNested) {
          // Mirror flat/FM mode: collapsed (or unloaded drillable leaf) → modal,
          // expanded non-leaf → collapse inline.
          if (collapsed || isNestedDrillLeaf) {
            handleDrillModal(spec.groupId, displayTitle, count, spec.totalFields);
          } else {
            toggleGroup(spec.groupId);
          }
          return;
        }
        // Flat mode: unchanged — data already in memory.
        if (collapsed) {
          setDrillModal({ title: displayTitle, rows: spec.rows, totalFields: spec.totalFields });
        } else {
          toggleGroup(spec.groupId);
        }
      };

      const handleSsChevronClick = (e: React.MouseEvent) => {
        if (isPrintView) return;
        e.stopPropagation();
        if (isNestedDrillLeaf) {
          void handleDrillInline(spec.groupId, count, spec.totalFields);
        } else {
          toggleGroup(spec.groupId);
        }
      };

      const ssItems = spec.totalFields
        .filter((tf) => visibleFieldOrder.some((f) => f.trim() === tf.trim() || f === tf))
        .map((tf) => {
          const f = visibleFieldOrder.find((vf) => vf.trim() === tf.trim() || vf === tf) ?? tf;
          // Nested mode: read the pre-computed total; flat mode: reduce the rows.
          const sum =
            spec.totals !== undefined
              ? spec.totals[tf] ?? spec.totals[tf.trim()] ?? spec.totals[f] ?? 0
              : spec.rows.reduce((s, r) => s + (parseFloat(String(r[f] ?? r[tf] ?? "")) || 0), 0);
          const value = showAvg && count > 0 ? sum / count : sum;
          const prefix = prefixMap[f] ?? prefixMap[tf] ?? prefixMap[tf.trim()] ?? "";
          const suffix = suffixMap[f] ?? suffixMap[tf] ?? suffixMap[tf.trim()] ?? "";
          return { tf, value, prefix, suffix };
        });

      return (
        <tr
          key={`ss-${isPrintView ? "print-" : ""}${spec.groupId}`}
          className={`cv-ss ${levelClass}`}
          onClick={handleSsClick}
          role={isPrintView ? undefined : "button"}
          tabIndex={isPrintView ? undefined : 0}
          aria-expanded={isPrintView ? undefined : !collapsed}
          onKeyDown={isPrintView ? undefined : (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSsClick(); }
          }}
        >
          <td colSpan={visibleFieldOrder.length}>
            <div className="cv-ss-row">
              <div className="cv-ss-label-side" style={spec.level > 0 ? { paddingLeft: `${spec.level * 18}px` } : undefined}>
                {!isPrintView && (
                  <span
                    className="cv-chv"
                    onClick={handleSsChevronClick}
                    title={collapsed ? "Expand group" : "Collapse group"}
                    style={{ cursor: "pointer", flexShrink: 0 }}
                  >
                    {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  </span>
                )}
                <span className="cv-ss-label-text">
                  {spec.field.trim() !== "_date_breakdown" && (
                    <><strong>{spec.field.trim()}:</strong>&nbsp;</>
                  )}
                  {spec.label}
                  {(collapsed || isNestedDrillLeaf) && (
                    <span style={{ color: "#78716c", fontWeight: "normal", fontSize: "11px", marginLeft: "6px" }}>
                      {isNested
                        ? `(${count} record${count !== 1 ? "s" : ""})`
                        : effectiveSubsummaries[spec.level + 1] ? (() => {
                            const nextField = effectiveSubsummaries[spec.level + 1].SubsummaryFields[0];
                            const countItems = new Set(spec.rows.map(r => String(r[nextField] ?? "").trim())).size;
                            return `(${countItems} ${nextField.trim()}${countItems !== 1 ? 's' : ''}, ${spec.rows.length} record${spec.rows.length !== 1 ? 's' : ''})`;
                          })() : `(${spec.rows.length} record${spec.rows.length !== 1 ? 's' : ''})`}
                    </span>
                  )}
                  {spec.displayFields.length > 0 && (
                    <div className="cv-disp-strip">
                      {spec.displayFields.map((df) => {
                        const dv = spec.displayValues[df];
                        const prefix = prefixMap[df] ?? "";
                        const suffix = suffixMap[df] ?? "";
                        const displayVal = dv !== undefined && dv !== null
                          ? `${prefix}${String(dv).trim()}${suffix}` : "—";
                        return (
                          <span key={df} className="cv-disp-item">
                            <span className="cv-disp-label">{df}:</span> {displayVal}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </span>
              </div>
              {ssItems.length > 0 && (
                <div className="cv-ss-total-side">
                  {ssItems.map(({ tf, value, prefix, suffix }) => (
                    <div key={tf} className="cv-ss-total-item">
                      <span className="cv-ss-total-field">{tf.trim()}</span>
                      <span className="cv-ss-total-value">{fmt(value, prefix, suffix)}</span>
                      {showAvg && <span className="cv-avg-line">avg</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      );
    });
  }, [
    grandTotals,
    grandTotalCount,
    showAvg,
    filteredBodyData,
    prefixMap,
    suffixMap,
    visibleFieldOrder,
    numericFields,
    isCollapsed,
    toggleGroup,
    setDrillModal,
    effectiveSubsummaries,
    isNested,
    handleDrillModal,
    groupCountInfo,
    onLoadMore,
    loadMoreLoading,
  ]);

  // ── Render subtotal cells ─────────────────────────────────────────────────
  function renderSubtotalCells(spec: Extract<RowSpec, { kind: "ss" }>) {
    const count = spec.rows.length;
    return visibleFieldOrder.slice(1).map((f) => {
      const trimmed = f.trim();
      if (spec.totalFields.includes(trimmed) || spec.totalFields.includes(f)) {
        const sum = spec.rows.reduce(
          (s, r) => s + (parseFloat(String(r[f] ?? "")) || 0),
          0
        );
        const value = showAvg && count > 0 ? sum / count : sum;
        const prefix = prefixMap[f] ?? prefixMap[trimmed] ?? "";
        const suffix = suffixMap[f] ?? suffixMap[trimmed] ?? "";
        return (
          <td key={f} className="cv-nr cv-amt">
            {fmt(value, prefix, suffix)}
            {showAvg && <span className="cv-avg-line">avg</span>}
          </td>
        );
      }
      return <td key={f} />;
    });
  }

  function renderGrandTotalCells() {
    const count = filteredBodyData.length;
    return visibleFieldOrder.slice(1).map((f) => {
      const trimmed = f.trim();
      if (trimmed in grandTotals) {
        const sum = grandTotals[trimmed];
        const value = showAvg && count > 0 ? sum / count : sum;
        const prefix = prefixMap[f] ?? prefixMap[trimmed] ?? "";
        const suffix = suffixMap[f] ?? suffixMap[trimmed] ?? "";
        return (
          <td key={f} className="cv-nr cv-amt">
            {fmt(value, prefix, suffix)}
            {showAvg && <span className="cv-avg-line">avg</span>}
          </td>
        );
      }
      return <td key={f} />;
    });
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  // Flat mode: empty when no body rows. Nested mode: empty when no groups.
  const hasContent = isNested
    ? !!nestedData && nestedData.groups.length > 0
    : bodyData.length > 0;
  if (!hasContent) {
    return (
      <div className="cv-wrap" style={{ padding: "32px", textAlign: "center", color: "#78716c" }}>
        No data available.
      </div>
    );
  }

  return (
    <div className="cv-wrap">
      {/* ── Report header ─────────────────────────────────────────────────── */}
      <div className="cv-report-header">
        {titleHeader ? (
          <>
            <h2 className="cv-title">{titleHeader.MainHeading}</h2>
            {titleHeader.SubHeading && (
              <div className="cv-subtitle">
                <span>{titleHeader.SubHeading}</span>
              </div>
            )}
          </>
        ) : (
          <h2 className="cv-title">Report</h2>
        )}
        {/* Date range + filter chips from metadata */}
        <div className="cv-meta-row">
          {metadata?.dateRange && (
            <span className="cv-meta-chip">
              <strong>
                {metadata.dateRange.field ? `${metadata.dateRange.field}: ` : "Date: "}
              </strong>
              {formatDisplayDate(metadata.dateRange.start)} — {formatDisplayDate(metadata.dateRange.end)}
            </span>
          )}
          {metadata?.filters?.map((f, i) => (
            <span key={i} className="cv-meta-chip">{f}</span>
          ))}
          <span className="cv-meta-chip">
            <strong>{grandTotalCount}</strong> record{grandTotalCount !== 1 ? "s" : ""}
          </span>
          {groupCountInfo?.capped && (
            <span className="cv-meta-chip text-slate-500">
              {groupCountInfo.label}:{" "}
              <strong className="text-slate-700">{groupCountInfo.loaded.toLocaleString()}</strong>
              {" of "}
              <strong className="text-slate-700">{groupCountInfo.total.toLocaleString()}</strong>
              {" groups"}
            </span>
          )}
          <span className="cv-meta-chip">
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          {paginate && totalPages > 1 && (
            <span className="no-print flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
              >
                <ChevronRight size={14} />
              </button>
            </span>
          )}
          <button
            onClick={handlePrint}
            className="no-print flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors ml-auto shadow-sm"
          >
            <Printer size={12} /> Print
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="cv-scroll-x">
        <table className="cv-table">
          <tbody>
            {renderTableRows(visibleRows, false)}
          </tbody>
        </table>
      </div>

      <div className="cv-foot flex items-center justify-between">
        <span>Classic View · {grandTotalCount} records</span>
      </div>

      {/* Hidden print area containing the entire table (all pages, but respecting collapsed/expanded states) */}
      <div id="classic-print-area" style={{ display: "none" }}>
        <table className="cv-table">
          <tbody>
            {renderTableRows(visibleRowsList, true)}
          </tbody>
        </table>
      </div>

      {/* ── Drill-down Modal ────────────────────────────────────────────────── */}
      {drillModal && (() => {
        // Nested mode uses the drill's own fieldOrder/totals; flat reuses report-level.
        const modalFieldOrder = drillModal.fieldOrder ?? fieldOrder;
        const modalNumeric =
          drillModal.fieldOrder
            ? (() => {
                const set = new Set<string>();
                const sample = drillModal.rows[0];
                for (const f of modalFieldOrder) {
                  const prefix = prefixMap[f] ?? "";
                  const v = sample?.[f];
                  if (prefix === "$" || /total|sum|price|cost|amount|qty|quantity/i.test(f)) {
                    set.add(f);
                  } else if (v !== undefined && !isNaN(parseFloat(String(v))) && String(v).trim() !== "") {
                    set.add(f);
                  }
                }
                return set;
              })()
            : numericFields;
        return (
          <DrillModal
            title={drillModal.title}
            rows={drillModal.rows}
            fieldOrder={modalFieldOrder}
            prefixMap={prefixMap}
            suffixMap={suffixMap}
            numericFields={modalNumeric}
            totalFields={drillModal.totalFields.length > 0 ? drillModal.totalFields : allTotalFields}
            totals={drillModal.totals}
            loading={drillModal.loading}
            error={drillModal.error}
            onClose={() => setDrillModal(null)}
          />
        );
      })()}
    </div>
  );
}
