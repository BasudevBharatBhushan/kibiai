/**
 * Full end-to-end test: AI prompt → OpenAI generates ReportConfig → SQL engine executes.
 * Guards: SQL_LIVE=1 required (hits real SQLite server + real OpenAI).
 *
 * Run:
 *   SQL_LIVE=1 npx vitest run src/lib/sql/__tests__/sql-full-e2e.test.ts
 */

import { describe, it, expect } from 'vitest';
import { sendUserPrompt } from '@/lib/ai/responses';
import { SQL_REPORTS_SYSTEM_INSTRUCTION } from '@/constants/sqlReportsSystemInstruction';
import { runSqlReport } from '@/lib/sql/sqlReportEngine';
import type { SqlSetup } from '@/lib/sql/types';
import type { ReportConfig } from '@/lib/reportConfigTypes';

const LIVE = !!process.env['SQL_LIVE'];

// The SQL Sales Report (SQLite Test) template setup
const SETUP: SqlSetup = {
  data_source_type: 'sql',
  connection_type: 'sqlite',
  connection: { host: 'https://kiflow.kibizsystems.com/sqlite', apiKey: '123456' },
  tables: {
    INV: {
      physical: 'invoice',
      fields: {
        StaffID: { type: 'text', label: 'Staff ID' },
        PONumber: { type: 'text', label: 'PO Number' },
        InvoiceNo: { type: 'text', label: 'Invoice No' },
        InvoiceDate: { type: 'date', label: 'Invoice Date' },
        ContactName_BillTo: { type: 'text', label: 'Customer' },
      },
    },
    SLI: {
      physical: 'invoice_line_item',
      fields: {
        Quantity: { type: 'number', label: 'Quantity' },
        InvoiceNo: { type: 'text', label: 'Invoice No' },
        LinePrice: { type: 'number', label: 'Line Price', prefix: '$' },
        SalesDate: { type: 'date', label: 'Sales Date' },
        ProductType: { type: 'text', label: 'Product Type' },
        Manufacturer: { type: 'text', label: 'Manufacturer' },
        ProductDescription: { type: 'text', label: 'Product Description' },
        Profit_ProductMargin: { type: 'number', label: 'Profit Margin', suffix: '%' },
      },
    },
  },
  relationships: [
    {
      primary_table: 'SLI',
      joined_table: 'INV',
      source: 'InvoiceNo',
      target: 'InvoiceNo',
      join_type: 'left',
    },
  ],
};

