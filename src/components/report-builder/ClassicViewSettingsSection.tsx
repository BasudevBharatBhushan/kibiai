"use client";

import React from "react";
import { LayoutList } from "lucide-react";

export interface ClassicViewSettings {
  showAvg: boolean;
  collapseBody: boolean;
  paginate: boolean;
  dateBreakdown?: { field: string; interval: "Month" | "Quarter" };
}

export interface FilterField {
  field: string;
  options: string[];
}

interface ClassicViewSettingsSectionProps {
  settings: ClassicViewSettings;
  onChange: (key: keyof ClassicViewSettings, value: boolean) => void;
  /** Filter fields computed from live report data, provided by ConfiguratorPageContent */
  filterFields?: FilterField[];
  /** Date fields computed from live report data */
  dateFields?: Array<{ value: string; label: string }>;
  /** Current active filter selections */
  activeFilters?: Record<string, string>;
  /** Called when user changes a filter value */
  onFilterChange?: (field: string, value: string) => void;
}

export function ClassicViewSettingsSection({
  settings,
  onChange,
  filterFields = [],
  dateFields = [],
  activeFilters = {},
  onFilterChange,
}: ClassicViewSettingsSectionProps) {
  const activeCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header — legacy blue to match the configurator theme */}
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-100">
        <LayoutList size={14} className="text-blue-600 shrink-0" />
        <span className="text-slate-700 font-semibold text-xs uppercase tracking-wider">
          Classic View Settings
        </span>
        {activeCount > 0 && (
          <span className="ml-auto text-[10px] font-bold text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">
            {activeCount} filter{activeCount !== 1 ? "s" : ""} active
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-4">

        {/* Show Average in Subtotals */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.showAvg}
              onChange={(e) => onChange("showAvg", e.target.checked)}
            />
            <div className="w-8 h-[18px] rounded-full bg-slate-200 peer-checked:bg-[#2563eb] transition-colors" />
            <div className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900 leading-tight">
              Show Average in Subtotals
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
              Displays <code className="bg-slate-100 px-1 rounded text-[9px]">avg</code> instead of sum in group total cells.
            </p>
          </div>
        </label>

        {/* Collapse Body on Load */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.collapseBody}
              onChange={(e) => onChange("collapseBody", e.target.checked)}
            />
            <div className="w-8 h-[18px] rounded-full bg-slate-200 peer-checked:bg-[#2563eb] transition-colors" />
            <div className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900 leading-tight">
              Collapse Body by Default
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
              Hides detail rows on load. Click any group row to drill down.
            </p>
          </div>
        </label>

        {/* Paginate Classic View */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.paginate}
              onChange={(e) => onChange("paginate", e.target.checked)}
            />
            <div className="w-8 h-[18px] rounded-full bg-slate-200 peer-checked:bg-[#2563eb] transition-colors" />
            <div className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900 leading-tight">
              Paginate Classic View
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
              Splits rows into manageable pages. Default is off.
            </p>
          </div>
        </label>

        {/* Date Breakdown */}
        {dateFields.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Date Breakdown
              </span>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={settings.dateBreakdown?.field ?? ""}
                  onChange={(e) => {
                    const field = e.target.value;
                    if (!field) {
                      const newSettings = { ...settings };
                      delete newSettings.dateBreakdown;
                      onChange("dateBreakdown" as keyof ClassicViewSettings, newSettings.dateBreakdown as any);
                    } else {
                      onChange("dateBreakdown" as keyof ClassicViewSettings, {
                        field,
                        interval: settings.dateBreakdown?.interval ?? "Month"
                      } as any);
                    }
                  }}
                  className={`w-full text-[11px] font-medium border rounded-lg px-2.5 py-1.5 bg-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    settings.dateBreakdown?.field ? "border-blue-400 text-blue-800 bg-blue-50" : "border-slate-200 text-slate-700"
                  }`}
                >
                  <option value="">None</option>
                  {dateFields.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>

                <select
                  disabled={!settings.dateBreakdown?.field}
                  value={settings.dateBreakdown?.interval ?? "Month"}
                  onChange={(e) => {
                    if (settings.dateBreakdown?.field) {
                      onChange("dateBreakdown" as keyof ClassicViewSettings, {
                        field: settings.dateBreakdown.field,
                        interval: e.target.value as "Month" | "Quarter"
                      } as any);
                    }
                  }}
                  className={`w-full text-[11px] font-medium border rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    !settings.dateBreakdown?.field ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" : "bg-white border-slate-200 text-slate-700"
                  }`}
                >
                  <option value="Month">Month</option>
                  <option value="Quarter">Quarter</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Quick Filters — rendered when report data is available */}
        {filterFields.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Quick Filters
              </span>
              {activeCount > 0 && (
                <button
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  onClick={() => filterFields.forEach((ff) => onFilterChange?.(ff.field, ""))}
                >
                  Reset all
                </button>
              )}
            </div>
            <div className="space-y-2">
              {filterFields.map((ff) => (
                <div key={ff.field} className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-600">
                    {ff.field}
                  </label>
                  <select
                    value={activeFilters[ff.field] ?? ""}
                    onChange={(e) => onFilterChange?.(ff.field, e.target.value)}
                    className={`w-full text-[11px] font-medium border rounded-lg px-2.5 py-1.5 bg-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      activeFilters[ff.field]
                        ? "border-blue-400 text-blue-800 bg-blue-50"
                        : "border-slate-200 text-slate-700"
                    }`}
                  >
                    <option value="">All</option>
                    {ff.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
