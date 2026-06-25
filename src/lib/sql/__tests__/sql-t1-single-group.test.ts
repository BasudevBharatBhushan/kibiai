/**
 * T1: Single-level group by Customer (SLI JOIN INV).
 * Run: SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-t1-single-group.test.ts
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
        StaffID: { type: 'text', label: 'Staff ID' },
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
        Profit_ProductMargin: { type: 'number', label: 'Profit Margin', suffix: '%' },
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
  report_header: 'Invoice Sales by Customer',
  report_columns: [
    { field: 'InvoiceDate', table: 'INV' },
    { field: 'InvoiceNo', table: 'SLI' },
    { field: 'ProductDescription', table: 'SLI' },
    { field: 'ProductType', table: 'SLI' },
    { field: 'Quantity', table: 'SLI' },
    { field: 'LinePrice', table: 'SLI' },
  ],
  summary_fields: ['Quantity', 'LinePrice'],
  body_sort_order: [{ field: 'InvoiceDate', sort_order: 'asc' }],
  group_by_fields: {
    Customer: {
      field: 'ContactName_BillTo',
      table: 'INV',
      display: [],
      sort_order: 'asc',
      group_total: [
        { field: 'Quantity', table: 'SLI' },
        { field: 'LinePrice', table: 'SLI' },
      ],
    },
  },
  classic_settings: {},
  response_to_user: '',
  date_range_fields: {},
  custom_calculated_fields: [],
};

describe.skipIf(!LIVE)('T1: Single Group by Customer', () => {
  it('collapsed mode returns nested groups with customer subtotals', async () => {
    const result = await runSqlReport({ setup: SETUP, config: CONFIG, viewMode: 'collapsed' });

    console.log('[T1] mode:', result.mode);
    console.log('[T1] groups:', result.nested?.groups?.length);
    console.log('[T1] first group:', result.nested?.groups?.[0]?.value, '→', result.nested?.groups?.[0]?.totals);
    console.log('[T1] grandTotals:', result.nested?.grandTotals);
    console.log('[T1] logs:', result.processing_logs);

    expect(result.mode).toBe('collapsed');
    expect(result.nested).toBeDefined();
    expect(result.nested!.groups.length).toBeGreaterThan(0);

    const firstGroup = result.nested!.groups[0];
    // The first group may have a null customer name (SQLite sorts NULLs first in ASC).
    // Find the first group with a non-null value to validate the field is populated.
    const firstNonNullGroup = result.nested!.groups.find((g) => g.value != null) ?? firstGroup;
    expect(firstNonNullGroup.value).toBeTruthy();
    expect(firstGroup.totals).toBeDefined();
    // Each group should have Quantity and LinePrice totals
    expect(Object.keys(firstGroup.totals).length).toBeGreaterThan(0);

    // Grand totals should exist
    expect(result.nested!.grandTotals).toBeDefined();
    expect(result.nested!.grandTotalCount).toBeGreaterThan(0);

    console.log('[T1] PASS — groups:', result.nested!.groups.length, 'grand total rows:', result.nested!.grandTotalCount);
  }, 60_000);
});
