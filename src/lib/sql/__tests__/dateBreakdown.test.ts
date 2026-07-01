/**
 * T-052 — Date Breakdown SQL feature: unit tests for pure utility functions.
 *
 * Coverage:
 *   1. buildBucketExpr — Month and Quarter expressions
 *   2. formatBucketLabel — raw key → human-readable label
 *   3. parseBucketLabel — human-readable label → raw key (round-trip)
 *   4. effectiveGroupLevels — prepends synthetic level when breakdown active
 *   5. syntheticGroupLevel — builds the synthetic GroupByField
 *   6. isSyntheticBreakdownField — predicate for identifying synthetic fields
 *
 * Run:
 *   npx vitest run src/lib/sql/__tests__/dateBreakdown.test.ts
 */

import { describe, it, expect } from 'vitest';

import {
  buildBucketExpr,
  formatBucketLabel,
  parseBucketLabel,
  effectiveGroupLevels,
  syntheticGroupLevel,
  isSyntheticBreakdownField,
  BREAKDOWN_TABLE,
  BREAKDOWN_FIELD,
  type DateBreakdown,
} from '@/lib/sql/dateBreakdown';

import type { ReportConfig } from '@/lib/reportConfigTypes';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal ReportConfig for testing date breakdown integration.
 * Single table, one group field, one summary field.
 */
const MINIMAL_CONFIG: ReportConfig = {
  report_header: 'Test Report',
  response_to_user: '',
  db_defination: [
    {
      primary_table: 'Orders',
      joined_table: '',
      source: '',
      target: '',
      join_type: 'inner',
      fetch_order: 1,
    },
  ],
  report_columns: [
    { table: 'Orders', field: 'Date' },
    { table: 'Orders', field: 'Amount' },
  ],
  group_by_fields: {
    level0: {
      table: 'Orders',
      field: 'Category',
      sort_order: 'asc',
      display: [],
      group_total: [{ table: 'Orders', field: 'Amount' }],
    },
  },
  filters: {},
  date_range_fields: {},
  body_sort_order: [],
  summary_fields: ['Amount'],
  custom_calculated_fields: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. buildBucketExpr — SQL bucket expression generation
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildBucketExpr — Month interval', () => {
  it('produces a strftime expression with %Y-%m pattern', () => {
    const result = buildBucketExpr('SomeCol', 'Month');
    expect(result).toContain("strftime('%Y-%m'");
    expect(result).toContain('SomeCol');
  });

  it('wraps the column reference in the strftime call', () => {
    const result = buildBucketExpr('MyDate', 'Month');
    expect(result).toContain("strftime('%Y-%m', MyDate)");
  });

  it('handles a complex column expression', () => {
    const complexExpr = 'CASE WHEN x > 5 THEN y ELSE z END';
    const result = buildBucketExpr(complexExpr, 'Month');
    expect(result).toContain(complexExpr);
    expect(result).toContain("strftime('%Y-%m'");
  });
});

