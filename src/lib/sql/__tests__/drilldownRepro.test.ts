// ---------------------------------------------------------------------------
// REPRODUCTION TEST for the drilldown failure on template
// 1ddef906-d910-4515-af8a-52db0262b5c1 ("Test SQL Report").
//
// Error observed in the app when expanding a group header:
//   sqlReportEngine [drilldown, count]: query execution failed —
//   SqlClientError [400]: no such column: t_purchase_order_line_item.DateReceived
//
// This test uses the EXACT config + setup pulled from Supabase and compares:
//   Case A — buildCountQuery WITHOUT dateBreakdown   (pre-T-052 / deployed path)
//   Case B — buildCountQuery WITH    dateBreakdown   (current unstaged path)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { buildCountQuery } from '../builders';
import type { ReportConfig } from '../../reportConfigTypes';
import type { SqlSetup } from '../types';
import type { DateBreakdown } from '../dateBreakdown';

// --- Exact config from report_template_config_json ---------------------------
const config = {
  filters: { product: { ProductCategory: '*' } },
  db_defination: [{ fetch_order: 1, primary_table: 'product' }],
  report_header: 'Inventory Summary by Product Category (Category Not Empty)',
  report_columns: [
    { field: 'ItemNo', table: 'product' },
    { field: 'ItemName', table: 'product' },
    { field: 'CurrentInventory', table: 'product' },
    { field: 'AverageCost', table: 'product' },
  ],
  summary_fields: ['CurrentInventory', 'AverageCost'],
  body_sort_order: [{ field: 'ItemNo', sort_order: 'asc' }],
  group_by_fields: {
    ProductCategory: {
      field: 'ProductCategory',
      table: 'product',
      display: [],
      sort_order: 'asc',
      group_total: [
        { field: 'CurrentInventory', table: 'product' },
        { field: 'AverageCost', table: 'product' },
      ],
    },
  },
  date_range_fields: {},
  custom_calculated_fields: [],
} as unknown as ReportConfig;

// --- Minimal setup carrying only the two tables the test touches ------------
const setup = {
  data_source_type: 'sql',
  connection_type: 'sqlite',
  connection: { host: 'http://localhost/sqlite', apiKey: 'x' },
  tables: {
    product: {
      physical: 'product',
      fields: {
        ItemNo: { type: 'text', label: 'Item No' },
        ItemName: { type: 'text', label: 'Item Name' },
        AverageCost: { type: 'text', label: 'Average Cost', prefix: '$' },
        ProductCategory: { type: 'text', label: 'Category' },
        CurrentInventory: { type: 'text', label: 'Current Inventory' },
        CreationTimestamp: { type: 'date', label: 'Created At' },
      },
    },
    purchase_order_line_item: {
      physical: 'purchase_order_line_item',
      fields: {
        DateReceived: { type: 'date', label: 'Date Received' },
        ProductCategory: { type: 'text', label: 'Product Category' },
      },
    },
  },
} as unknown as SqlSetup;

// The groupFilter the app sends when you click the "Category" group header.
const groupFilter = [
  { table: 'product', field: 'ProductCategory', value: 'Widgets' },
];

// mappedDateBreakdown derived from classic_settings.dateBreakdown.field
// = "purchase_order_line_item.DateReceived"
const dateBreakdown: DateBreakdown = {
  table: 'purchase_order_line_item',
  field: 'DateReceived',
  interval: 'Month',
};

describe('drilldown count query — template 1ddef906', () => {
  it('CASE A (deployed / no dateBreakdown): only references the joined product table', () => {
    const q = buildCountQuery(config, setup, groupFilter);
    console.log('\n===== CASE A (WITHOUT dateBreakdown) =====\n' + q.sql + '\n');

    // FROM clause has product only.
    expect(q.sql).toContain('FROM "product" AS "t_product"');
    // It must NOT reference the un-joined purchase_order_line_item table.
    expect(q.sql).not.toContain('purchase_order_line_item');
  });

  it('CASE B (current / with dateBreakdown): references an un-joined table → invalid SQL', () => {
    const q = buildCountQuery(config, setup, groupFilter, dateBreakdown);
    console.log('\n===== CASE B (WITH dateBreakdown) =====\n' + q.sql + '\n');

    // The CTE now emits a bucket column over purchase_order_line_item.DateReceived,
    // but the FROM clause STILL only has product (db_defination has no join to POLI).
    expect(q.sql).toContain('FROM "product" AS "t_product"');
    // This is the smoking gun: the query references t_purchase_order_line_item
    // which is never joined → SQLite "no such column".
    expect(q.sql).toContain('"t_purchase_order_line_item"."DateReceived"');
    expect(q.sql).not.toContain('JOIN "purchase_order_line_item"');
  });
});
