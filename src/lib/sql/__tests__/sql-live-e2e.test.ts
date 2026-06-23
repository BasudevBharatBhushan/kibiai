/**
 * T-049 — LIVE end-to-end test of the SQL report engine against the real
 * self-hosted SQLite Bun server (the data source used by the test template
 * "SQL Sales Report (SQLite Test)").
 *
 * GUARDED: skipped unless SQL_LIVE=1 is set, so CI / offline runs never hit
 * the network.
 *
 *   SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-live-e2e.test.ts
 *
 * It exercises the entire pure pipeline (builders → sqlClient → live SQLite →
 * structureAdapter) for all three view modes, mirroring what the API route does.
 */

import { describe, it, expect } from 'vitest';
import { runSqlReport } from '@/lib/sql/sqlReportEngine';
import type { SqlSetup } from '@/lib/sql/types';
import type { ReportConfig } from '@/lib/reportConfigTypes';

const LIVE = !!process.env['SQL_LIVE'];

// Mirrors the setup_json saved on the test template.
const SETUP: SqlSetup = {
  data_source_type: 'sql',
  connection_type: 'sqlite',
  connection: { host: 'https://kiflow.kibizsystems.com/sqlite', apiKey: '123456' },
  tables: {
    SLI: {
      physical: 'invoice_line_item',
      fields: {
        InvoiceNo: { type: 'text', label: 'Invoice No' },
        ProductType: { type: 'text', label: 'Product Type' },
        Manufacturer: { type: 'text', label: 'Manufacturer' },
        LinePrice: { type: 'number', label: 'Line Price', prefix: '$' },
        Quantity: { type: 'number', label: 'Quantity' },
      },
    },
  },
  relationships: [],
};

// "Sales by Product Type" — group by ProductType, sum Line Price.
function baseConfig(): ReportConfig {
  return {
    report_header: 'Sales by Product Type',
    response_to_user: '',
    db_defination: [
      { primary_table: 'SLI', joined_table: '', source: '', target: '', join_type: 'left', fetch_order: 1 },
    ],
    report_columns: [
      { table: 'SLI', field: 'InvoiceNo' },
      { table: 'SLI', field: 'Manufacturer' },
      { table: 'SLI', field: 'LinePrice' },
      { table: 'SLI', field: 'Quantity' },
    ],
    group_by_fields: {
      level0: {
        table: 'SLI',
        field: 'ProductType',
        sort_order: 'asc',
        display: [],
        group_total: [{ table: 'SLI', field: 'LinePrice' }],
      },
    },
    filters: {},
    date_range_fields: {},
    body_sort_order: [],
    summary_fields: ['LinePrice'],
    custom_calculated_fields: [],
  };
}

describe.skipIf(!LIVE)('SQL live e2e (SQL_LIVE=1)', () => {
  it('collapsed: groups by ProductType with SQL-computed totals + grand total', async () => {
    const result = await runSqlReport({ setup: SETUP, config: baseConfig(), viewMode: 'collapsed' });
    expect(result.mode).toBe('collapsed');
    expect(result.nested).toBeDefined();
    const nested = result.nested!;
    // ProductType has 2 distinct values ("Products" and "").
    expect(nested.groups.length).toBeGreaterThanOrEqual(1);
    const products = nested.groups.find((g) => g.value === 'Products');
    expect(products).toBeDefined();
    // SUM(LinePrice) for "Products" is ~72.5M — assert it's a large positive number.
    expect(products!.totals['Line Price']).toBeGreaterThan(1_000_000);
    // Grand total present.
    expect(nested.grandTotals['Line Price']).toBeGreaterThan(1_000_000);
    // Collapsed leaves carry no body rows.
    expect(products!.bodyRows).toBeUndefined();
  }, 60_000);

  it('drilldown: a huge group returns warn_large without fetching rows', async () => {
    const result = await runSqlReport({
      setup: SETUP,
      config: baseConfig(),
      viewMode: 'drilldown',
      groupPath: [{ table: 'SLI', field: 'ProductType', value: 'Products' }],
      confirmLarge: false,
    });
    expect(result.mode).toBe('drilldown');
    expect(result.warn_large).toBe(true);
    expect(result.row_count!).toBeGreaterThan(30_000);
    expect(result.group_rows).toBeUndefined();
  }, 60_000);

  it('expand_all (unfiltered): full report exceeds 30k → warn_large', async () => {
    const result = await runSqlReport({ setup: SETUP, config: baseConfig(), viewMode: 'expand_all' });
    expect(result.warn_large).toBe(true);
    expect(result.row_count!).toBeGreaterThan(300_000);
    expect(result.nested).toBeUndefined();
  }, 60_000);

  it('expand_all (filtered < 30k): assembles nested tree with body rows', async () => {
    const config = baseConfig();
    // Exact-match filter on Manufacturer = CHURCH (~768 rows) keeps us under the guard.
    config.filters = { SLI: { Manufacturer: '=CHURCH' } };
    const result = await runSqlReport({ setup: SETUP, config, viewMode: 'expand_all' });
    expect(result.warn_large).toBe(false);
    expect(result.nested).toBeDefined();
    const nested = result.nested!;
    // Sum of body rows across all leaves equals the filtered row count.
    const totalBody = nested.groups.reduce((sum, g) => sum + (g.bodyRows?.length ?? 0), 0);
    expect(totalBody).toBe(result.row_count);
    expect(result.row_count!).toBeGreaterThan(0);
    expect(result.row_count!).toBeLessThan(30_000);
    // Body rows are label-keyed.
    const firstLeaf = nested.groups.find((g) => (g.bodyRows?.length ?? 0) > 0);
    expect(firstLeaf).toBeDefined();
    expect(firstLeaf!.bodyRows![0]).toHaveProperty('Line Price');
  }, 60_000);
});
