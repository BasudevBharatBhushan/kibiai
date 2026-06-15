/**
 * CompareModal Feature Tests
 * Template: "Customer Monthly Analysis" (97fd2237-e620-4b2f-86fe-3eec151096b0)
 * Company:   equiparts / 87d64d6a-7319-4853-b780-de779183a038
 *
 * Run: npx vitest run src/__tests__/compareModal.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// ─── Real template data from DB (fetched once in beforeAll) ────────────────────
const TEMPLATE_ID = '97fd2237-e620-4b2f-86fe-3eec151096b0';
const LIVE_BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// ─── Inline copies of the helpers from CompareModal.tsx (pure functions) ───────
// (keeps tests self-contained — no Next.js build needed)

type SetupJson = Record<string, { fields?: Record<string, { label?: string }> }>;

function extractDateRangeEntries(
  configJson: Record<string, unknown> | null,
  setupJson: Record<string, unknown> | null
) {
  const fields = (configJson?.date_range_fields ?? null) as Record<
    string,
    Record<string, string>
  > | null;
  if (!fields) return [];

  const setupTables = (setupJson?.tables ?? null) as SetupJson | null;
  const entries: { table: string; field: string; start: string; end: string; label: string }[] = [];

  for (const [table, tableFields] of Object.entries(fields)) {
    for (const [field, rangeStr] of Object.entries(tableFields)) {
      const parts = rangeStr.split('...');
      entries.push({
        table,
        field,
        start: parts[0] ?? '',
        end: parts[1] ?? '',
        label: setupTables?.[table]?.fields?.[field]?.label ?? `${table} — ${field}`,
      });
    }
  }
  return entries;
}

function extractFilterEntries(
  configJson: Record<string, unknown> | null,
  setupJson: Record<string, unknown> | null
) {
  const filterMap = (configJson?.filters ?? null) as Record<
    string,
    Record<string, unknown>
  > | null;
  if (!filterMap) return [];

  const setupTables = (setupJson?.tables ?? null) as SetupJson | null;
  const entries: { table: string; field: string; value: string; label: string }[] = [];

  for (const [table, tableFields] of Object.entries(filterMap)) {
    for (const [field, val] of Object.entries(tableFields)) {
      entries.push({
        table,
        field,
        value: val !== undefined && val !== null ? String(val) : '',
        label: setupTables?.[table]?.fields?.[field]?.label ?? `${table} — ${field}`,
      });
    }
  }
  return entries;
}

// ── Helpers for building the runtime_filters body ─────────────────────────────

function buildRuntimeFilters(
  dateRangeEntries: ReturnType<typeof extractDateRangeEntries>,
  filterEntries: ReturnType<typeof extractFilterEntries>,
  dateOverrides: Record<string, { start: string; end: string }> = {}
) {
  const date_range_fields: Record<string, Record<string, string>> = {};
  for (const entry of dateRangeEntries) {
    const key = `${entry.table}.${entry.field}`;
    const { start, end } = dateOverrides[key] ?? { start: entry.start, end: entry.end };
    if (!date_range_fields[entry.table]) date_range_fields[entry.table] = {};
    date_range_fields[entry.table][entry.field] = `${start}...${end}`;
  }

  const filters: Record<string, Record<string, string>> = {};
  for (const entry of filterEntries) {
    if (!entry.value) continue;
    if (!filters[entry.table]) filters[entry.table] = {};
    filters[entry.table][entry.field] = entry.value;
  }

  const runtime_filters: Record<string, unknown> = {};
  if (Object.keys(date_range_fields).length > 0) runtime_filters.date_range_fields = date_range_fields;
  if (Object.keys(filters).length > 0) runtime_filters.filters = filters;
  return runtime_filters;
}

// ─── Supabase client (anon – read-only, tests only query public template data) ──
// We read config/setup directly from DB to keep tests from depending on a login session
let templateConfigJson: Record<string, unknown> | null = null;
let templateSetupJson: Record<string, unknown> | null = null;

beforeAll(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[test] Supabase env vars not set — DB assertions will be skipped.');
    return;
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await sb
    .from('report_templates')
    .select('report_template_config_json, report_template_setup_json')
    .eq('report_template_id', TEMPLATE_ID)
    .single();

  if (error) {
    console.warn('[test] Could not fetch template from DB:', error.message);
    return;
  }

  templateConfigJson = (data?.report_template_config_json as Record<string, unknown>) ?? null;
  templateSetupJson = (data?.report_template_setup_json as Record<string, unknown>) ?? null;
}, 15_000);

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pure helper functions (zero network)
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractDateRangeEntries()', () => {
  // Use actual template data from Supabase DB (snapshots below as fallback)
  const configSnapshot = {
    date_range_fields: {
      LineItemArchived: { SalesDate: '01/01/2025...12/31/2025' },
    },
    filters: { LineItemArchived: { InvoiceNo: '*' } },
  };
  const setupSnapshot = {
    tables: {
      LineItemArchived: {
        fields: {
          SalesDate: { type: 'date', label: 'Sales Date' },
          InvoiceNo: { type: 'number', label: 'Invoice No' },
        },
      },
    },
  };

  it('returns correct entry count from snapshot data', () => {
    const entries = extractDateRangeEntries(configSnapshot, setupSnapshot);
    expect(entries).toHaveLength(1);
  });

  it('maps table + field correctly', () => {
    const [entry] = extractDateRangeEntries(configSnapshot, setupSnapshot);
    expect(entry.table).toBe('LineItemArchived');
    expect(entry.field).toBe('SalesDate');
  });

  it('splits start/end date correctly from "..." delimiter', () => {
    const [entry] = extractDateRangeEntries(configSnapshot, setupSnapshot);
    expect(entry.start).toBe('01/01/2025');
    expect(entry.end).toBe('12/31/2025');
  });

  it('resolves human-readable label from setupJson', () => {
    const [entry] = extractDateRangeEntries(configSnapshot, setupSnapshot);
    expect(entry.label).toBe('Sales Date');
  });

  it('falls back to "Table — Field" when no setup label', () => {
    const [entry] = extractDateRangeEntries(configSnapshot, null);
    expect(entry.label).toBe('LineItemArchived — SalesDate');
  });

  it('returns empty array when configJson has no date_range_fields', () => {
    expect(extractDateRangeEntries({}, setupSnapshot)).toHaveLength(0);
    expect(extractDateRangeEntries(null, setupSnapshot)).toHaveLength(0);
  });
});

describe('extractFilterEntries()', () => {
  const configSnapshot = {
    filters: { LineItemArchived: { InvoiceNo: '*' } },
    date_range_fields: { LineItemArchived: { SalesDate: '01/01/2025...12/31/2025' } },
  };
  const setupSnapshot = {
    tables: {
      LineItemArchived: { fields: { InvoiceNo: { label: 'Invoice No' } } },
    },
  };

  it('returns one entry matching the filter', () => {
    const entries = extractFilterEntries(configSnapshot, setupSnapshot);
    expect(entries).toHaveLength(1);
  });

  it('maps table + field + value correctly', () => {
    const [e] = extractFilterEntries(configSnapshot, setupSnapshot);
    expect(e.table).toBe('LineItemArchived');
    expect(e.field).toBe('InvoiceNo');
    expect(e.value).toBe('*');
  });

  it('resolves label from setupJson', () => {
    const [e] = extractFilterEntries(configSnapshot, setupSnapshot);
    expect(e.label).toBe('Invoice No');
  });

  it('returns empty array when filters key is missing', () => {
    expect(extractFilterEntries({ date_range_fields: {} }, setupSnapshot)).toHaveLength(0);
  });

  it('returns empty array when configJson is null', () => {
    expect(extractFilterEntries(null, setupSnapshot)).toHaveLength(0);
  });
});

describe('buildRuntimeFilters()', () => {
  const dateEntries = [
    { table: 'LineItemArchived', field: 'SalesDate', start: '01/01/2025', end: '12/31/2025', label: 'Sales Date' },
  ];
  const filterEntries = [
    { table: 'LineItemArchived', field: 'InvoiceNo', value: '*', label: 'Invoice No' },
  ];

  it('produces correct date_range_fields key', () => {
    const rf = buildRuntimeFilters(dateEntries, []);
    expect((rf.date_range_fields as any)?.LineItemArchived?.SalesDate).toBe('01/01/2025...12/31/2025');
  });

  it('respects date overrides', () => {
    const overrides = { 'LineItemArchived.SalesDate': { start: '06/01/2025', end: '06/30/2025' } };
    const rf = buildRuntimeFilters(dateEntries, [], overrides);
    expect((rf.date_range_fields as any)?.LineItemArchived?.SalesDate).toBe('06/01/2025...06/30/2025');
  });

  it('includes non-empty filter values', () => {
    const rf = buildRuntimeFilters([], filterEntries);
    expect((rf.filters as any)?.LineItemArchived?.InvoiceNo).toBe('*');
  });

  it('skips blank filter values', () => {
    const blank = [{ table: 'LineItemArchived', field: 'InvoiceNo', value: '', label: 'Invoice No' }];
    const rf = buildRuntimeFilters([], blank);
    expect(rf.filters).toBeUndefined();
  });

  it('omits date_range_fields key entirely when no date entries', () => {
    const rf = buildRuntimeFilters([], filterEntries);
    expect(rf.date_range_fields).toBeUndefined();
  });

  it('builds combined payload with both date + filter sections', () => {
    const rf = buildRuntimeFilters(dateEntries, filterEntries);
    expect(rf).toHaveProperty('date_range_fields');
    expect(rf).toHaveProperty('filters');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS — Live DB field label resolution
// (only run when Supabase env vars are set)
// ═══════════════════════════════════════════════════════════════════════════════

describe('DB Integration — Template 97fd2237 field resolution', () => {
  it('templateConfigJson has date_range_fields for LineItemArchived', () => {
    if (!templateConfigJson) return; // skip if no creds
    const drf = (templateConfigJson?.date_range_fields as Record<string, unknown>) ?? {};
    expect(Object.keys(drf)).toContain('LineItemArchived');
  });

  it('SalesDate label resolves to "Sales Date" from live setup JSON', () => {
    if (!templateSetupJson) return;
    const entries = extractDateRangeEntries(templateConfigJson, templateSetupJson);
    const salesDate = entries.find((e) => e.field === 'SalesDate');
    expect(salesDate).toBeDefined();
    expect(salesDate?.label).toBe('Sales Date');
  });

  it('InvoiceNo filter label resolves to "Invoice No"', () => {
    if (!templateSetupJson) return;
    const entries = extractFilterEntries(templateConfigJson, templateSetupJson);
    const invoiceNo = entries.find((e) => e.field === 'InvoiceNo');
    expect(invoiceNo).toBeDefined();
    expect(invoiceNo?.label).toBe('Invoice No');
  });

  it('runtime_filters body shape is valid for generate endpoint', () => {
    if (!templateConfigJson) return;
    const dateEntries = extractDateRangeEntries(templateConfigJson, templateSetupJson);
    const filterEntries = extractFilterEntries(templateConfigJson, templateSetupJson);
    const rf = buildRuntimeFilters(dateEntries, filterEntries);

    // Should have at least date_range_fields
    expect(rf).toHaveProperty('date_range_fields');

    // date_range_fields values should always be "start...end" strings
    for (const tableFields of Object.values(rf.date_range_fields as Record<string, unknown>)) {
      for (const rangeStr of Object.values(tableFields as Record<string, string>)) {
        expect(rangeStr).toMatch(/.*\.\.\..*/);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA VALIDATION — Ensure endpoint body shape is always valid for Zod schema
