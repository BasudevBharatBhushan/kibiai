/**
 * T-049 — SQLite data source: unit tests for the pure SQL engine modules.
 *
 * Coverage:
 *   1. identifiers   — quoteIdent, resolveField, resolveTable, qualifiedColumn
 *   2. assertReadOnly — accept SELECT/WITH, reject DML/DDL/PRAGMA
 *   3. builders      — buildGroupAggregationQuery, buildCountQuery,
 *                       buildDetailQuery, buildGrandSummaryQuery
 *   4. formulaToSql  — compileFormula for arithmetic, IF(), unsupported fn
 *   5. structureAdapter — buildNestedReport, buildCollapsedStructure
 *   6. sqlClient     — assertReadOnly guard before fetch, 401/403 mapping,
 *                       success path (mock fetch)
 *   7. Live API smoke (guarded: SQL_LIVE=1 env var required)
 *
 * Run (unit only):
 *   npx vitest run src/lib/sql/__tests__/sql-engine.test.ts
 *
 * Enable live smoke tests:
 *   SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-engine.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── module under test ──────────────────────────────────────────────────────────
import {
  quoteIdent,
  resolveTable,
  resolveField,
  qualifiedColumn,
  columnAlias,
} from '@/lib/sql/identifiers';

import { assertReadOnly, runQuery, SqlClientError } from '@/lib/sql/sqlClient';

import {
  buildGroupAggregationQuery,
  buildCountQuery,
  buildDetailQuery,
  buildGrandSummaryQuery,
} from '@/lib/sql/builders';

import { compileFormula, calculatedAlias } from '@/lib/sql/formulaToSql';

import {
  buildNestedReport,
  buildCollapsedStructure,
  buildNestedGroupTree,
  extractGrandTotals,
  buildDrilldownResult,
  buildExpandedNestedReport,
} from '@/lib/sql/structureAdapter';

import { runSqlReport, LARGE_ROW_THRESHOLD } from '@/lib/sql/sqlReportEngine';

import type { SqlSetup, SqlConnection, QueryResult } from '@/lib/sql/types';
import type { ReportConfig, CustomCalcField } from '@/lib/reportConfigTypes';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal but realistic SqlSetup with two tables and a LEFT JOIN.
 * SLS (sales header) ← LEFT JOIN ← LI (line items)
 */
const SETUP: SqlSetup = {
  data_source_type: 'sql',
  connection_type: 'sqlite',
  connection: { host: 'http://localhost:9999', apiKey: 'test-key' },
  tables: {
    SLS: {
      physical: 'sales',
      fields: {
        InvoiceNo: { type: 'text', label: 'Invoice No' },
        CustomerName: { type: 'text', label: 'Customer Name' },
        SalesDate: { type: 'date', label: 'Sales Date' },
      },
    },
    LI: {
      physical: 'line_items',
      fields: {
        InvoiceNo: { type: 'text', label: 'Invoice No' },
        Qty: { type: 'number', label: 'Quantity' },
        UnitPrice: { type: 'number', label: 'Unit Price', prefix: '$' },
        LineTotal: { type: 'number', label: 'Line Total', prefix: '$' },
      },
    },
  },
  relationships: [
    {
      primary_table: 'SLS',
      joined_table: 'LI',
      source: 'InvoiceNo',
      target: 'InvoiceNo',
      join_type: 'left',
    },
  ],
};

/**
 * Minimal ReportConfig that exercises:
 *   - 2-table JOIN (SLS + LI)
 *   - 1 group level (CustomerName)
 *   - group_total  (LineTotal)
 *   - summary_fields (LineTotal)
 *   - filters + date_range_fields
 *   - body_sort_order
 */
