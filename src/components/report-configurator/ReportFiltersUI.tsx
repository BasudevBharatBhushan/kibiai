import React, { useState } from "react";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Trash2, Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { FILTER_OPERATORS } from "@/constants/reportOptions";

export function parseSavedFilterValue(saved: string): { operator: string; value: string } {
  if (saved === '*' || saved === '=') return { operator: saved, value: '' };
  const multiCharOps = ['==', '!=', '>=', '<='];
  for (const op of multiCharOps) {
    if (saved.startsWith(op)) return { operator: op, value: saved.slice(op.length) };
  }
  const singleCharOps = ['>', '<'];
  for (const op of singleCharOps) {
    if (saved.startsWith(op)) return { operator: op, value: saved.slice(op.length) };
  }
  return { operator: '==', value: saved };
}

export interface AdHocFilter { id: string; table: string; field: string; operator: string; value: string; }

export function AdHocFilterBuilder({
  filters, onChange, options
}: { filters: AdHocFilter[]; onChange: (f: AdHocFilter[]) => void; options: any[] }) {
  const add = () => onChange([...filters, { id: Date.now().toString(), table: "", field: "", operator: "==", value: "" }]);
  const remove = (id: string) => onChange(filters.filter(f => f.id !== id));
  const update = (id: string, key: string, val: string) => {
    if (key === "field") {
      const opt = options.find(o => `${o.table}.${o.field}` === val);
      onChange(filters.map(f => f.id === id ? { ...f, table: opt?.table || "", field: opt?.field || "", operator: f.operator || "==" } : f));
    } else {
      onChange(filters.map(f => f.id === id ? { ...f, [key]: val } : f));
    }
  };

  return (
    <div className="space-y-2">
      {filters.map(f => (
        <div key={f.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Row 1: Field selector + delete */}
          <div className="flex gap-2 items-center">
            <select
              value={f.table && f.field ? `${f.table}.${f.field}` : ""}
              onChange={e => update(f.id, "field", e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white min-w-0"
            >
              <option value="">Select Field...</option>
              {options.map(opt => (
                <option key={`${opt.table}.${opt.field}`} value={`${opt.table}.${opt.field}`}>
                  {opt.label} ({opt.table})
                </option>
              ))}
            </select>
            <button onClick={() => remove(f.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 shrink-0">
              <Trash2 size={13} />
            </button>
          </div>
          {/* Row 2: Operator + Value */}
          <div className="flex gap-2 items-center">
            <select
              value={f.operator || "=="}
              onChange={e => update(f.id, "operator", e.target.value)}
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              {FILTER_OPERATORS.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <input
              placeholder="Value..."
              value={f.value}
              onChange={e => update(f.id, "value", e.target.value)}
              disabled={["*", "="].includes(f.operator)}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium disabled:opacity-40 disabled:bg-slate-50 min-w-0"
            />
          </div>
        </div>
      ))}
      <button onClick={add}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors mt-1">
        <Plus size={12} /> Add Filter
      </button>
    </div>
  );
}

export interface AdHocDateRange { id: string; table: string; field: string; from: string; to: string; }

export function AdHocDateRangeBuilder({
  ranges, onChange, options
}: { ranges: AdHocDateRange[]; onChange: (r: AdHocDateRange[]) => void; options: any[] }) {
  const usedKeys = new Set(ranges.map(r => r.table && r.field ? `${r.table}.${r.field}` : null).filter(Boolean));

  const add = () => onChange([...ranges, { id: Date.now().toString(), table: "", field: "", from: "", to: "" }]);
  const remove = (id: string) => onChange(ranges.filter(r => r.id !== id));
  const update = (id: string, key: string, val: any) => {
    if (key === "field") {
      const opt = options.find(o => `${o.table}.${o.field}` === val);
      onChange(ranges.map(r => r.id === id ? { ...r, table: opt?.table || "", field: opt?.field || "" } : r));
    } else if (key === "range") {
      onChange(ranges.map(r => r.id === id ? { ...r, from: val.from, to: val.to } : r));
    }
  };

  return (
    <div className="space-y-3">
      {ranges.map(r => {
        const currentKey = r.table && r.field ? `${r.table}.${r.field}` : null;
        const available = options.filter(o => {
          const k = `${o.table}.${o.field}`;
          return o.type === "date" && (!usedKeys.has(k) || k === currentKey);
        });
        return (
          <div key={r.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 relative group animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => remove(r.id)} className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-200 text-slate-300 hover:text-red-500 transition-all rounded-full shadow-sm z-10 hover:scale-110 active:scale-95">
              <X size={12} />
            </button>
            <div className="space-y-2">
              <select
                value={r.table && r.field ? `${r.table}.${r.field}` : ""}
                onChange={e => update(r.id, "field", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-bold text-slate-700"
              >
                <option value="">Select Date Field...</option>
                {available.map(opt => (
                  <option key={`${opt.table}.${opt.field}`} value={`${opt.table}.${opt.field}`}>
                    {opt.label} ({opt.table})
                  </option>
                ))}
              </select>
              <DateRangePicker
                value={{ from: r.from, to: r.to }}
                onChange={v => update(r.id, "range", v)}
              />
            </div>
          </div>
        );
      })}
      <button onClick={add}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors mt-1">
        <Plus size={12} /> Add Date Range
      </button>
    </div>
  );
}

export function CollapsibleSection({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
          {icon}{title}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}