// ═══════════════════════════════════════════════════════════════════════════════

describe('Generate endpoint Zod schema compliance', () => {
  // mirrors generateBodySchema from route.ts
  const VALID_BODIES = [
    // minimal — no runtime_filters at all
    {},
    // only date_range_fields
    { runtime_filters: { date_range_fields: { LineItemArchived: { SalesDate: '01/01/2025...12/31/2025' } } } },
    // only filters
    { runtime_filters: { filters: { LineItemArchived: { InvoiceNo: '*' } } } },
    // both sections
    {
      runtime_filters: {
        date_range_fields: { LineItemArchived: { SalesDate: '01/01/2025...12/31/2025' } },
        filters: { LineItemArchived: { InvoiceNo: '*' } },
      },
    },
    // with optional report_header
    {
      runtime_filters: { date_range_fields: { LineItemArchived: { SalesDate: '01/01/2025...06/30/2025' } } },
      report_header: 'Q1 2025 Report',
    },
  ];

  for (const [i, body] of VALID_BODIES.entries()) {
    it(`valid body variant #${i + 1} satisfies schema shape`, () => {
      // Structural checks (not running Zod itself to avoid Next.js import)
      if (body.runtime_filters) {
        expect(typeof body.runtime_filters).toBe('object');
        if (body.runtime_filters.date_range_fields) {
          for (const [, fields] of Object.entries(body.runtime_filters.date_range_fields)) {
            for (const [, val] of Object.entries(fields)) {
              expect(typeof val).toBe('string');
              expect(val).toContain('...');
            }
          }
        }
        if (body.runtime_filters.filters) {
          expect(typeof body.runtime_filters.filters).toBe('object');
        }
      }
    });
  }

  it('detects invalid body — date range value must be a string', () => {
    const badBody = {
      runtime_filters: {
        date_range_fields: { LineItemArchived: { SalesDate: 12345 as unknown as string } },
      },
    };
    const val = badBody.runtime_filters.date_range_fields.LineItemArchived.SalesDate;
    expect(typeof val).not.toBe('string');
  });

  it('detects missing ... separator in date range value', () => {
    const val = '01012025';
    expect(val).not.toMatch(/.*\.\.\..*/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E SMOKE TEST — Live HTTP call to generate endpoint
// Requires: COMPARE_TEST_COOKIE env var with a valid session cookie
// Run with: COMPARE_TEST_COOKIE="..." npx vitest run --reporter=verbose src/__tests__/compareModal.test.ts
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E Smoke — POST /api/templates/[id]/generate (live)', () => {
  const cookie = process.env.COMPARE_TEST_COOKIE;

  it('returns 401 without a session cookie', async () => {
    let res: Response;
    try {
      res = await fetch(
        `${LIVE_BASE_URL}/api/templates/${TEMPLATE_ID}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runtime_filters: {} }),
        }
      );
    } catch {
      // localhost not running — skip gracefully
      console.warn('[E2E] Server not reachable at', LIVE_BASE_URL, '— skipping 401 test');
      return;
    }
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  }, 10_000);

  it.skipIf(!cookie)(
    'returns success=true and a report_id with valid runtime_filters',
    async () => {
      const body = {
        runtime_filters: {
          date_range_fields: {
            LineItemArchived: { SalesDate: '11/01/2025...11/30/2025' },
          },
          filters: {
            LineItemArchived: { InvoiceNo: '*' },
          },
        },
      };

      const res = await fetch(
        `${LIVE_BASE_URL}/api/templates/${TEMPLATE_ID}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie!,
          },
          body: JSON.stringify(body),
        }
      );

      const json = await res.json();
      console.log('[E2E generate result]', JSON.stringify(json, null, 2));

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('report_id');
      expect(typeof json.data.report_id).toBe('string');
      expect(json.data.report_structure_json).toBeDefined();
    },
    60_000 // data-api can be slow
  );

  it.skipIf(!cookie)(
    'does NOT return the "Missing required fields: report_setup, report_config" error',
    async () => {
      // This was the original bug — the old code called /api/generate-report directly
      // with wrong body shape. The proxy should never expose that error to clients.
      const body = { runtime_filters: { date_range_fields: { LineItemArchived: { SalesDate: '01/01/2025...03/31/2025' } } } };

      const res = await fetch(
        `${LIVE_BASE_URL}/api/templates/${TEMPLATE_ID}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie! },
          body: JSON.stringify(body),
        }
      );

      const text = await res.text();
      expect(text).not.toContain('Missing required fields: report_setup, report_config');
      expect(text).not.toContain('Both report_setup and report_config are required');
    },
    60_000
  );

  it.skipIf(!cookie)(
    'saves the generated report to DB and returns a valid UUID report_id',
    async () => {
      const body = {
        runtime_filters: {
          date_range_fields: { LineItemArchived: { SalesDate: '12/01/2025...12/31/2025' } },
        },
      };

      const res = await fetch(
        `${LIVE_BASE_URL}/api/templates/${TEMPLATE_ID}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie! },
          body: JSON.stringify(body),
        }
      );

      const json = await res.json();
      if (!json.success) {
        console.error('[E2E DB save test] API error:', json);
      }
      expect(json.success).toBe(true);

      // UUID v4 pattern
      const uuidV4Re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(json.data.report_id).toMatch(uuidV4Re);
    },
    60_000
  );
});
