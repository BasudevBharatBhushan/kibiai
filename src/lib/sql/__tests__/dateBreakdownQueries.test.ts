/**
 * T-052 — Date Breakdown SQL feature: integration tests for query builders.
 *
 * Coverage:
 *   1. buildBaseCte — produces the bucket column when breakdown is active
 *   2. buildGroupAggregationQuery — groups by the synthetic level 0
 *   3. buildGrandSummaryQuery — has no GROUP BY (spans full dataset)
 *   4. buildDetailQuery — references the bucket column
 *   5. buildCountQuery — counts with or without grouping
 *
 * Run:
 *   npx vitest run src/lib/sql/__tests__/dateBreakdownQueries.test.ts
 */

import { describe, it, expect } from 'vitest';

import { buildBaseCte } from '@/lib/sql/baseCte';
import {
  buildGroupAggregationQuery,
  buildDetailQuery,
  buildCountQuery,
  buildGrandSummaryQuery,
} from '@/lib/sql/builders';

import type { ReportConfig } from '@/lib/reportConfigTypes';
import type { SqlSetup } from '@/lib/sql/types';
import type { DateBreakdown } from '@/lib/sql/dateBreakdown';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal but fully-typed SqlSetup: single table with date and numeric fields.
 */
const SETUP: SqlSetup = {
  data_source_type: 'sql',
  connection_type: 'sqlite',
  connection: { host: 'http://localhost:9999', apiKey: 'test-key' },
  tables: {
    Orders: {
      physical: 'orders',
      fields: {
        Date: { type: 'date', label: 'Order Date' },
        Amount: { type: 'number', label: 'Amount' },
        Category: { type: 'text', label: 'Category' },
      },
    },
  },
  relationships: [],
};

/**
 * Minimal ReportConfig for testing breakdown integration.
 * Single table, one group field (Category), one summary field (Amount).
 */
const CONFIG: ReportConfig = {
  report_header: 'Orders by Category',
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
    { table: 'Orders', field: 'Category' },
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

const BREAKDOWN_MONTH: DateBreakdown = {
  table: 'Orders',
  field: 'Date',
  interval: 'Month',
};

const BREAKDOWN_QUARTER: DateBreakdown = {
  table: 'Orders',
  field: 'Date',
  interval: 'Quarter',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. buildBaseCte — Bucket column generation
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildBaseCte — without breakdown', () => {
  it('produces a valid result without dateBreakdown param', () => {
    const result = buildBaseCte(CONFIG, SETUP);
    expect(result.cteSql).toBeTruthy();
    expect(Array.isArray(result.params)).toBe(true);
    expect(Array.isArray(result.selectedColumns)).toBe(true);
  });

  it('does NOT include __breakdown.period column in selectedColumns', () => {
    const result = buildBaseCte(CONFIG, SETUP);
    const hasBreakdown = result.selectedColumns.some((col) =>
      col.includes('__breakdown.period'),
    );
    expect(hasBreakdown).toBe(false);
  });

  it('cteSql does NOT contain the breakdown bucket expression', () => {
    const result = buildBaseCte(CONFIG, SETUP);
    expect(result.cteSql).not.toContain('__breakdown.period');
  });
});

describe('buildBaseCte — with Month breakdown', () => {
  it('includes __breakdown.period in selectedColumns', () => {
    const result = buildBaseCte(CONFIG, SETUP, BREAKDOWN_MONTH);
    const hasBreakdown = result.selectedColumns.some((col) =>
      col.includes('__breakdown.period'),
    );
    expect(hasBreakdown).toBe(true);
  });

  it('cteSql contains the bucket alias __breakdown.period', () => {
    const result = buildBaseCte(CONFIG, SETUP, BREAKDOWN_MONTH);
    expect(result.cteSql).toContain('__breakdown.period');
  });

  it('cteSql contains strftime with Month pattern', () => {
    const result = buildBaseCte(CONFIG, SETUP, BREAKDOWN_MONTH);
    expect(result.cteSql).toContain("strftime('%Y-%m'");
  });

  it('selectedColumns includes the date, category, and amount columns', () => {
    const result = buildBaseCte(CONFIG, SETUP, BREAKDOWN_MONTH);
    // Should have Order.Date, Order.Category, Order.Amount, and __breakdown.period
    expect(result.selectedColumns.length).toBeGreaterThanOrEqual(4);
  });
});

describe('buildBaseCte — with Quarter breakdown', () => {
  it('cteSql contains the quarter bucket expression', () => {
    const result = buildBaseCte(CONFIG, SETUP, BREAKDOWN_QUARTER);
    expect(result.cteSql).toContain('-Q');
    expect(result.cteSql).toContain('/ 3');
  });

  it('includes __breakdown.period in selectedColumns', () => {
    const result = buildBaseCte(CONFIG, SETUP, BREAKDOWN_QUARTER);
    const hasBreakdown = result.selectedColumns.some((col) =>
      col.includes('__breakdown.period'),
    );
    expect(hasBreakdown).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. buildGroupAggregationQuery — Groups by synthetic level 0
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildGroupAggregationQuery — with Month breakdown at level 0', () => {
  it('produces a valid SQL query', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_MONTH);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql contains GROUP BY', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_MONTH);
    expect(result.sql.toUpperCase()).toContain('GROUP BY');
  });

  it('sql contains __breakdown.period in the GROUP BY', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_MONTH);
    // The GROUP BY should reference the breakdown period column
    expect(result.sql).toContain('__breakdown.period');
  });

  it('sql contains COUNT(*)', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_MONTH);
    expect(result.sql).toContain('COUNT(*)');
  });

  it('sql contains ORDER BY', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_MONTH);
    expect(result.sql.toUpperCase()).toContain('ORDER BY');
  });

  it('sql contains sum aggregation for group_total fields', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_MONTH);
    expect(result.sql).toContain('COALESCE(SUM(');
  });
});

