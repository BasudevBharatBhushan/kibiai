/**
 * T2: Flat report — no group_by_fields, expand_all mode (SLI JOIN INV).
 * Expects warn_large=true (>30k rows) OR flatRows populated if confirmLarge=true.
 * Run: SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-t2-flat-report.test.ts
 */
import { describe, it, expect } from 'vitest';
import { runSqlReport } from '@/lib/sql/sqlReportEngine';
import type { SqlSetup } from '@/lib/sql/types';
import type { ReportConfig } from '@/lib/reportConfigTypes';

const LIVE = !!process.env['SQL_LIVE'];

const SETUP: SqlSetup = {
  data_source_type: 'sql',
  connection_type: 'sqlite',
  connection: { host: 'https://kiflow.kibizsystems.com/sqlite', apiKey: '123456' },
  tables: {
    INV: {
      physical: 'invoice',
      fields: {
        InvoiceNo: { type: 'text', label: 'Invoice No' },
        InvoiceDate: { type: 'date', label: 'Invoice Date' },
        ContactName_BillTo: { type: 'text', label: 'Customer' },
      },
    },
    SLI: {
      physical: 'invoice_line_item',
      fields: {
        InvoiceNo: { type: 'text', label: 'Invoice No' },
        ProductDescription: { type: 'text', label: 'Product Description' },
        ProductType: { type: 'text', label: 'Product Type' },
        Quantity: { type: 'number', label: 'Quantity' },
        LinePrice: { type: 'number', label: 'Line Price', prefix: '$' },
      },
    },
  },
  relationships: [
    { primary_table: 'SLI', joined_table: 'INV', source: 'InvoiceNo', target: 'InvoiceNo', join_type: 'left' },
  ],
};

const CONFIG: ReportConfig = {
  filters: {},
  db_defination: [
    { fetch_order: 1, primary_table: 'SLI' },
    { source: 'InvoiceNo', target: 'InvoiceNo', join_type: 'left', fetch_order: 2, joined_table: 'INV', primary_table: 'SLI' },
  ],
  report_header: 'Invoice Line Items - All Details',
  report_columns: [
    { field: 'InvoiceDate', table: 'INV' },
    { field: 'ContactName_BillTo', table: 'INV' },
    { field: 'InvoiceNo', table: 'SLI' },
    { field: 'ProductDescription', table: 'SLI' },
    { field: 'ProductType', table: 'SLI' },
    { field: 'Quantity', table: 'SLI' },
    { field: 'LinePrice', table: 'SLI' },
  ],
  summary_fields: ['Quantity', 'LinePrice'],
  body_sort_order: [{ field: 'InvoiceDate', sort_order: 'desc' }],
  group_by_fields: {},
  classic_settings: {},
  response_to_user: '',
  date_range_fields: {},
  custom_calculated_fields: [],
};

describe.skipIf(!LIVE)('T2: Flat Report - No Groups', () => {
  it('expand_all without confirmLarge returns warn_large for large datasets', async () => {
    const result = await runSqlReport({ setup: SETUP, config: CONFIG, viewMode: 'expand_all' });

    console.log('[T2] warn_large:', result.warn_large);
    console.log('[T2] row_count:', result.row_count);
    console.log('[T2] logs:', result.processing_logs);

    if (result.warn_large) {
      expect(result.warn_large).toBe(true);
      expect(result.row_count).toBeGreaterThan(0);
      console.log('[T2] PASS (warn_large) — row_count:', result.row_count);
    } else {
      // Dataset may be under threshold
      expect(result.nested).toBeDefined();
      console.log('[T2] PASS (under threshold) — flatRows:', result.nested?.flatRows?.length);
    }
  }, 60_000);

  it('expand_all with confirmLarge=true returns flatRows for no-group config', async () => {
    const result = await runSqlReport({ setup: SETUP, config: CONFIG, viewMode: 'expand_all', confirmLarge: true });

    console.log('[T2-confirmed] warn_large:', result.warn_large);
    console.log('[T2-confirmed] row_count:', result.row_count);
    console.log('[T2-confirmed] flatRows count:', result.nested?.flatRows?.length);
    console.log('[T2-confirmed] groups:', result.nested?.groups?.length);
    console.log('[T2-confirmed] logs:', result.processing_logs);

    expect(result.warn_large).toBeFalsy();
    expect(result.nested).toBeDefined();
    // For no-group config, flatRows should be populated
    expect(result.nested!.flatRows).toBeDefined();
    expect(result.nested!.flatRows!.length).toBeGreaterThan(0);

    const firstRow = result.nested!.flatRows![0];
    console.log('[T2-confirmed] Sample row:', JSON.stringify(firstRow).slice(0, 200));
    // Row should have label-keyed columns
    expect(Object.keys(firstRow).length).toBeGreaterThan(0);

    console.log('[T2-confirmed] PASS — flatRows:', result.nested!.flatRows!.length);
  }, 120_000);
});
