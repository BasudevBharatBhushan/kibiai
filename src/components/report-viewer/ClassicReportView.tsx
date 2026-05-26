"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import "@/styles/classicview.css";
import { ChevronDown, ChevronRight, X, Printer, ChevronLeft } from "lucide-react";
import type { ReportMetadata } from "@/lib/utils/reportMetadata";
import { formatDisplayDate } from "@/lib/utils/reportMetadata";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
  const num = parseFloat(s);
  if (!isNaN(num) && (prefix === "$" || /total|sum|price|cost|amount/i.test(field))) {
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

  // Compute footers (totals for numeric/total columns)
  const footerTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const f of totalFields) {
      t[f.trim()] = rows.reduce((s, r) => s + (parseFloat(String(r[f.trim()] ?? "")) || 0), 0);
    }
    return t;
  }, [totalFields, rows]);

  const footerEntries = Object.entries(footerTotals);

  return (
    <div className="cv-dd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cv-dd-card">
        {/* Header */}
        <div className="cv-dd-head">
          <div>
            <p className="cv-dd-title">{title}</p>
            <div className="cv-dd-meta">
              <span><strong>{rows.length}</strong> record{rows.length !== 1 ? "s" : ""}</span>
              {footerEntries.map(([f, v]) => {
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
          {rows.length === 0 ? (
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
        {footerEntries.length > 0 && (
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
}: ClassicReportViewProps) {
  // ── Parse JSON structure ──────────────────────────────────────────────────
  const titleHeader = useMemo(
    () => jsonData.find((x) => "TitleHeader" in x)?.TitleHeader,
    [jsonData]
  );
  const bodyItem = useMemo(() => jsonData.find((x) => "Body" in x)?.Body, [jsonData]);
  const bodyData: Record<string, unknown>[] = useMemo(() => bodyItem?.BodyField ?? [], [bodyItem]);
  const fieldOrder: string[] = useMemo(
    () => bodyItem?.BodyFieldOrder ?? Object.keys(bodyData[0] ?? {}),
    [bodyItem, bodyData]
  );
  const prefixMap: Record<string, string> = useMemo(() => bodyItem?.FieldPrefix ?? {}, [bodyItem]);
  const suffixMap: Record<string, string> = useMemo(() => bodyItem?.FieldSuffix ?? {}, [bodyItem]);

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
  const numericFields = useMemo(() => {
    const set = new Set<string>();
    if (bodyData.length === 0) return set;
    const sample = bodyData[0];
    for (const f of fieldOrder) {
      const v = sample[f];
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
  }, [bodyData, visibleFieldOrder, fieldOrder, prefixMap]);

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

  // ── Collapse state ────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const prevCollapseBody = React.useRef(collapseBody);
  if (prevCollapseBody.current !== collapseBody) {
    prevCollapseBody.current = collapseBody;
    setCollapsedGroups(new Set());
  }

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

  // ── Drill-down state ──────────────────────────────────────────────────────
  const [drillModal, setDrillModal] = useState<{
    title: string;
    rows: Record<string, unknown>[];
    totalFields: string[];
  } | null>(null);

  // ── Grand totals ──────────────────────────────────────────────────────────
  const grandTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const f of trailingSummaryFields) {
      totals[f.trim()] = filteredBodyData.reduce(
        (s, r) => s + (parseFloat(String(r[f.trim()] ?? "")) || 0),
        0
      );
    }
    return totals;
  }, [trailingSummaryFields, filteredBodyData]);

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
      }
    | { kind: "det"; groupId: string; row: Record<string, unknown> }
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

  const rows = useMemo(() => {
    if (!filteredBodyData.length) return [];
    const allRows = buildRows(filteredBodyData, 0, "root");
    if (trailingSummaryFields.length > 0) {
      allRows.push({ kind: "gs" });
    }
    return allRows;
  }, [filteredBodyData, buildRows, trailingSummaryFields]);

  // ── Visibility helper ─────────────────────────────────────────────────────
  const isRowVisible = useCallback(
    (spec: RowSpec): boolean => {
      if (spec.kind === "gs") return true;
      const groupId = spec.groupId;
      const parts = groupId.split("|");
      // For detail rows, groupId is the parent's group ID, so we check all ancestors.
      // For subsummary rows, groupId is the row's own group ID, so we check ancestors excluding the last part (itself).
      const checkLimit = spec.kind === "det" ? parts.length : parts.length - 1;
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
  }, [filteredBodyData, paginate, dateBreakdown, collapsedGroups]);

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
          const value = showAvg && filteredBodyData.length > 0 ? sum / filteredBodyData.length : sum;
          const prefix = prefixMap[f] ?? prefixMap[f.trim()] ?? "";
          const suffix = suffixMap[f] ?? suffixMap[f.trim()] ?? "";
          return { f, value, prefix, suffix };
        });
        return (
          <tr key={`gs-${isPrintView ? "print" : "normal"}`} className="cv-gs">
            <td colSpan={visibleFieldOrder.length}>
              <div className="cv-ss-row">
                <div className="cv-ss-label-side">
                  <span className="cv-ss-label-text">
                    Grand Total ({filteredBodyData.length} record{filteredBodyData.length !== 1 ? "s" : ""})
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

      const handleSsClick = () => {
        if (isPrintView) return;
        if (collapsed) {
          setDrillModal({ title: `${spec.field}: ${spec.label}`, rows: spec.rows, totalFields: spec.totalFields });
        } else {
          toggleGroup(spec.groupId);
        }
      };

      const handleSsChevronClick = (e: React.MouseEvent) => {
        if (isPrintView) return;
        e.stopPropagation();
        toggleGroup(spec.groupId);
      };

      const count = spec.rows.length;
      const ssItems = spec.totalFields
        .filter((tf) => visibleFieldOrder.some((f) => f.trim() === tf.trim() || f === tf))
        .map((tf) => {
          const f = visibleFieldOrder.find((vf) => vf.trim() === tf.trim() || vf === tf) ?? tf;
          const sum = spec.rows.reduce((s, r) => s + (parseFloat(String(r[f] ?? r[tf] ?? "")) || 0), 0);
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
              <div className="cv-ss-label-side">
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
                  {collapsed && (
                    <span style={{ color: "#78716c", fontWeight: "normal", fontSize: "11px", marginLeft: "6px" }}>
                      {effectiveSubsummaries[spec.level + 1] ? (() => {
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
  if (!bodyData.length) {
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
            <strong>{filteredBodyData.length}</strong> record{filteredBodyData.length !== 1 ? "s" : ""}
          </span>
          <span className="cv-meta-chip">
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <button 
            onClick={handlePrint}
            className="no-print flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors ml-auto shadow-sm"
          >
            <Printer size={12} /> Print
          </button>
        </div>
        {paginate && totalPages > 1 && (
          <div className="flex items-center gap-2 mt-3 no-print justify-end">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-semibold text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
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
        <span>Classic View · {filteredBodyData.length} records</span>
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
      {drillModal && (
        <DrillModal
          title={drillModal.title}
          rows={drillModal.rows}
          fieldOrder={fieldOrder}
          prefixMap={prefixMap}
          suffixMap={suffixMap}
          numericFields={numericFields}
          totalFields={drillModal.totalFields.length > 0 ? drillModal.totalFields : allTotalFields}
          onClose={() => setDrillModal(null)}
        />
      )}
    </div>
  );
}