const CONFIG: ReportConfig = {
  report_header: 'Sales by Customer',
  response_to_user: '',
  db_defination: [
    { primary_table: 'SLS', joined_table: '', source: '', target: '', join_type: 'left', fetch_order: 1 },
    { primary_table: 'SLS', joined_table: 'LI', source: 'InvoiceNo', target: 'InvoiceNo', join_type: 'left', fetch_order: 2 },
  ],
  report_columns: [
    { table: 'SLS', field: 'CustomerName' },
    { table: 'SLS', field: 'InvoiceNo' },
    { table: 'LI', field: 'Qty' },
    { table: 'LI', field: 'UnitPrice' },
    { table: 'LI', field: 'LineTotal' },
  ],
  group_by_fields: {
    level0: {
      table: 'SLS',
      field: 'CustomerName',
      sort_order: 'asc',
      display: [],
      group_total: [{ table: 'LI', field: 'LineTotal' }],
    },
  },
  filters: { SLS: { CustomerName: 'Acme' } },
  date_range_fields: { SLS: { SalesDate: '2024-01-01...2024-12-31' } },
  body_sort_order: [{ field: 'LineTotal', sort_order: 'desc' }],
  summary_fields: ['LineTotal'],
  custom_calculated_fields: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. IDENTIFIERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('identifiers — quoteIdent', () => {
  it('wraps a simple name in double quotes', () => {
    expect(quoteIdent('foo')).toBe('"foo"');
  });

  it('escapes embedded double-quote characters by doubling them', () => {
    expect(quoteIdent('say "hello"')).toBe('"say ""hello"""');
  });

  it('throws for an empty string', () => {
    expect(() => quoteIdent('')).toThrow(/must not be empty/);
  });

  it('throws for whitespace-only string', () => {
    expect(() => quoteIdent('   ')).toThrow(/must not be empty/);
  });
});

describe('identifiers — resolveTable', () => {
  it('returns physical name and auto-derived alias for a known logical table', () => {
    const result = resolveTable(SETUP, 'SLS');
    expect(result.physical).toBe('sales');
    expect(result.alias).toBe('t_SLS');
  });

  it('derives alias as t_<logicalTable> preserving key casing', () => {
    const setup: SqlSetup = {
      ...SETUP,
      tables: {
        Orders: {
          physical: 'orders',
          fields: {},
        },
      },
    };
    const result = resolveTable(setup, 'Orders');
    expect(result.alias).toBe('t_Orders');
  });

  it('throws for an unknown logical table', () => {
    expect(() => resolveTable(SETUP, 'UNKNOWN_TABLE')).toThrow(/unknown logical table/);
  });
});

describe('identifiers — resolveField', () => {
  it('returns logical key as physical name and def for a known field', () => {
    const result = resolveField(SETUP, 'SLS', 'InvoiceNo');
    expect(result.physicalName).toBe('InvoiceNo');
    expect(result.def.type).toBe('text');
  });

  it('throws for a field not in the allow-list', () => {
    expect(() => resolveField(SETUP, 'SLS', 'NONEXISTENT')).toThrow(/unknown logical field/);
  });

  it('throws for an unknown table (even with valid field arg)', () => {
    expect(() => resolveField(SETUP, 'BAD_TABLE', 'InvoiceNo')).toThrow(/unknown logical table/);
  });
});

describe('identifiers — qualifiedColumn', () => {
  it('returns "t_<table>"."<field>" form', () => {
    expect(qualifiedColumn(SETUP, 'SLS', 'InvoiceNo')).toBe('"t_SLS"."InvoiceNo"');
  });

  it('throws for an unknown table', () => {
    expect(() => qualifiedColumn(SETUP, 'GHOST', 'InvoiceNo')).toThrow();
  });
});

describe('identifiers — columnAlias', () => {
  it('returns quoted "Table.Field" token', () => {
    expect(columnAlias('SLS', 'InvoiceNo')).toBe('"SLS.InvoiceNo"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. assertReadOnly
// ═══════════════════════════════════════════════════════════════════════════════

describe('assertReadOnly — accepted queries', () => {
  const acceptCases: string[] = [
    'SELECT 1',
    'select * from foo',
    '  SELECT id FROM t',
    'WITH cte AS (SELECT 1) SELECT * FROM cte',
    'with cte as (select 1) select * from cte',
    '/* comment */ SELECT 1',
    '-- comment\nSELECT 1',
    '\n  \t  SELECT 1',
  ];

  for (const sql of acceptCases) {
    it(`accepts: ${sql.slice(0, 60).replace(/\n/g, '\\n')}`, () => {
      expect(() => assertReadOnly(sql)).not.toThrow();
    });
  }
});

describe('assertReadOnly — rejected queries', () => {
  const rejectCases: string[] = [
    'DROP TABLE foo',
    'INSERT INTO foo VALUES (1)',
    'UPDATE foo SET a=1',
    'DELETE FROM foo',
    'PRAGMA journal_mode=WAL',
    'drop table foo',
    'insert into foo values (1)',
    'update foo set a=1',
    'delete from foo',
    'pragma journal_mode=wal',
  ];

  for (const sql of rejectCases) {
    it(`rejects: ${sql}`, () => {
      let threw = false;
      try {
        assertReadOnly(sql);
      } catch (e) {
        threw = true;
        expect(e).toBeInstanceOf(SqlClientError);
        expect((e as SqlClientError).status).toBe(403);
      }
      expect(threw).toBe(true);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('builders — buildGroupAggregationQuery (level 0)', () => {
  it('produces sql and params', () => {
    const { sql, params } = buildGroupAggregationQuery(CONFIG, SETUP, 0);
    expect(typeof sql).toBe('string');
    expect(Array.isArray(params)).toBe(true);
  });

  it('sql contains GROUP BY', () => {
    const { sql } = buildGroupAggregationQuery(CONFIG, SETUP, 0);
    expect(sql.toUpperCase()).toContain('GROUP BY');
  });

  it('sql contains COUNT(*)', () => {
    const { sql } = buildGroupAggregationQuery(CONFIG, SETUP, 0);
    expect(sql).toContain('COUNT(*)');
  });

  it('sql contains COALESCE(SUM(', () => {
    const { sql } = buildGroupAggregationQuery(CONFIG, SETUP, 0);
    expect(sql).toContain('COALESCE(SUM(');
  });

  it('sql contains ORDER BY', () => {
    const { sql } = buildGroupAggregationQuery(CONFIG, SETUP, 0);
    expect(sql.toUpperCase()).toContain('ORDER BY');
  });

  it('identifiers are double-quoted (no bare names)', () => {
    const { sql } = buildGroupAggregationQuery(CONFIG, SETUP, 0);
    // All table/column references should use quoted identifiers
    expect(sql).toContain('"t_SLS"');
    expect(sql).toContain('"t_LI"');
  });

  it('filter values are bound as ? params — no raw literals in sql', () => {
    const { sql, params } = buildGroupAggregationQuery(CONFIG, SETUP, 0);
    expect(sql).not.toContain('Acme');
    // Plain string filter uses LIKE → param is %Acme%
    expect(params).toContain('%Acme%');
  });

  it('date range filter produces two params (BETWEEN ? AND ?)', () => {
    const { params } = buildGroupAggregationQuery(CONFIG, SETUP, 0);
    // filter: Acme (1 param) + date range 2024-01-01...2024-12-31 (2 params)
    expect(params).toContain('2024-01-01');
    expect(params).toContain('2024-12-31');
  });

  it('throws for an out-of-range level', () => {
    expect(() => buildGroupAggregationQuery(CONFIG, SETUP, 5)).toThrow(/out of range/);
  });

  it('throws for a config with no group_by_fields', () => {
    const noGroups: ReportConfig = { ...CONFIG, group_by_fields: {} };
    expect(() => buildGroupAggregationQuery(noGroups, SETUP, 0)).toThrow(
      /no group_by_fields/,
    );
  });
});

describe('builders — buildCountQuery', () => {
  it('sql contains COUNT(*) AS "total_rows"', () => {
    const { sql } = buildCountQuery(CONFIG, SETUP);
    expect(sql).toContain('COUNT(*) AS "total_rows"');
  });

  it('no groupFilter → no WHERE in outer query', () => {
    const { sql, params } = buildCountQuery(CONFIG, SETUP);
    // The base CTE has its own WHERE from filters; the outer query should not
    // append an extra WHERE when no groupFilter is given.
    const outerPart = sql.split(')').slice(1).join(')'); // after first CTE closing paren
    expect(outerPart).not.toMatch(/WHERE/i);
    // params come only from the base CTE filter; plain string → LIKE → %Acme%
    expect(params).toContain('%Acme%');
  });

  it('groupFilter appends extra WHERE with params after base params', () => {
    const { sql, params } = buildCountQuery(CONFIG, SETUP, [
      { table: 'SLS', field: 'CustomerName', value: 'TestCo' },
    ]);
    expect(sql).toContain('WHERE');
    // TestCo must appear in params and must come after existing filter params
    const testCoIdx = params.indexOf('TestCo');
    expect(testCoIdx).toBeGreaterThan(-1);
    // Base CTE filter for Acme is bound as %Acme% (plain string → LIKE)
    const acmeIdx = params.indexOf('%Acme%');
    expect(acmeIdx).toBeLessThan(testCoIdx);
  });
});

describe('builders — buildDetailQuery', () => {
  it('sql contains SELECT * FROM base', () => {
    const { sql } = buildDetailQuery(CONFIG, SETUP);
    expect(sql).toContain('SELECT * FROM base');
  });

  it('sql contains ORDER BY', () => {
    const { sql } = buildDetailQuery(CONFIG, SETUP);
    expect(sql.toUpperCase()).toContain('ORDER BY');
  });

  it('group column appears before body_sort_order column in ORDER BY clause', () => {
    const { sql } = buildDetailQuery(CONFIG, SETUP);
    const orderByIdx = sql.toUpperCase().indexOf('ORDER BY');
    const orderPart = sql.slice(orderByIdx);
    // CustomerName (group col) should appear before LineTotal (body_sort_order)
    const customerIdx = orderPart.indexOf('SLS.CustomerName');
    const lineTotalIdx = orderPart.indexOf('LI.LineTotal');
    expect(customerIdx).toBeGreaterThanOrEqual(0);
    expect(lineTotalIdx).toBeGreaterThanOrEqual(0);
    expect(customerIdx).toBeLessThan(lineTotalIdx);
  });

  it('LIMIT / OFFSET params appended in correct order when both provided', () => {
    const { sql, params } = buildDetailQuery(CONFIG, SETUP, undefined, 50, 100);
    expect(sql).toContain('LIMIT ?');
    expect(sql).toContain('OFFSET ?');
    const limitIdx = params.indexOf(50);
    const offsetIdx = params.indexOf(100);
    expect(limitIdx).toBeGreaterThan(-1);
    expect(offsetIdx).toBeGreaterThan(limitIdx);
  });

  it('OFFSET without LIMIT emits LIMIT -1', () => {
    const { sql } = buildDetailQuery(CONFIG, SETUP, undefined, undefined, 20);
    expect(sql).toContain('LIMIT -1');
    expect(sql).toContain('OFFSET ?');
  });
});

describe('builders — buildGrandSummaryQuery', () => {
  it('sql contains COALESCE(SUM( for summary_fields', () => {
    const { sql } = buildGrandSummaryQuery(CONFIG, SETUP);
    expect(sql).toContain('COALESCE(SUM(');
  });

  it('sql ends with FROM base (no trailing ORDER BY or GROUP BY)', () => {
    const { sql } = buildGrandSummaryQuery(CONFIG, SETUP);
    const afterBase = sql.slice(sql.lastIndexOf('FROM base') + 'FROM base'.length).trim();
    expect(afterBase).toBe('');
  });

  it('config with no summary_fields emits COUNT(*)', () => {
    const noSummary: ReportConfig = { ...CONFIG, summary_fields: [] };
    const { sql } = buildGrandSummaryQuery(noSummary, SETUP);
    expect(sql).toContain('COUNT(*)');
  });

  it('params carry only filter values (no raw values inlined)', () => {
    const { sql, params } = buildGrandSummaryQuery(CONFIG, SETUP);
    // Raw value should not be inlined in the SQL string
    expect(sql).not.toContain('Acme');
    // Plain string filter → LIKE → param is %Acme%
    expect(params).toContain('%Acme%');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. formulaToSql — compileFormula
// ═══════════════════════════════════════════════════════════════════════════════

/** Build a minimal qualify function for tests. */
function makeQualify(setup: SqlSetup) {
  return (table: string, field: string): string => qualifiedColumn(setup, table, field);
}

describe('formulaToSql — compileFormula', () => {
  const calcQty: CustomCalcField = {
    field_name: 'Revenue',
    label: 'Revenue',
    format: 'currency',
    formula: '=Qty * UnitPrice',
    dependencies: ['LI.Qty', 'LI.UnitPrice'],
  };

  it('Qty * UnitPrice compiles to a multiplication expression', () => {
    const { expr } = compileFormula(SETUP, calcQty, makeQualify(SETUP));
    expect(expr).toContain('"t_LI"."Qty"');
    expect(expr).toContain('"t_LI"."UnitPrice"');
    expect(expr).toContain('*');
  });

  it('division is wrapped in NULLIF to prevent divide-by-zero', () => {
    const calcDiv: CustomCalcField = {
      field_name: 'AvgPrice',
      label: 'Avg Price',
      format: 'number',
      formula: '=LineTotal / Qty',
      dependencies: ['LI.LineTotal', 'LI.Qty'],
    };
    const { expr } = compileFormula(SETUP, calcDiv, makeQualify(SETUP));
    expect(expr).toContain('NULLIF(');
  });

  it('IF(Total>0, Margin/Total, 0) compiles to CASE WHEN ... THEN ... ELSE', () => {
    const setupWithMargin: SqlSetup = {
      ...SETUP,
      tables: {
        ...SETUP.tables,
        LI: {
          ...SETUP.tables['LI']!,
          fields: {
            ...SETUP.tables['LI']!.fields,
            Margin: { type: 'number', label: 'Margin' },
            Total: { type: 'number', label: 'Total' },
          },
        },
      },
    };
    const calcIf: CustomCalcField = {
      field_name: 'MarginPct',
      label: 'Margin %',
      format: 'percentage',
      formula: '=IF(Total > 0, Margin / Total, 0)',
      dependencies: ['LI.Total', 'LI.Margin'],
    };
    const { expr } = compileFormula(setupWithMargin, calcIf, makeQualify(setupWithMargin));
    expect(expr.toUpperCase()).toContain('CASE WHEN');
    expect(expr.toUpperCase()).toContain('THEN');
    expect(expr.toUpperCase()).toContain('ELSE');
    expect(expr).toContain('NULLIF(');
  });

  it('unsupported function VLOOKUP throws', () => {
    const calcBad: CustomCalcField = {
      field_name: 'X',
      label: 'X',
      format: 'number',
      formula: '=VLOOKUP(Qty, 1, 2)',
      dependencies: ['LI.Qty'],
    };
    expect(() => compileFormula(SETUP, calcBad, makeQualify(SETUP))).toThrow(
      /unsupported function/i,
    );
  });

  it('undeclared field reference throws', () => {
    const calcBad: CustomCalcField = {
      field_name: 'Ghost',
      label: 'Ghost',
      format: 'number',
      formula: '=GhostField * 2',
      dependencies: ['LI.Qty'],
    };
    expect(() => compileFormula(SETUP, calcBad, makeQualify(SETUP))).toThrow(
      /not a declared dependency/,
    );
  });

  it('calculatedAlias returns quoted "calculated.fieldName"', () => {
    expect(calculatedAlias('Revenue')).toBe('"calculated.Revenue"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. structureAdapter — buildNestedReport & buildCollapsedStructure
// ═══════════════════════════════════════════════════════════════════════════════

describe('structureAdapter — buildNestedReport', () => {
  // Fake level-0 aggregation rows (as the server would return them)
  const level0Rows: Record<string, unknown>[] = [
    { 'SLS.CustomerName': 'Acme Corp', 'LI.LineTotal': 1500, row_count: 3 },
    { 'SLS.CustomerName': 'Beta LLC', 'LI.LineTotal': 800, row_count: 2 },
  ];

  const levelRows = [level0Rows];

  const grandRow: Record<string, unknown> = {
    'LI.LineTotal': 2300,
  };

  it('mode is "nested"', () => {
    const groups = buildNestedGroupTree(CONFIG, SETUP, levelRows);
    const grandTotals = extractGrandTotals(CONFIG, SETUP, grandRow);
    const report = buildNestedReport(CONFIG, SETUP, groups, grandTotals);
    expect(report.mode).toBe('nested');
  });

  it('title comes from config.report_header', () => {
    const groups = buildNestedGroupTree(CONFIG, SETUP, levelRows);
    const grandTotals = extractGrandTotals(CONFIG, SETUP, grandRow);
    const report = buildNestedReport(CONFIG, SETUP, groups, grandTotals);
    expect(report.title).toBe('Sales by Customer');
  });

  it('fieldOrder lists all report_columns labels', () => {
    const groups = buildNestedGroupTree(CONFIG, SETUP, levelRows);
    const grandTotals = extractGrandTotals(CONFIG, SETUP, grandRow);
    const report = buildNestedReport(CONFIG, SETUP, groups, grandTotals);
    expect(report.fieldOrder).toContain('Customer Name');
    expect(report.fieldOrder).toContain('Line Total');
  });

  it('groups array has one node per unique level-0 group value', () => {
    const groups = buildNestedGroupTree(CONFIG, SETUP, levelRows);
    const grandTotals = extractGrandTotals(CONFIG, SETUP, grandRow);
    const report = buildNestedReport(CONFIG, SETUP, groups, grandTotals);
    expect(report.groups).toHaveLength(2);
  });

  it('each group node has a count', () => {
    const groups = buildNestedGroupTree(CONFIG, SETUP, levelRows);
    const grandTotals = extractGrandTotals(CONFIG, SETUP, grandRow);
    const report = buildNestedReport(CONFIG, SETUP, groups, grandTotals);
    const acme = report.groups.find((g) => g.value === 'Acme Corp');
    expect(acme).toBeDefined();
    expect(acme?.count).toBe(3);
  });

  it('grandTotals contains label key from summary_fields', () => {
    const groups = buildNestedGroupTree(CONFIG, SETUP, levelRows);
    const grandTotals = extractGrandTotals(CONFIG, SETUP, grandRow);
    const report = buildNestedReport(CONFIG, SETUP, groups, grandTotals);
    expect(report.grandTotalFields).toContain('Line Total');
  });

  it('fieldPrefix contains prefix for UnitPrice (prefix = "$")', () => {
    const groups = buildNestedGroupTree(CONFIG, SETUP, levelRows);
    const grandTotals = extractGrandTotals(CONFIG, SETUP, grandRow);
    const report = buildNestedReport(CONFIG, SETUP, groups, grandTotals);
    expect(report.fieldPrefix['Unit Price']).toBe('$');
  });
});

describe('structureAdapter — buildCollapsedStructure', () => {
  const level0Rows: Record<string, unknown>[] = [
    { 'SLS.CustomerName': 'Acme Corp', 'LI.LineTotal': 1500, row_count: 3 },
  ];
  const levelRows = [level0Rows];
  const grandRow: Record<string, unknown> = { 'LI.LineTotal': 1500 };

  it('returns an array of blocks', () => {
    const blocks = buildCollapsedStructure(CONFIG, SETUP, levelRows, grandRow);
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('first block is TitleHeader', () => {
    const blocks = buildCollapsedStructure(CONFIG, SETUP, levelRows, grandRow);
    expect(blocks[0]).toHaveProperty('TitleHeader');
  });

  it('contains a Subsummary block', () => {
    const blocks = buildCollapsedStructure(CONFIG, SETUP, levelRows, grandRow);
    const hasSub = blocks.some((b) => 'Subsummary' in b);
    expect(hasSub).toBe(true);
  });

  it('Body block exists with empty BodyField array', () => {
    const blocks = buildCollapsedStructure(CONFIG, SETUP, levelRows, grandRow);
    const bodyBlock = blocks.find((b) => 'Body' in b) as { Body: { BodyField: unknown[] } } | undefined;
    expect(bodyBlock).toBeDefined();
    expect(bodyBlock!.Body.BodyField).toEqual([]);
  });

  it('BodyFieldOrder excludes the group-by field label', () => {
    const blocks = buildCollapsedStructure(CONFIG, SETUP, levelRows, grandRow);
    const bodyBlock = blocks.find((b) => 'Body' in b) as { Body: { BodyFieldOrder: string[] } } | undefined;
    // CustomerName is the group field — should NOT appear in body column order
    expect(bodyBlock!.Body.BodyFieldOrder).not.toContain('Customer Name');
  });

  it('BodyFieldOrder contains non-group columns', () => {
    const blocks = buildCollapsedStructure(CONFIG, SETUP, levelRows, grandRow);
    const bodyBlock = blocks.find((b) => 'Body' in b) as { Body: { BodyFieldOrder: string[] } } | undefined;
    expect(bodyBlock!.Body.BodyFieldOrder).toContain('Line Total');
  });

  it('FieldPrefix is populated for fields with a prefix', () => {
    const blocks = buildCollapsedStructure(CONFIG, SETUP, levelRows, grandRow);
    const bodyBlock = blocks.find((b) => 'Body' in b) as { Body: { FieldPrefix: Record<string, string> } } | undefined;
    expect(bodyBlock!.Body.FieldPrefix['Unit Price']).toBe('$');
  });

  it('last block is TrailingGrandSummary', () => {
    const blocks = buildCollapsedStructure(CONFIG, SETUP, levelRows, grandRow);
    const last = blocks[blocks.length - 1];
    expect(last).toHaveProperty('TrailingGrandSummary');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. sqlClient — runQuery (mocked fetch)
// ═══════════════════════════════════════════════════════════════════════════════

describe('sqlClient — runQuery', () => {
  const CONN: SqlConnection = { host: 'http://fakehost', apiKey: 'fake-key' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws SqlClientError(403) for non-SELECT without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      runQuery(CONN, { sql: 'DROP TABLE foo', params: [] }),
    ).rejects.toBeInstanceOf(SqlClientError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws SqlClientError(403) with correct status for DROP', async () => {
    await expect(
      runQuery(CONN, { sql: 'DROP TABLE foo', params: [] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('maps 401 response to SqlClientError(401)', async () => {
    const mockResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse));

    await expect(
      runQuery(CONN, { sql: 'SELECT 1', params: [] }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('maps 403 response to SqlClientError(403)', async () => {
    const mockResponse = new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse));

    await expect(
      runQuery(CONN, { sql: 'SELECT 1', params: [] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns normalised QueryResult on success', async () => {
    const responseBody = {
      rows: [{ value: 1 }],
      rowCount: 1,
      columns: ['value'],
    };
    const mockResponse = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse));

    const result: QueryResult = await runQuery(CONN, { sql: 'SELECT 1 AS value', params: [] });
    expect(result.rows).toEqual([{ value: 1 }]);
    expect(result.rowCount).toBe(1);
    expect(result.columns).toEqual(['value']);
  });

  it('derives columns from first row when server omits columns array', async () => {
    const responseBody = {
      rows: [{ a: 1, b: 2 }],
    };
    const mockResponse = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse));

    const result = await runQuery(CONN, { sql: 'SELECT a, b FROM t', params: [] });
    expect(result.columns).toEqual(['a', 'b']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. buildDrilldownResult — label mapping + totals
// ═══════════════════════════════════════════════════════════════════════════════

describe('structureAdapter — buildDrilldownResult', () => {
  // Raw rows as the SQL server would return them (bare alias keys — no outer quotes).
  const detailRows: Record<string, unknown>[] = [
    {
      'SLS.CustomerName': 'Acme Corp',
      'SLS.InvoiceNo': 'INV-001',
      'LI.Qty': 2,
      'LI.UnitPrice': 10,
      'LI.LineTotal': 20,
    },
    {
      'SLS.CustomerName': 'Acme Corp',
      'SLS.InvoiceNo': 'INV-002',
      'LI.Qty': 3,
      'LI.UnitPrice': 15,
      'LI.LineTotal': 45,
    },
  ];

  it('bodyRows keys are human-readable labels, not alias keys', () => {
    const result = buildDrilldownResult(CONFIG, SETUP, detailRows);
    expect(result.bodyRows.length).toBe(2);
    const firstRow = result.bodyRows[0];
    expect(firstRow).toBeDefined();
    // Should use label, not alias key
    expect(firstRow!['Customer Name']).toBe('Acme Corp');
    expect(firstRow!['Invoice No']).toBe('INV-001');
    expect(firstRow!['Line Total']).toBe(20);
    // Alias keys must NOT appear in the mapped row
    expect('SLS.CustomerName' in firstRow!).toBe(false);
  });

  it('fieldOrder contains report_columns labels in config order', () => {
    const result = buildDrilldownResult(CONFIG, SETUP, detailRows);
    // CONFIG report_columns: CustomerName, InvoiceNo, Qty, UnitPrice, LineTotal
    expect(result.fieldOrder).toEqual([
      'Customer Name',
      'Invoice No',
      'Quantity',
      'Unit Price',
      'Line Total',
    ]);
  });

  it('fieldPrefix includes "$" for UnitPrice and LineTotal', () => {
    const result = buildDrilldownResult(CONFIG, SETUP, detailRows);
    expect(result.fieldPrefix['Unit Price']).toBe('$');
    expect(result.fieldPrefix['Line Total']).toBe('$');
  });

  it('fieldSuffix is empty when no suffix fields are configured', () => {
    const result = buildDrilldownResult(CONFIG, SETUP, detailRows);
    expect(Object.keys(result.fieldSuffix)).toHaveLength(0);
  });

  it('totalFields contains the deepest group_total label (Line Total)', () => {
    const result = buildDrilldownResult(CONFIG, SETUP, detailRows);
    expect(result.totalFields).toContain('Line Total');
  });

  it('totals correctly sums LineTotal across all rows (20 + 45 = 65)', () => {
    const result = buildDrilldownResult(CONFIG, SETUP, detailRows);
    expect(result.totals['Line Total']).toBe(65);
  });

  it('totals coerces numeric strings', () => {
    const stringRows: Record<string, unknown>[] = [
      { 'SLS.CustomerName': 'X', 'SLS.InvoiceNo': 'I-1', 'LI.Qty': 1, 'LI.UnitPrice': 5, 'LI.LineTotal': '100' },
      { 'SLS.CustomerName': 'X', 'SLS.InvoiceNo': 'I-2', 'LI.Qty': 2, 'LI.UnitPrice': 5, 'LI.LineTotal': '200.50' },
    ];
    const result = buildDrilldownResult(CONFIG, SETUP, stringRows);
    expect(result.totals['Line Total']).toBeCloseTo(300.5);
  });

  it('returns empty bodyRows and zero totals for empty input', () => {
    const result = buildDrilldownResult(CONFIG, SETUP, []);
    expect(result.bodyRows).toHaveLength(0);
    expect(result.totals['Line Total']).toBe(0);
  });

  it('LARGE_ROW_THRESHOLD is exported and equals 30000', () => {
    expect(LARGE_ROW_THRESHOLD).toBe(30_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. runSqlReport drilldown — warn-large path (mocked runQuery)
// ═══════════════════════════════════════════════════════════════════════════════

describe('runSqlReport — drilldown warn-large path', () => {
  const CONN: SqlConnection = { host: 'http://fakehost', apiKey: 'fake-key' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Helper: builds a mock fetch Response from an object.
   */
  function makeJsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('returns warn_large:true and row_count when count > 30000 and confirmLarge is false', async () => {
    // First fetch call → count query → 35000 rows
    const countBody: QueryResult = {
      rows: [{ total_rows: 35_000 }],
      rowCount: 1,
      columns: ['total_rows'],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(makeJsonResponse(countBody)));

    const result = await runSqlReport({
      setup: { ...SETUP, connection: CONN },
      config: CONFIG,
      viewMode: 'drilldown',
      groupPath: [{ table: 'SLS', field: 'CustomerName', value: 'Acme Corp' }],
      confirmLarge: false,
    });

    expect(result.mode).toBe('drilldown');
    expect(result.warn_large).toBe(true);
    expect(result.row_count).toBe(35_000);
    // group_rows must NOT be present when we short-circuit
    expect(result.group_rows).toBeUndefined();
    // Only the count fetch was made — detail fetch should NOT have been called
    const fetchMock = vi.mocked(globalThis.fetch as ReturnType<typeof vi.fn>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches detail rows when count <= 30000', async () => {
    const countBody: QueryResult = {
      rows: [{ total_rows: 5 }],
      rowCount: 1,
      columns: ['total_rows'],
    };
    const detailBody: QueryResult = {
      rows: [
        { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-001', 'LI.Qty': 2, 'LI.UnitPrice': 10, 'LI.LineTotal': 20 },
      ],
      rowCount: 1,
      columns: ['SLS.CustomerName', 'SLS.InvoiceNo', 'LI.Qty', 'LI.UnitPrice', 'LI.LineTotal'],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeJsonResponse(countBody))
      .mockResolvedValueOnce(makeJsonResponse(detailBody));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runSqlReport({
      setup: { ...SETUP, connection: CONN },
      config: CONFIG,
      viewMode: 'drilldown',
      groupPath: [{ table: 'SLS', field: 'CustomerName', value: 'Acme Corp' }],
      confirmLarge: false,
    });

    expect(result.mode).toBe('drilldown');
    expect(result.warn_large).toBe(false);
    expect(result.row_count).toBe(5);
    expect(result.group_rows).toBeDefined();
    expect(result.group_rows!.bodyRows).toHaveLength(1);
    expect(result.group_rows!.bodyRows[0]!['Customer Name']).toBe('Acme Corp');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('proceeds past warn_large when confirmLarge is true', async () => {
    const countBody: QueryResult = {
      rows: [{ total_rows: 40_000 }],
      rowCount: 1,
      columns: ['total_rows'],
    };
    const detailBody: QueryResult = {
      rows: [
        { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'I-1', 'LI.Qty': 1, 'LI.UnitPrice': 5, 'LI.LineTotal': 5 },
      ],
      rowCount: 1,
      columns: ['SLS.CustomerName', 'SLS.InvoiceNo', 'LI.Qty', 'LI.UnitPrice', 'LI.LineTotal'],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeJsonResponse(countBody))
      .mockResolvedValueOnce(makeJsonResponse(detailBody));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runSqlReport({
      setup: { ...SETUP, connection: CONN },
      config: CONFIG,
      viewMode: 'drilldown',
      groupPath: [{ table: 'SLS', field: 'CustomerName', value: 'Acme Corp' }],
      confirmLarge: true,
    });

    expect(result.warn_large).toBe(false);
    expect(result.row_count).toBe(40_000);
    expect(result.group_rows).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8b. structureAdapter — buildExpandedNestedReport (full nested w/ bodyRows)
// ═══════════════════════════════════════════════════════════════════════════════

describe('structureAdapter — buildExpandedNestedReport (single level)', () => {
  // One group level (CustomerName) — every group node is a leaf.
  const levelRows: Record<string, unknown>[][] = [
    [
      { 'SLS.CustomerName': 'Acme Corp', row_count: 2, 'LI.LineTotal': 65 },
      { 'SLS.CustomerName': 'Beta LLC', row_count: 1, 'LI.LineTotal': 10 },
      { 'SLS.CustomerName': 'Gamma Inc', row_count: 0, 'LI.LineTotal': 0 },
    ],
  ];
  const detailRows: Record<string, unknown>[] = [
    { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-001', 'LI.Qty': 2, 'LI.UnitPrice': 10, 'LI.LineTotal': 20 },
    { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-002', 'LI.Qty': 3, 'LI.UnitPrice': 15, 'LI.LineTotal': 45 },
    { 'SLS.CustomerName': 'Beta LLC', 'SLS.InvoiceNo': 'INV-003', 'LI.Qty': 1, 'LI.UnitPrice': 10, 'LI.LineTotal': 10 },
  ];
  const grandRow: Record<string, unknown> = { 'LI.LineTotal': 75 };

  it('returns a nested report with one group node per distinct group value', () => {
    const report = buildExpandedNestedReport(CONFIG, SETUP, levelRows, detailRows, grandRow);
    expect(report.mode).toBe('nested');
    expect(report.groups).toHaveLength(3);
    // node.value holds the group VALUE (node.label is the field's display label).
    expect(report.groups.map((g) => g.value)).toEqual(['Acme Corp', 'Beta LLC', 'Gamma Inc']);
  });

  it('distributes detail rows to the correct leaf, preserving order', () => {
    const report = buildExpandedNestedReport(CONFIG, SETUP, levelRows, detailRows, grandRow);
    const acme = report.groups.find((g) => g.value === 'Acme Corp');
    expect(acme?.bodyRows).toBeDefined();
    expect(acme!.bodyRows!).toHaveLength(2);
    // SQL already ordered — order must be preserved (INV-001 before INV-002).
    expect(acme!.bodyRows![0]!['Invoice No']).toBe('INV-001');
    expect(acme!.bodyRows![1]!['Invoice No']).toBe('INV-002');
  });

  it('maps body row keys to labels (not alias keys)', () => {
    const report = buildExpandedNestedReport(CONFIG, SETUP, levelRows, detailRows, grandRow);
    const acme = report.groups.find((g) => g.value === 'Acme Corp');
    const row = acme!.bodyRows![0]!;
    expect(row['Line Total']).toBe(20);
    expect('LI.LineTotal' in row).toBe(false);
    // Every body-row key should be a member of fieldOrder.
    for (const key of Object.keys(row)) {
      expect(report.fieldOrder).toContain(key);
    }
  });

  it('gives a leaf with no matching detail rows an empty bodyRows array', () => {
    const report = buildExpandedNestedReport(CONFIG, SETUP, levelRows, detailRows, grandRow);
    const gamma = report.groups.find((g) => g.value === 'Gamma Inc');
    expect(gamma?.bodyRows).toEqual([]);
  });

  it('exposes grand totals from the grand row', () => {
    const report = buildExpandedNestedReport(CONFIG, SETUP, levelRows, detailRows, grandRow);
    expect(report.grandTotalFields).toContain('Line Total');
    expect(report.grandTotals['Line Total']).toBe(75);
  });
});

describe('structureAdapter — buildExpandedNestedReport (two levels)', () => {
  // Two group levels: CustomerName → InvoiceNo. Top nodes are internal, leaves carry rows.
  const TWO_LEVEL_CONFIG: ReportConfig = {
    ...CONFIG,
    report_columns: [
      { table: 'LI', field: 'Qty' },
      { table: 'LI', field: 'UnitPrice' },
      { table: 'LI', field: 'LineTotal' },
    ],
    group_by_fields: {
      level0: { table: 'SLS', field: 'CustomerName', sort_order: 'asc', display: [], group_total: [{ table: 'LI', field: 'LineTotal' }] },
      level1: { table: 'SLS', field: 'InvoiceNo', sort_order: 'asc', display: [], group_total: [{ table: 'LI', field: 'LineTotal' }] },
    },
  };
  const levelRows: Record<string, unknown>[][] = [
    [{ 'SLS.CustomerName': 'Acme Corp', row_count: 2, 'LI.LineTotal': 65 }],
    [
      { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-001', row_count: 1, 'LI.LineTotal': 20 },
      { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-002', row_count: 1, 'LI.LineTotal': 45 },
    ],
  ];
  const detailRows: Record<string, unknown>[] = [
    { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-001', 'LI.Qty': 2, 'LI.UnitPrice': 10, 'LI.LineTotal': 20 },
    { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-002', 'LI.Qty': 3, 'LI.UnitPrice': 15, 'LI.LineTotal': 45 },
  ];

  it('internal node has children and no bodyRows; leaves carry bodyRows', () => {
    const report = buildExpandedNestedReport(TWO_LEVEL_CONFIG, SETUP, levelRows, detailRows, { 'LI.LineTotal': 65 });
    const acme = report.groups[0]!;
    expect(acme.value).toBe('Acme Corp');
    expect(acme.children).toBeDefined();
    expect(acme.children!).toHaveLength(2);
    expect(acme.bodyRows).toBeUndefined();
    const firstInvoice = acme.children![0]!;
    expect(firstInvoice.bodyRows).toBeDefined();
    expect(firstInvoice.bodyRows!).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8c. runSqlReport — expand_all (mocked runQuery)
// ═══════════════════════════════════════════════════════════════════════════════

describe('runSqlReport — expand_all', () => {
  const CONN: SqlConnection = { host: 'http://fakehost', apiKey: 'fake-key' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeJsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('returns warn_large:true and runs only the count query when count > 30000', async () => {
    const countBody: QueryResult = { rows: [{ total_rows: 50_000 }], rowCount: 1, columns: ['total_rows'] };
    const fetchMock = vi.fn().mockResolvedValueOnce(makeJsonResponse(countBody));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runSqlReport({
      setup: { ...SETUP, connection: CONN },
      config: CONFIG,
      viewMode: 'expand_all',
      confirmLarge: false,
    });

    expect(result.mode).toBe('expand_all');
    expect(result.warn_large).toBe(true);
    expect(result.row_count).toBe(50_000);
    expect(result.nested).toBeUndefined();
    // Only the global count query ran — no aggregation/detail/grand-summary.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('assembles the nested report when count <= 30000 (count + 1 level + detail + grand = 4 queries)', async () => {
    const countBody: QueryResult = { rows: [{ total_rows: 3 }], rowCount: 1, columns: ['total_rows'] };
    const aggBody: QueryResult = {
      rows: [{ 'SLS.CustomerName': 'Acme Corp', row_count: 3, 'LI.LineTotal': 65 }],
      rowCount: 1,
      columns: ['SLS.CustomerName', 'row_count', 'LI.LineTotal'],
    };
    const detailBody: QueryResult = {
      rows: [
        { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-001', 'LI.Qty': 2, 'LI.UnitPrice': 10, 'LI.LineTotal': 20 },
        { 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-002', 'LI.Qty': 3, 'LI.UnitPrice': 15, 'LI.LineTotal': 45 },
      ],
      rowCount: 2,
      columns: ['SLS.CustomerName', 'SLS.InvoiceNo', 'LI.Qty', 'LI.UnitPrice', 'LI.LineTotal'],
    };
    const grandBody: QueryResult = { rows: [{ 'LI.LineTotal': 65 }], rowCount: 1, columns: ['LI.LineTotal'] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeJsonResponse(countBody))
      .mockResolvedValueOnce(makeJsonResponse(aggBody))
      .mockResolvedValueOnce(makeJsonResponse(detailBody))
      .mockResolvedValueOnce(makeJsonResponse(grandBody));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runSqlReport({
      setup: { ...SETUP, connection: CONN },
      config: CONFIG,
      viewMode: 'expand_all',
      confirmLarge: false,
    });

    expect(result.warn_large).toBe(false);
    expect(result.row_count).toBe(3);
    expect(result.nested).toBeDefined();
    expect(result.nested!.groups).toHaveLength(1);
    expect(result.nested!.groups[0]!.bodyRows!).toHaveLength(2);
    expect(result.report_structure_json).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('proceeds past the 30k guard when confirmLarge is true', async () => {
    const countBody: QueryResult = { rows: [{ total_rows: 90_000 }], rowCount: 1, columns: ['total_rows'] };
    const aggBody: QueryResult = {
      rows: [{ 'SLS.CustomerName': 'Acme Corp', row_count: 1, 'LI.LineTotal': 20 }],
      rowCount: 1,
      columns: ['SLS.CustomerName', 'row_count', 'LI.LineTotal'],
    };
    const detailBody: QueryResult = {
      rows: [{ 'SLS.CustomerName': 'Acme Corp', 'SLS.InvoiceNo': 'INV-001', 'LI.Qty': 1, 'LI.UnitPrice': 20, 'LI.LineTotal': 20 }],
      rowCount: 1,
      columns: ['SLS.CustomerName', 'SLS.InvoiceNo', 'LI.Qty', 'LI.UnitPrice', 'LI.LineTotal'],
    };
    const grandBody: QueryResult = { rows: [{ 'LI.LineTotal': 20 }], rowCount: 1, columns: ['LI.LineTotal'] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeJsonResponse(countBody))
      .mockResolvedValueOnce(makeJsonResponse(aggBody))
      .mockResolvedValueOnce(makeJsonResponse(detailBody))
      .mockResolvedValueOnce(makeJsonResponse(grandBody));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runSqlReport({
      setup: { ...SETUP, connection: CONN },
      config: CONFIG,
      viewMode: 'expand_all',
      confirmLarge: true,
    });

    expect(result.warn_large).toBe(false);
    expect(result.row_count).toBe(90_000);
    expect(result.nested).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. LIVE API SMOKE — guarded by SQL_LIVE=1
//
// To run:
//   SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-engine.test.ts
// ═══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!process.env['SQL_LIVE'])('Live API smoke (SQL_LIVE=1)', () => {
  const LIVE_CONN: SqlConnection = {
    host: 'https://kiflow.kibizsystems.com/sqlite',
    apiKey: '123456',
  };

  it('GET /health returns true', async () => {
    const { checkHealth } = await import('@/lib/sql/sqlClient');
    const healthy = await checkHealth(LIVE_CONN, { timeoutMs: 10_000 });
    expect(healthy).toBe(true);
  }, 15_000);

  it('POST /query SELECT 1 returns row with value=1', async () => {
    const result = await runQuery(
      LIVE_CONN,
      { sql: 'SELECT 1 AS value', params: [] },
      { timeoutMs: 10_000 },
    );
    expect(result.rows.length).toBeGreaterThan(0);
    const firstRow = result.rows[0];
    expect(firstRow).toBeDefined();
    expect(firstRow?.['value']).toBe(1);
  }, 15_000);
});
