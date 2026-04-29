"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DateRangePickerProps {
  value: { from: string; to: string };
  onChange: (v: { from: string; to: string }) => void;
  label?: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt(d: Date) { return `${pad(d.getMonth()+1)}/${pad(d.getDate())}/${d.getFullYear()}`; }
function parse(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[1]-1, +m[2]);
  return isNaN(d.getTime()) ? null : d;
}

function CalendarPanel({ year, month, onPrev, onNext, selectedDate, onDay }: {
  year: number; month: number;
  onPrev: () => void; onNext: () => void;
  selectedDate: Date|null;
  onDay: (d: Date) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (Date|null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));

  return (
    <div className="select-none" style={{ width: 196 }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <button type="button" onClick={(e) => { e.stopPropagation(); onPrev(); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft size={14}/></button>
        <span className="text-xs font-bold text-slate-700">{MONTHS[month]} {year}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onNext(); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight size={14}/></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const ts = d.getTime();
          const isSelected = selectedDate && ts === selectedDate.getTime();
          return (
            <button type="button" key={ts}
              onClick={(e) => { e.stopPropagation(); onDay(d); }}
              className={[
                "h-7 w-7 mx-auto flex items-center justify-center text-[11px] transition-all",
                isSelected ? "bg-blue-600 text-white font-bold rounded-full" : "hover:bg-slate-100 text-slate-700 rounded-full"
              ].join(" ")}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SingleDatePicker({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [popCoords, setPopCoords] = useState({ top: 0, left: 0 });

  const date = parse(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(date?.getFullYear() || today.getFullYear());
  const [viewMonth, setViewMonth] = useState(date?.getMonth() || today.getMonth());

  useEffect(() => {
    setInputValue(value);
    if (value && !parse(value)) {
       // Only set error if it's not empty and not valid
    } else {
       setError(null);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const navMonth = (delta: number) => {
    let nm = viewMonth + delta, ny = viewYear;
    if (nm > 11) { nm = 0; ny++; }
    else if (nm < 0) { nm = 11; ny--; }
    setViewYear(ny);
    setViewMonth(nm);
  };

  const handleOpen = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPopCoords({ top: r.bottom + 6, left: r.left });
    }
    setOpen(true);
  };

  const handleDay = (d: Date) => {
    const s = fmt(d);
    setInputValue(s);
    setError(null);
    onChange(s);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    // On every keystroke, if it's a valid date, we propagate it.
    // But we don't show error yet.
    if (parse(v)) {
      setError(null);
      onChange(v);
    }
  };

  const handleBlur = () => {
    if (inputValue && !parse(inputValue)) {
      setError("Invalid date format (MM/DD/YYYY)");
    } else {
      setError(null);
      onChange(inputValue);
    }
  };

  return (
    <div className="relative flex-1" ref={triggerRef}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300 ${
            error ? "border-red-400 bg-red-50/30" : "border-slate-200"
          }`}
        />
        <Calendar 
          size={14} 
          onClick={handleOpen}
          className={`absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors ${
            error ? "text-red-400" : "text-slate-400 hover:text-blue-500"
          }`} 
        />
        {error && (
          <div className="absolute top-full left-0 mt-1 text-[9px] font-bold text-red-500 bg-white/80 px-1 rounded backdrop-blur-sm z-10 animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}
      </div>

      {open && typeof window !== "undefined" && (
        <div
          ref={popRef}
          style={{ position: "fixed", top: popCoords.top, left: popCoords.left, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-4"
        >
          <CalendarPanel 
            year={viewYear} month={viewMonth}
            onPrev={() => navMonth(-1)} onNext={() => navMonth(1)}
            selectedDate={date}
            onDay={handleDay} 
          />
        </div>
      )}
    </div>
  );
}

export function DateRangePicker({ value, onChange, label }: DateRangePickerProps) {
  const handleFromChange = (from: string) => onChange({ ...value, from });
  const handleToChange = (to: string) => onChange({ ...value, to });

  return (
    <div className="space-y-1.5 pb-2">
      {label && <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        <SingleDatePicker value={value.from} onChange={handleFromChange} placeholder="From" />
        <span className="text-slate-300 text-xs">—</span>
        <SingleDatePicker value={value.to} onChange={handleToChange} placeholder="To" />
        {(value.from || value.to) && (
          <button 
            type="button"
            onClick={() => onChange({ from: "", to: "" })}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