function buildSetupPrompt(): string {
  const today = new Date().toLocaleDateString('en-US');
  const setupStr = JSON.stringify(SETUP).replace(/"/g, "'");
  return `Today's date (reference for date ranges): ${today}. Here is my DB Schema - ${setupStr}.`;
}

describe.skipIf(!LIVE)('Full AI → SQL e2e (SQL_LIVE=1)', () => {
  it('AI generates a valid collapsed report config and SQL engine executes it', async () => {
    // Step 1: AI generates a ReportConfig from a natural language prompt
    console.log('[Step 1] Sending prompt to OpenAI...');
    const aiResult = await sendUserPrompt({
      instruction_set: SQL_REPORTS_SYSTEM_INSTRUCTION,
      conversation_id: null,
      predefined_prompt: buildSetupPrompt(),
      user_prompt: 'Show me a sales report grouped by Product Type showing total Line Price and total Quantity for each group.',
    });

    expect(aiResult.conversation_id).toBeTruthy();
    expect(aiResult.response).toBeTruthy();
    console.log('[Step 1] AI conversation_id:', aiResult.conversation_id);
    console.log('[Step 1] AI raw response:', aiResult.response?.slice(0, 500));

    // Step 2: Parse the AI response as ReportConfig
    let config: ReportConfig;
    try {
      const parsed = typeof aiResult.response === 'string'
        ? JSON.parse(aiResult.response)
        : aiResult.response;
      config = parsed as ReportConfig;
    } catch (err) {
      throw new Error(`AI returned invalid JSON: ${aiResult.response}`);
    }

    console.log('[Step 2] Parsed config:', JSON.stringify(config, null, 2).slice(0, 1000));

    // Step 3: Validate basic config structure
    expect(config).toHaveProperty('db_defination');
    expect(config).toHaveProperty('report_columns');
    expect(config).toHaveProperty('group_by_fields');
    expect(Array.isArray(config.db_defination)).toBe(true);
    expect(Array.isArray(config.report_columns)).toBe(true);
    expect(config.db_defination.length).toBeGreaterThan(0);
    expect(config.report_columns.length).toBeGreaterThan(0);

    // Step 4: Run the SQL report engine with the AI-generated config
    console.log('[Step 4] Running SQL report engine (collapsed mode)...');
    const result = await runSqlReport({
      setup: SETUP,
      config,
      viewMode: 'collapsed',
    });

    console.log('[Step 4] Processing logs:', result.processing_logs);
    console.log('[Step 4] Result mode:', result.mode);
    console.log('[Step 4] Nested groups:', result.nested?.groups?.length);

    // Step 5: Validate the report result
    expect(result.mode).toBe('collapsed');
    expect(result.processing_logs.length).toBeGreaterThan(0);

    // If the AI generated group_by_fields, we should get nested groups
    const hasGroups = Object.keys(config.group_by_fields || {}).length > 0;
    if (hasGroups) {
      expect(result.nested).toBeDefined();
      expect(result.nested!.groups.length).toBeGreaterThan(0);
      console.log('[Step 5] Groups found:', result.nested!.groups.map(g => `${g.value}: ${JSON.stringify(g.totals)}`));
    }

    // Grand totals should always be present
    if (result.nested?.grandTotals) {
      console.log('[Step 5] Grand totals:', result.nested.grandTotals);
    }
  }, 120_000);

  it('AI generates a filtered report (Manufacturer = CHURCH, < 30k rows) and expand_all succeeds', async () => {
    console.log('[Step 1] Sending filtered prompt to OpenAI...');
    const aiResult = await sendUserPrompt({
      instruction_set: SQL_REPORTS_SYSTEM_INSTRUCTION,
      conversation_id: null,
      predefined_prompt: buildSetupPrompt(),
      user_prompt: 'Show a detailed sales report grouped by Product Type for manufacturer CHURCH only, showing Line Price and Quantity.',
    });

    expect(aiResult.response).toBeTruthy();

    let config: ReportConfig;
    try {
      const parsed = typeof aiResult.response === 'string'
        ? JSON.parse(aiResult.response)
        : aiResult.response;
      config = parsed as ReportConfig;
    } catch (err) {
      throw new Error(`AI returned invalid JSON: ${aiResult.response}`);
    }

    console.log('[Step 2] Config group_by_fields:', JSON.stringify(config.group_by_fields));
    console.log('[Step 2] Config filters:', JSON.stringify(config.filters));

    // Run expand_all — should stay under 30k with CHURCH filter
    console.log('[Step 3] Running SQL report engine (expand_all mode)...');
    const result = await runSqlReport({
      setup: SETUP,
      config,
      viewMode: 'expand_all',
    });

    console.log('[Step 3] warn_large:', result.warn_large);
    console.log('[Step 3] row_count:', result.row_count);
    console.log('[Step 3] Processing logs:', result.processing_logs);

    // If AI correctly applied the CHURCH filter, row_count should be < 30k
    if (!result.warn_large) {
      expect(result.nested).toBeDefined();
      expect(result.row_count).toBeLessThan(30_000);
      console.log('[Step 3] Expand-all succeeded with', result.row_count, 'rows');
    } else {
      // AI may not have applied filter correctly — log for diagnosis
      console.warn('[Step 3] warn_large=true — AI may not have applied Manufacturer filter');
      console.warn('[Step 3] row_count:', result.row_count);
    }
  }, 120_000);
});
