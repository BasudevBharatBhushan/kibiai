/**
 * T5: Purchase Orders grouped by Vendor (POL JOIN PO) — different table family entirely.
 * Run: SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-t5-purchase-orders.test.ts
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
    PO: {
      physical: 'purchase_order',
      fields: {
        PONumber: { type: 'text', label: 'PO Number' },
        PO_Status: { type: 'text', label: 'PO Status' },
        DateEntered: { type: 'date', label: 'Date Entered' },
        DateReceived: { type: 'date', label: 'Date Received' },
        VendorContactName: { type: 'text', label: 'Vendor' },
        StaffName_Buyer: { type: 'text', label: 'Buyer' },
        Total_cn: { type: 'number', label: 'PO Total', prefix: '$' },
        ECStatus: { type: 'text', label: 'EC Status' },
        JobNo: { type: 'text', label: 'Job No' },
      },
    },
    POL: {
      physical: 'purchase_order_line_item',
      fields: {
        PONumber: { type: 'text', label: 'PO Number' },
        ItemNo: { type: 'text', label: 'Item No' },
        ProductCode: { type: 'text', label: 'Product Code' },
        ProductName: { type: 'text', label: 'Product Name' },
        ProductCategory: { type: 'text', label: 'Category' },
        VendorName: { type: 'text', label: 'Vendor' },
        ChooseCost: { type: 'number', label: 'Unit Cost', prefix: '$' },
        ProjectedCost: { type: 'number', label: 'Projected Cost', prefix: '$' },
        ActualPurch_Qty: { type: 'number', label: 'Purchased Qty' },
        Qty_Received: { type: 'number', label: 'Qty Received' },
        DateReceived: { type: 'date', label: 'Date Received' },
        POStatus: { type: 'text', label: 'PO Status' },
      },
    },
  },
  relationships: [
    { primary_table: 'POL', joined_table: 'PO', source: 'PONumber', target: 'PONumber', join_type: 'left' },
  ],
};

const CONFIG: ReportConfig = {
  filters: { PO: { VendorContactName: '*' } },
  db_defination: [
    { fetch_order: 1, primary_table: 'POL' },
    { source: 'PONumber', target: 'PONumber', join_type: 'left', fetch_order: 2, joined_table: 'PO', primary_table: 'POL' },
  ],
  report_header: 'Purchase Orders by Vendor',
  report_columns: [
    { field: 'PONumber', table: 'PO' },
    { field: 'DateEntered', table: 'PO' },
    { field: 'PO_Status', table: 'PO' },
    { field: 'ProductName', table: 'POL' },
    { field: 'ProductCategory', table: 'POL' },
    { field: 'Qty_Received', table: 'POL' },
    { field: 'ChooseCost', table: 'POL' },
  ],
  summary_fields: ['Qty_Received', 'ChooseCost'],
  body_sort_order: [{ field: 'DateEntered', sort_order: 'desc' }],
  group_by_fields: {
    Vendor: {
      field: 'VendorContactName',
      table: 'PO',
      display: [],
      sort_order: 'asc',
      group_total: [
        { field: 'Qty_Received', table: 'POL' },
        { field: 'ChooseCost', table: 'POL' },
      ],
    },
  },
  classic_settings: {},
  response_to_user: '',
  date_range_fields: {},
  custom_calculated_fields: [],
};

describe.skipIf(!LIVE)('T5: Purchase Orders by Vendor', () => {
  it('collapsed mode groups PO line items by vendor with totals', async () => {
    const result = await runSqlReport({ setup: SETUP, config: CONFIG, viewMode: 'collapsed' });

    console.log('[T5] mode:', result.mode);
    console.log('[T5] vendor groups:', result.nested?.groups?.length);
    console.log('[T5] logs:', result.processing_logs);

    expect(result.mode).toBe('collapsed');
    expect(result.nested).toBeDefined();
    expect(result.nested!.groups.length).toBeGreaterThan(0);

    const firstGroup = result.nested!.groups[0];
    console.log('[T5] first vendor:', firstGroup.value);
    console.log('[T5] first vendor totals:', firstGroup.totals);
    console.log('[T5] first vendor count:', firstGroup.count);

    expect(firstGroup.value).toBeTruthy();
    expect(firstGroup.count).toBeGreaterThan(0);
    expect(firstGroup.totals).toBeDefined();

    expect(result.nested!.grandTotals).toBeDefined();
    expect(result.nested!.grandTotalCount).toBeGreaterThan(0);

    console.log('[T5] PASS — vendors:', result.nested!.groups.length,
      'grand total rows:', result.nested!.grandTotalCount);
  }, 60_000);
});
