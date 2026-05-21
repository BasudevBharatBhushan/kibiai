"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import "@/styles/classicview.css";
import { ChevronDown, ChevronRight, X } from "lucide-react";
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

  // ── Hide subsummary group-by fields from the visible columns ─────────────
  // (same as the HTML reference: grouping fields are shown only in the subsummary
  //  label, not as redundant columns in the detail rows or header)
  const hiddenFields = useMemo(() => {
    const s = new Set<string>();
    for (const ss of subsummaries) {
      for (const f of ss.SubsummaryFields) {
        s.add(f.trim());
        s.add(f);
      }
    }
    return s;
  }, [subsummaries]);

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

  // ── All total fields across all subsummaries ──────────────────────────────
  const allTotalFields = useMemo(
    () => [...new Set(subsummaries.flatMap((ss) => ss.SubsummaryTotal ?? []))],
    [subsummaries]
  );


  // ── Filters — driven by parent (ClassicViewSettings) ─────────────────────
  const filteredBodyData = useMemo(() => {
    if (Object.keys(activeFiltersProp).length === 0) return bodyData;
    return bodyData.filter((row) =>
      Object.entries(activeFiltersProp).every(
        ([field, val]) => !val || String(row[field] ?? "").trim() === val
      )
    );
  }, [bodyData, activeFiltersProp]);

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
      if (ssLevel >= subsummaries.length) {
        return data.map((row) => ({ kind: "det" as const, groupId: parentId, row }));
      }
      const ss = subsummaries[ssLevel];
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
    [subsummaries]
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
  function isDetRowVisible(groupId: string): boolean {
    const parts = groupId.split("|");
    for (let i = 1; i <= parts.length; i++) {
      const ancestorId = parts.slice(0, i).join("|");
      if (isCollapsed(ancestorId)) return false;
    }
    return true;
  }

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
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="cv-scroll-x">
        <table className="cv-table">
          <thead>
            <tr>
              {visibleFieldOrder.map((f) => (
                <th key={f} className={numericFields.has(f) ? "cv-nr" : ""}>
                  {f.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((spec, rowIdx) => {
              // ── Grand Summary ──
              if (spec.kind === "gs") {
                // Build grand total display items
                const gtItems = Object.entries(grandTotals).map(([f, sum]) => {
                  const value = showAvg && filteredBodyData.length > 0 ? sum / filteredBodyData.length : sum;
                  const prefix = prefixMap[f] ?? prefixMap[f.trim()] ?? "";
                  const suffix = suffixMap[f] ?? suffixMap[f.trim()] ?? "";
                  return { f, value, prefix, suffix };
                });
                return (
                  <tr key="gs" className="cv-gs">
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
                const visible = isDetRowVisible(spec.groupId);
                return (
                  <tr
                    key={`det-${rowIdx}`}
                    className={`cv-det${visible ? "" : " cv-hidden"}`}
                  >
                    {visibleFieldOrder.map((f) => (
                      <td key={f} className={numericFields.has(f) ? "cv-nr" : ""}>
                        {fmtCell(spec.row[f], f, prefixMap, suffixMap)}
                      </td>
                    ))}
                  </tr>
                );
              }

              // ── Subsummary Row ──
              const collapsed = isCollapsed(spec.groupId);
              const levelClass = spec.level >= 1 ? "cv-lv2" : "";

              const handleSsClick = () => {
                if (collapsed) {
                  setDrillModal({ title: `${spec.field}: ${spec.label}`, rows: spec.rows, totalFields: spec.totalFields });
                } else {
                  toggleGroup(spec.groupId);
                }
              };

              const handleSsChevronClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                toggleGroup(spec.groupId);
              };

              // Build total items for this subsummary group
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
                  key={`ss-${spec.groupId}`}
                  className={`cv-ss ${levelClass}`}
                  onClick={handleSsClick}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!collapsed}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSsClick(); }
                  }}
                >
                  {/* Single colspan cell — label left, totals right */}
                  <td colSpan={visibleFieldOrder.length}>
                    <div className="cv-ss-row">
                      {/* Left: chevron + label */}
                      <div className="cv-ss-label-side">
                        <span
                          className="cv-chv"
                          onClick={handleSsChevronClick}
                          title={collapsed ? "Expand group" : "Collapse group"}
                          style={{ cursor: "pointer", flexShrink: 0 }}
                        >
                          {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                        </span>
                        <span className="cv-ss-label-text">
                          <strong>{spec.field.trim()}:</strong>&nbsp;{spec.label}
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
                      {/* Right: totals */}
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
            })}
          </tbody>
        </table>
      </div>

      <div className="cv-foot">Classic View · {filteredBodyData.length} records</div>

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