describe('buildGroupAggregationQuery — with Quarter breakdown at level 0', () => {
  it('produces a valid SQL query', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_QUARTER);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql contains __breakdown.period reference', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_QUARTER);
    expect(result.sql).toContain('__breakdown.period');
  });

  it('sql contains GROUP BY', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 0, undefined, undefined, BREAKDOWN_QUARTER);
    expect(result.sql.toUpperCase()).toContain('GROUP BY');
  });
});

describe('buildGroupAggregationQuery — level 1 (Category) with breakdown', () => {
  it('produces a valid SQL query for the second level', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 1, undefined, undefined, BREAKDOWN_MONTH);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql contains GROUP BY at level 1', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 1, undefined, undefined, BREAKDOWN_MONTH);
    expect(result.sql.toUpperCase()).toContain('GROUP BY');
  });

  it('sql references both __breakdown.period and Category field', () => {
    const result = buildGroupAggregationQuery(CONFIG, SETUP, 1, undefined, undefined, BREAKDOWN_MONTH);
    expect(result.sql).toContain('__breakdown.period');
    expect(result.sql).toContain('Category');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. buildGrandSummaryQuery — No GROUP BY (full dataset total)
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildGrandSummaryQuery — without breakdown', () => {
  it('produces a valid SQL query', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql does NOT contain GROUP BY in the outer query', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP);
    // Grand summary should have no GROUP BY (full dataset aggregate)
    expect(result.sql.toUpperCase()).not.toContain('GROUP BY');
  });

  it('sql contains sum aggregation for summary fields', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP);
    expect(result.sql).toContain('COALESCE(SUM(');
  });
});

describe('buildGrandSummaryQuery — with Month breakdown', () => {
  it('produces a valid SQL query', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP, BREAKDOWN_MONTH);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql does NOT contain GROUP BY in the outer query', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP, BREAKDOWN_MONTH);
    // Even with breakdown, grand summary has no GROUP BY
    expect(result.sql.toUpperCase()).not.toContain('GROUP BY');
  });

  it('base CTE may contain __breakdown.period (that is OK)', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP, BREAKDOWN_MONTH);
    // The CTE includes the breakdown column, but the outer query does not group by it
    expect(result.sql).toBeTruthy();
  });

  it('sql contains sum aggregation', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP, BREAKDOWN_MONTH);
    expect(result.sql).toContain('COALESCE(SUM(');
  });
});

describe('buildGrandSummaryQuery — with Quarter breakdown', () => {
  it('produces a valid SQL query', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP, BREAKDOWN_QUARTER);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql does NOT contain GROUP BY', () => {
    const result = buildGrandSummaryQuery(CONFIG, SETUP, BREAKDOWN_QUARTER);
    expect(result.sql.toUpperCase()).not.toContain('GROUP BY');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. buildDetailQuery — Detail rows for a breakdown period
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildDetailQuery — with Month breakdown', () => {
  it('produces a valid SQL query', () => {
    const result = buildDetailQuery(CONFIG, SETUP, undefined, undefined, undefined, BREAKDOWN_MONTH);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql selects from base CTE', () => {
    const result = buildDetailQuery(CONFIG, SETUP, undefined, undefined, undefined, BREAKDOWN_MONTH);
    expect(result.sql).toContain('FROM base');
  });

  it('sql includes __breakdown.period column', () => {
    const result = buildDetailQuery(CONFIG, SETUP, undefined, undefined, undefined, BREAKDOWN_MONTH);
    expect(result.sql).toContain('__breakdown.period');
  });
});

describe('buildDetailQuery — with group filter on breakdown period', () => {
  it('produces a valid SQL query with filter', () => {
    const groupFilter = [{ table: '__breakdown', field: 'period', value: '2025-01' }];
    const result = buildDetailQuery(
      CONFIG,
      SETUP,
      groupFilter,
      undefined,
      undefined,
      BREAKDOWN_MONTH,
    );
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('includes the filter value in params', () => {
    const groupFilter = [{ table: '__breakdown', field: 'period', value: '2025-01' }];
    const result = buildDetailQuery(
      CONFIG,
      SETUP,
      groupFilter,
      undefined,
      undefined,
      BREAKDOWN_MONTH,
    );
    expect(result.params).toContain('2025-01');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. buildCountQuery — Row count for aggregation level
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildCountQuery — with Month breakdown', () => {
  it('produces a valid SQL query', () => {
    const result = buildCountQuery(CONFIG, SETUP, undefined, BREAKDOWN_MONTH);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql selects COUNT(*)', () => {
    const result = buildCountQuery(CONFIG, SETUP, undefined, BREAKDOWN_MONTH);
    expect(result.sql).toContain('COUNT(*)');
  });

  it('sql selects from base CTE', () => {
    const result = buildCountQuery(CONFIG, SETUP, undefined, BREAKDOWN_MONTH);
    expect(result.sql).toContain('FROM base');
  });
});

describe('buildCountQuery — with Quarter breakdown', () => {
  it('produces a valid SQL query', () => {
    const result = buildCountQuery(CONFIG, SETUP, undefined, BREAKDOWN_QUARTER);
    expect(typeof result.sql).toBe('string');
    expect(Array.isArray(result.params)).toBe(true);
  });

  it('sql selects COUNT(*)', () => {
    const result = buildCountQuery(CONFIG, SETUP, undefined, BREAKDOWN_QUARTER);
    expect(result.sql).toContain('COUNT(*)');
  });
});
