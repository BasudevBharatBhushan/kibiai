'use client';

import React from 'react';
import { FiCalendar, FiFilter, FiZap } from 'react-icons/fi';

type DateRange = {
  field?: string;
  start: string;
  end: string;
};

type Props = {
  dateRange?: DateRange;
  filters?: string[];
  computedFields?: Array<{ name: string; formula: string }>;
};

function formatDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${m}-${d}-${y}`;
}

function prettifyRule(rule: string): string {
  const [rawField, rawCondition] = rule.split(':').map(s => s.trim());
  if (!rawCondition) return rule;
  const field = rawField.includes('::') ? rawField.split('::').pop()! : rawField;

  if (rawCondition === 'notEmpty') return `${field} (not empty)`;
  if (rawCondition === 'empty') return `${field} (empty)`;

  const opMatch = rawCondition.match(/^(>=|<=|>|<|==)(.*)$/);
  if (opMatch) {
    const op = opMatch[1] === '==' ? '=' : opMatch[1];
    return `${field} ${op} ${opMatch[2].trim()}`;
  }
  return `${field}: ${rawCondition}`;
}

export function CardScopeMeta({ dateRange, filters, computedFields }: Props) {
  const hasDates = !!(dateRange?.start && dateRange?.end);
  const visibleFilters = (filters ?? []).filter(Boolean);
  const hasFilters = visibleFilters.length > 0;
  const hasComputed = (computedFields ?? []).length > 0;

  if (!hasDates && !hasFilters && !hasComputed) return null;

  const prettyFilters = visibleFilters.map(prettifyRule);
  const filterSummary = prettyFilters.join(' · ');

  return (
    <div className="flex items-center gap-2 mt-0.5 text-[11px] leading-tight text-slate-500 font-medium min-w-0">
      {hasDates && (
        <span
          className="inline-flex items-center shrink-0 cursor-default"
          title={
            dateRange?.field
              ? `Report window: ${formatDate(dateRange!.start)} → ${formatDate(dateRange!.end)} (${dateRange.field})`
              : `Report window: ${formatDate(dateRange!.start)} → ${formatDate(dateRange!.end)}`
          }
        >
          <FiCalendar size={10} className="text-slate-400" />
        </span>
      )}

      {hasFilters && (
        <span
          className="inline-flex items-center gap-1 min-w-0"
          title={`Filters: ${filterSummary}`}
        >
          <FiFilter size={10} className="text-slate-400 shrink-0" />
          <span className="truncate">{filterSummary}</span>
        </span>
      )}

      {hasComputed && (
        <span
          className="inline-flex items-center gap-1 min-w-0"
          title={computedFields!.map(cf => `${cf.name} = ${cf.formula}`).join(' · ')}
        >
          <FiZap size={10} className="text-violet-400 shrink-0" />
          <span className="truncate text-violet-500">
            {computedFields!.map(cf => cf.name).join(', ')}
          </span>
        </span>
      )}
    </div>
  );
}