describe('buildBucketExpr — Quarter interval', () => {
  it('produces an expression with year, -Q, and quarter math', () => {
    const result = buildBucketExpr('SomeCol', 'Quarter');
    expect(result).toContain("strftime('%Y'");
    expect(result).toContain("'-Q'");
    expect(result).toContain('/ 3');
  });

  it('includes the (month + 2) / 3 quarter computation', () => {
    const result = buildBucketExpr('SomeCol', 'Quarter');
    expect(result).toContain("strftime('%m'");
    expect(result).toContain('+ 2');
  });

  it('wraps the column reference properly in the strftime calls', () => {
    const result = buildBucketExpr('DateCol', 'Quarter');
    expect(result).toContain('DateCol');
    // Should appear multiple times in the two strftime calls
    const count = (result.match(/DateCol/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. formatBucketLabel — Raw key → human-readable label
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatBucketLabel — Month format', () => {
  it('converts 2025-01 to January 2025', () => {
    const result = formatBucketLabel('2025-01', 'Month');
    expect(result).toBe('January 2025');
  });

  it('converts 2025-12 to December 2025', () => {
    const result = formatBucketLabel('2025-12', 'Month');
    expect(result).toBe('December 2025');
  });

  it('converts 2023-06 to June 2023', () => {
    const result = formatBucketLabel('2023-06', 'Month');
    expect(result).toBe('June 2023');
  });

  it('returns the input unchanged for non-matching patterns', () => {
    const result = formatBucketLabel('bad-data', 'Month');
    expect(result).toBe('bad-data');
  });

  it('returns the input unchanged for invalid month number', () => {
    const result = formatBucketLabel('2025-13', 'Month');
    expect(result).toBe('2025-13');
  });
});

describe('formatBucketLabel — Quarter format', () => {
  it('converts 2025-Q1 to Q1 2025', () => {
    const result = formatBucketLabel('2025-Q1', 'Quarter');
    expect(result).toBe('Q1 2025');
  });

  it('converts 2025-Q3 to Q3 2025', () => {
    const result = formatBucketLabel('2025-Q3', 'Quarter');
    expect(result).toBe('Q3 2025');
  });

  it('converts 2024-Q4 to Q4 2024', () => {
    const result = formatBucketLabel('2024-Q4', 'Quarter');
    expect(result).toBe('Q4 2024');
  });

  it('returns the input unchanged for non-matching patterns', () => {
    const result = formatBucketLabel('2025-Q5', 'Quarter');
    expect(result).toBe('2025-Q5');
  });

  it('returns the input unchanged for malformed quarter', () => {
    const result = formatBucketLabel('bad-q1', 'Quarter');
    expect(result).toBe('bad-q1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. parseBucketLabel — Human-readable label → raw key (inverse of format)
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseBucketLabel — Month round-trip', () => {
  it('parses January 2025 to 2025-01', () => {
    const result = parseBucketLabel('January 2025', 'Month');
    expect(result).toBe('2025-01');
  });

  it('parses December 2025 to 2025-12', () => {
    const result = parseBucketLabel('December 2025', 'Month');
    expect(result).toBe('2025-12');
  });

  it('parses June 2023 to 2023-06', () => {
    const result = parseBucketLabel('June 2023', 'Month');
    expect(result).toBe('2023-06');
  });

  it('returns already-raw keys unchanged (2025-01 → 2025-01)', () => {
    const result = parseBucketLabel('2025-01', 'Month');
    expect(result).toBe('2025-01');
  });

  it('returns unrecognized input unchanged', () => {
    const result = parseBucketLabel('garbage', 'Month');
    expect(result).toBe('garbage');
  });

  it('round-trips: format then parse returns original raw key', () => {
    const raw = '2025-01';
    const formatted = formatBucketLabel(raw, 'Month');
    const parsed = parseBucketLabel(formatted, 'Month');
    expect(parsed).toBe(raw);
  });
});

describe('parseBucketLabel — Quarter round-trip', () => {
  it('parses Q1 2025 to 2025-Q1', () => {
    const result = parseBucketLabel('Q1 2025', 'Quarter');
    expect(result).toBe('2025-Q1');
  });

  it('parses Q3 2025 to 2025-Q3', () => {
    const result = parseBucketLabel('Q3 2025', 'Quarter');
    expect(result).toBe('2025-Q3');
  });

  it('parses Q4 2024 to 2024-Q4', () => {
    const result = parseBucketLabel('Q4 2024', 'Quarter');
    expect(result).toBe('2024-Q4');
  });

  it('returns already-raw keys unchanged (2025-Q1 → 2025-Q1)', () => {
    const result = parseBucketLabel('2025-Q1', 'Quarter');
    expect(result).toBe('2025-Q1');
  });

  it('returns unrecognized input unchanged', () => {
    const result = parseBucketLabel('garbage', 'Quarter');
    expect(result).toBe('garbage');
  });

  it('round-trips: format then parse returns original raw key', () => {
    const raw = '2025-Q3';
    const formatted = formatBucketLabel(raw, 'Quarter');
    const parsed = parseBucketLabel(formatted, 'Quarter');
    expect(parsed).toBe(raw);
  });
});

describe('parseBucketLabel — case-insensitive month parsing', () => {
  it('parses lowercase january to 2025-01', () => {
    const result = parseBucketLabel('january 2025', 'Month');
    expect(result).toBe('2025-01');
  });

  it('parses mixed-case February to 2025-02', () => {
    const result = parseBucketLabel('February 2023', 'Month');
    expect(result).toBe('2023-02');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. syntheticGroupLevel — Builds the synthetic GroupByField
// ═══════════════════════════════════════════════════════════════════════════════

describe('syntheticGroupLevel', () => {
  it('returns a GroupByField with BREAKDOWN_TABLE and BREAKDOWN_FIELD', () => {
    const level = syntheticGroupLevel(MINIMAL_CONFIG);
    expect(level.table).toBe(BREAKDOWN_TABLE);
    expect(level.field).toBe(BREAKDOWN_FIELD);
  });

  it('has sort_order asc', () => {
    const level = syntheticGroupLevel(MINIMAL_CONFIG);
    expect(level.sort_order).toBe('asc');
  });

  it('has empty display array', () => {
    const level = syntheticGroupLevel(MINIMAL_CONFIG);
    expect(level.display).toEqual([]);
  });

  it('populates group_total from config.summary_fields', () => {
    const level = syntheticGroupLevel(MINIMAL_CONFIG);
    // MINIMAL_CONFIG has summary_fields: ['Amount']
    // The synthetic level should resolve this to {table: 'Orders', field: 'Amount'}
    expect(level.group_total.length).toBeGreaterThan(0);
    expect(level.group_total).toContainEqual({ table: 'Orders', field: 'Amount' });
  });

  it('returns empty group_total when config has no summary_fields', () => {
    const config: ReportConfig = {
      ...MINIMAL_CONFIG,
      summary_fields: [],
    };
    const level = syntheticGroupLevel(config);
    expect(level.group_total).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. effectiveGroupLevels — Synthesizes the effective stack
// ═══════════════════════════════════════════════════════════════════════════════

describe('effectiveGroupLevels — without breakdown', () => {
  it('returns the real group_by_fields unchanged when no breakdown', () => {
    const levels = effectiveGroupLevels(MINIMAL_CONFIG);
    // MINIMAL_CONFIG has one real group level: level0
    expect(levels.length).toBe(1);
    expect(levels[0].table).toBe('Orders');
    expect(levels[0].field).toBe('Category');
  });
});

describe('effectiveGroupLevels — with breakdown', () => {
  it('prepends exactly one synthetic level when breakdown is active', () => {
    const breakdown: DateBreakdown = {
      table: 'Orders',
      field: 'Date',
      interval: 'Month',
    };
    const levels = effectiveGroupLevels(MINIMAL_CONFIG, breakdown);
    // Should have synthetic level (0) + the original level (1)
    expect(levels.length).toBe(2);
  });

  it('synthetic level is at index 0', () => {
    const breakdown: DateBreakdown = {
      table: 'Orders',
      field: 'Date',
      interval: 'Month',
    };
    const levels = effectiveGroupLevels(MINIMAL_CONFIG, breakdown);
    expect(levels[0].table).toBe(BREAKDOWN_TABLE);
    expect(levels[0].field).toBe(BREAKDOWN_FIELD);
  });

  it('original levels are shifted down (index 0 → index 1)', () => {
    const breakdown: DateBreakdown = {
      table: 'Orders',
      field: 'Date',
      interval: 'Quarter',
    };
    const levels = effectiveGroupLevels(MINIMAL_CONFIG, breakdown);
    expect(levels[1].table).toBe('Orders');
    expect(levels[1].field).toBe('Category');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. isSyntheticBreakdownField — Predicate
// ═══════════════════════════════════════════════════════════════════════════════

describe('isSyntheticBreakdownField', () => {
  it('returns true for a field with BREAKDOWN_TABLE and BREAKDOWN_FIELD', () => {
    const result = isSyntheticBreakdownField({
      table: BREAKDOWN_TABLE,
      field: BREAKDOWN_FIELD,
    });
    expect(result).toBe(true);
  });

  it('returns false for a real field', () => {
    const result = isSyntheticBreakdownField({
      table: 'Orders',
      field: 'Category',
    });
    expect(result).toBe(false);
  });

  it('returns false when only table matches', () => {
    const result = isSyntheticBreakdownField({
      table: BREAKDOWN_TABLE,
      field: 'something_else',
    });
    expect(result).toBe(false);
  });

  it('returns false when only field matches', () => {
    const result = isSyntheticBreakdownField({
      table: 'Orders',
      field: BREAKDOWN_FIELD,
    });
    expect(result).toBe(false);
  });
});
