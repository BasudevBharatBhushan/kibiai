"use client";

import { useState, useEffect, useRef } from "react";
import { Database } from "lucide-react";

export interface SqlStep {
  label: string;
  sql: string;
}

interface SqlExecutionFloaterProps {
  currentStep: SqlStep | null;
  isGenerating: boolean;
}

/** Minimal keyword-aware formatter — adds newlines before major SQL clauses. */
function formatSql(sql: string): string {
  return sql
    .replace(/\b(WITH)\s+/gi, "WITH ")
    .replace(/\b(SELECT)\b/gi, "\nSELECT")
    .replace(/\b(FROM)\b/gi, "\nFROM")
    .replace(/\b(LEFT\s+JOIN|INNER\s+JOIN|RIGHT\s+JOIN|JOIN)\b/gi, "\n$1")
    .replace(/\b(WHERE)\b/gi, "\nWHERE")
    .replace(/\b(GROUP\s+BY)\b/gi, "\nGROUP BY")
    .replace(/\b(ORDER\s+BY)\b/gi, "\nORDER BY")
    .replace(/\b(HAVING)\b/gi, "\nHAVING")
    .replace(/\b(LIMIT)\b/gi, "\nLIMIT")
    .replace(/\b(OFFSET)\b/gi, "\nOFFSET")
    .trim();
}

export function SqlExecutionFloater({ currentStep, isGenerating }: SqlExecutionFloaterProps) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFadeTimer = () => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  // Show immediately when a new step arrives
  useEffect(() => {
    if (currentStep) {
      clearFadeTimer();
      setVisible(true);
    }
  }, [currentStep]);

  // When generation finishes and user isn't hovering, start 3s countdown to hide
  useEffect(() => {
    if (!isGenerating && !hovered && visible) {
      clearFadeTimer();
      fadeTimerRef.current = setTimeout(() => setVisible(false), 3000);
    }
    return clearFadeTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, hovered]);

  // Cleanup on unmount
  useEffect(() => () => clearFadeTimer(), []);

  if (!currentStep) return null;

  const handleMouseEnter = () => {
    setHovered(true);
    clearFadeTimer();
    setVisible(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (!isGenerating) {
      clearFadeTimer();
      fadeTimerRef.current = setTimeout(() => setVisible(false), 3000);
    }
  };

  return (
    <div
      className="fixed right-4 top-1/3 z-40 w-[380px] transition-all duration-700 ease-in-out"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glass card */}
      <div
        className="rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: "rgba(10, 15, 30, 0.82)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}
        >
          <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
            <Database size={13} className="text-blue-400" />
            {isGenerating && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            )}
          </div>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">
            Executing SQL
          </span>
          <span
            className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd" }}
          >
            {currentStep.label}
          </span>
        </div>

        {/* SQL body */}
        <div className="p-3 max-h-52 overflow-y-auto custom-scrollbar">
          <pre
            className="text-[11px] leading-relaxed font-mono break-all whitespace-pre-wrap"
            style={{ color: "#6ee7b7" }}
          >
            {formatSql(currentStep.sql)}
          </pre>
        </div>

        {/* Footer pulse indicator */}
        {isGenerating && (
          <div
            className="px-3 py-1.5 flex items-center gap-1.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] tracking-wider text-slate-500 uppercase">Running</span>
          </div>
        )}
      </div>
    </div>
  );
}
