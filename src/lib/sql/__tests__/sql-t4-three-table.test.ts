/**
 * T4: Three-table JOIN — SLI JOIN INV JOIN PRD, grouped by Product Category.
 * Run: SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-t4-three-table.test.ts
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
        ItemNo: { type: 'text', label: 'Item No' },
        Quantity: { type: 'number', label: 'Quantity' },
        LinePrice: { type: 'number', label: 'Line Price', prefix: '$' },
        ProductType: { type: 'text', label: 'Product Type' },
      },
    },
    PRD: {
      physical: 'product',
      fields: {
        ItemNo: { type: 'text', label: 'Item No' },
        ItemName: { type: 'text', label: 'Item Name' },
        ProductCategory: { type: 'text', label: 'Category' },
        AverageCost: { type: 'number', label: 'Average Cost', prefix: '$' },
        CurrentInventory: { type: 'number', label: 'Current Inventory' },
        TotalSold: { type: 'number', label: 'Total Sold' },
      },
    },
  },
  relationships: [
    { primary_table: 'SLI', joined_table: 'INV', source: 'InvoiceNo', target: 'InvoiceNo', join_type: 'left' },
    { primary_table: 'SLI', joined_table: 'PRD', source: 'ItemNo', target: 'ItemNo', join_type: 'left' },
  ],
};

const CONFIG: ReportConfig = {
  filters: {},
  db_defination: [
    { fetch_order: 1, primary_table: 'SLI' },
    { source: 'InvoiceNo', target: 'InvoiceNo', join_type: 'left', fetch_order: 2, joined_table: 'INV', primary_table: 'SLI' },
    { source: 'ItemNo', target: 'ItemNo', join_type: 'left', fetch_order: 3, joined_table: 'PRD', primary_table: 'SLI' },
  ],
  report_header: 'Product Category Sales Analysis',
  report_columns: [
    { field: 'ItemName', table: 'PRD' },
    { field: 'InvoiceDate', table: 'INV' },
    { field: 'ContactName_BillTo', table: 'INV' },
    { field: 'Quantity', table: 'SLI' },
    { field: 'LinePrice', table: 'SLI' },
    { field: 'AverageCost', table: 'PRD' },
  ],
  summary_fields: ['Quantity', 'LinePrice'],
  body_sort_order: [{ field: 'InvoiceDate', sort_order: 'desc' }],
  group_by_fields: {
    'Product Category': {
      field: 'ProductCategory',
      table: 'PRD',
      display: [],
      sort_order: 'desc',
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

describe.skipIf(!LIVE)('T4: Three-Table Product Category Analysis', () => {
  it('collapsed mode returns groups with PRD join data', async () => {
    const result = await runSqlReport({ setup: SETUP, config: CONFIG, viewMode: 'collapsed' });

    console.log('[T4] mode:', result.mode);
    console.log('[T4] product category groups:', result.nested?.groups?.length);
    console.log('[T4] logs:', result.processing_logs);

    expect(result.mode).toBe('collapsed');
    expect(result.nested).toBeDefined();
    expect(result.nested!.groups.length).toBeGreaterThan(0);

    const firstGroup = result.nested!.groups[0];
    console.log('[T4] first category:', firstGroup.value);
    console.log('[T4] first category totals:', firstGroup.totals);
    console.log('[T4] first category count:', firstGroup.count);

    expect(firstGroup.value).toBeTruthy();
    expect(firstGroup.count).toBeGreaterThan(0);
    expect(firstGroup.totals).toBeDefined();

    expect(result.nested!.grandTotals).toBeDefined();
    expect(result.nested!.grandTotalCount).toBeGreaterThan(0);

    console.log('[T4] PASS — categories:', result.nested!.groups.length,
      'grand total rows:', result.nested!.grandTotalCount);
  }, 60_000);
});
