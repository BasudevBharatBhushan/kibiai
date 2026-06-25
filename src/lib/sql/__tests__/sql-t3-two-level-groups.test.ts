/**
 * T3: Two-level group — Customer → Product Type (SLI JOIN INV).
 * Run: SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-t3-two-level-groups.test.ts
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
  report_header: 'Sales by Customer and Product Type',
  report_columns: [
    { field: 'InvoiceDate', table: 'INV' },
    { field: 'InvoiceNo', table: 'SLI' },
    { field: 'ProductDescription', table: 'SLI' },
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
    'Product Type': {
      field: 'ProductType',
      table: 'SLI',
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

describe.skipIf(!LIVE)('T3: Two-Level Groups Customer → Product Type', () => {
  it('collapsed mode returns 2-level nested groups', async () => {
    const result = await runSqlReport({ setup: SETUP, config: CONFIG, viewMode: 'collapsed' });

    console.log('[T3] mode:', result.mode);
    console.log('[T3] top-level groups:', result.nested?.groups?.length);
    console.log('[T3] logs:', result.processing_logs);

    expect(result.mode).toBe('collapsed');
    expect(result.nested).toBeDefined();
    expect(result.nested!.groups.length).toBeGreaterThan(0);

    // Each top-level group (Customer) should have children (Product Type).
    // Skip leading groups whose value is null/empty (data may have NULL customer names
    // that sort first in SQLite) and find the first customer with a truthy value and
    // at least one child that also has a truthy product-type value.
    const firstCustomer = result.nested!.groups.find(
      (g) => g.value && g.children && g.children.length > 0 && g.children.some((c) => c.value),
    ) ?? result.nested!.groups[0];
    console.log('[T3] first customer:', firstCustomer.value);
    console.log('[T3] first customer totals:', firstCustomer.totals);
    console.log('[T3] first customer children:', firstCustomer.children?.length);

    expect(firstCustomer.children).toBeDefined();
    expect(firstCustomer.children!.length).toBeGreaterThan(0);

    const firstProductType = firstCustomer.children!.find((c) => c.value) ?? firstCustomer.children![0];
    console.log('[T3] first product type:', firstProductType.value, '→', firstProductType.totals);

    expect(firstProductType.value).toBeTruthy();
    expect(firstProductType.totals).toBeDefined();

    // Grand totals
    expect(result.nested!.grandTotals).toBeDefined();
    expect(result.nested!.grandTotalCount).toBeGreaterThan(0);

    console.log('[T3] PASS — customers:', result.nested!.groups.length,
      'product types in first customer:', firstCustomer.children!.length,
      'grand total rows:', result.nested!.grandTotalCount);
  }, 60_000);
});
