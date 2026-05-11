'use client';

import React from 'react';
import { FiCalendar, FiFilter } from 'react-icons/fi';

type DateRange = {
  field?: string;
  start: string;
  end: string;
};

type Props = {
  dateRange?: DateRange;
  filters?: string[];
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

export function CardScopeMeta({ dateRange, filters }: Props) {
  const hasDates = !!(dateRange?.start && dateRange?.end);
  const visibleFilters = (filters ?? []).filter(Boolean);
  const hasFilters = visibleFilters.length > 0;

  if (!hasDates && !hasFilters) return null;

  const prettyFilters = visibleFilters.map(prettifyRule);
  const filterSummary = prettyFilters.join(' · ');

  return (
    <div className="flex items-center gap-2 mt-0.5 text-[11px] leading-tight text-slate-500 font-medium min-w-0">
      {hasDates && (
        <span
          className="inline-flex items-center gap-1 shrink-0"
          title={
            dateRange?.field
              ? `Report data window: ${formatDate(dateRange!.start)} to ${formatDate(dateRange!.end)} (${dateRange.field})`
              : `Report data window: ${formatDate(dateRange!.start)} to ${formatDate(dateRange!.end)}`
          }
        >
          <FiCalendar size={10} className="text-slate-400" />
          <span>
            {formatDate(dateRange!.start)} — {formatDate(dateRange!.end)}
          </span>
          {dateRange?.field && (
            <span className="text-slate-400">({dateRange.field})</span>
          )}
        </span>
      )}

      {hasDates && hasFilters && (
        <span className="text-slate-300" aria-hidden="true">·</span>
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
    </div>
  );
}
