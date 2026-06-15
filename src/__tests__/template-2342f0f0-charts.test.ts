/**
 * Functional Tests — Chart Generation for Template 2342f0f0
 * Template: 2342f0f0-17a2-40e8-8aa0-88614d729d00
 *
 * Scope: pure functional (vitest, no browser, no Next.js runtime).
 *
 * Strategy:
 *  1. Fetch live template meta (config_json, setup_json) + any saved chart schemas
 *     from Supabase in beforeAll. Tests that rely on live data are skipped when
 *     env vars are absent.
 *  2. Run `processData` against a representative fixture dataset and assert that
 *     every v2 feature (multi-series, time-buckets, gauge, percentage, filters)
 *     produces the expected ChartConfig output shape.
 *
 * Run:
 *   npx vitest run src/__tests__/template-2342f0f0-charts.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { processData } from '@/lib/charts/DataProcessor';
import { deriveFieldSchemas } from '@/lib/insights/fieldSchemaAdapter';
import type { ReportChartSchema } from '@/lib/charts/ChartTypes';

// ─── Template ID ──────────────────────────────────────────────────────────────
const TEMPLATE_ID = '2342f0f0-17a2-40e8-8aa0-88614d729d00';

// ─── Live state fetched in beforeAll ─────────────────────────────────────────
let liveConfigJson: Record<string, unknown> | null = null;
let liveSetupJson: Record<string, unknown> | null = null;
let liveSchemas: ReportChartSchema[] = [];
let supabaseAvailable = false;

// ─── Fixture dataset ──────────────────────────────────────────────────────────
// Mimics the flat-row structure that the chart builder receives after
// report_template_data_json is normalised by DataProcessor.
// Fields use realistic names matching a typical invoice/sales template.
const FIXTURE_ROWS = [
  // March data
  { "Contact Name": "GIVAUDAN FLAVORS CORP", "Invoice Date": "2026-03-02", "Line Revenue": 4050, "Amount Paid": 3500, "Invoice Total": 5000, "Payment Status": "Paid" },
  { "Contact Name": "BASF CORP",             "Invoice Date": "2026-03-08", "Line Revenue": 2000, "Amount Paid": 1000, "Invoice Total": 2500, "Payment Status": "Outstanding" },
  { "Contact Name": "DOW CHEMICAL",          "Invoice Date": "2026-03-15", "Line Revenue": 3200, "Amount Paid": 3200, "Invoice Total": 3200, "Payment Status": "Paid" },
  { "Contact Name": "GIVAUDAN FLAVORS CORP", "Invoice Date": "2026-03-22", "Line Revenue": 1500, "Amount Paid": 500,  "Invoice Total": 1800, "Payment Status": "Partial" },

  // April data
  { "Contact Name": "BASF CORP",             "Invoice Date": "2026-04-05", "Line Revenue": 2800, "Amount Paid": 2800, "Invoice Total": 2800, "Payment Status": "Paid" },
  { "Contact Name": "DOW CHEMICAL",          "Invoice Date": "2026-04-12", "Line Revenue": 1200, "Amount Paid": 600,  "Invoice Total": 1500, "Payment Status": "Partial" },
  { "Contact Name": "GIVAUDAN FLAVORS CORP", "Invoice Date": "2026-04-18", "Line Revenue": 5500, "Amount Paid": 5500, "Invoice Total": 5500, "Payment Status": "Paid" },
  { "Contact Name": "AKZO NOBEL",            "Invoice Date": "2026-04-25", "Line Revenue": 900,  "Amount Paid": 0,    "Invoice Total": 900,  "Payment Status": "Outstanding" },

  // May data
  { "Contact Name": "GIVAUDAN FLAVORS CORP", "Invoice Date": "2026-05-03", "Line Revenue": 6200, "Amount Paid": 4000, "Invoice Total": 7000, "Payment Status": "Partial" },
  { "Contact Name": "BASF CORP",             "Invoice Date": "2026-05-19", "Line Revenue": 3300, "Amount Paid": 3300, "Invoice Total": 3300, "Payment Status": "Paid" },
];

// ─── Shared context (mimics what the report viewer passes to processData) ─────
const REPORT_CONTEXT = {
  reportStart: "2026-03-01",
  reportEnd:   "2026-05-31",
  reportDateField: "Invoice Date",
};

// ─────────────────────────────────────────────────────────────────────────────
// beforeAll — fetch live template data (skipped gracefully if no Supabase creds)
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn('[template-2342f0f0] Supabase env vars not set — live DB assertions will be skipped.');
    return;
  }

  const sb = createClient(url, anonKey);

  // Fetch template meta
  const { data: tmpl, error: tmplErr } = await sb
    .from('report_templates')
    .select('report_template_config_json, report_template_setup_json')
    .eq('report_template_id', TEMPLATE_ID)
    .single();

  if (tmplErr) {
    console.warn('[template-2342f0f0] Cannot fetch template:', tmplErr.message);
    return;
  }

  liveConfigJson = (tmpl?.report_template_config_json as Record<string, unknown>) ?? null;
  liveSetupJson  = (tmpl?.report_template_setup_json  as Record<string, unknown>) ?? null;

  // Fetch saved chart schemas for this template
  const { data: charts, error: chartsErr } = await sb
    .from('chart_templates')
    .select('chart_template_id, chart_template_setup_json, chart_template_dataset_json')
    .eq('report_template_id', TEMPLATE_ID)
    .order('created_at', { ascending: true });

  if (chartsErr) {
    console.warn('Failed to load charts from Supabase:', chartsErr);
  } else if (charts && charts.length > 0) {
    const configJson = liveConfigJson as any;
    let rows: any[] = [];
    if (Array.isArray(configJson?.BodyField)) {
      rows = configJson.BodyField;
    } else if (Array.isArray(configJson)) {
      rows = configJson;
    } else if (configJson && typeof configJson === 'object') {
      const arrayKeys = Object.keys(configJson).filter(k => Array.isArray(configJson[k]));
      if (arrayKeys.length > 0) rows = configJson[arrayKeys[0]];
    }
      
    if (rows.length > 0) {
      console.log('--- AVAILABLE FIELDS (from data row) ---', Object.keys(rows[0]));
    }

    liveSchemas = charts.map((c: any) => {
      const setup   = (c.chart_template_setup_json   as Record<string, unknown>) ?? {};
      const dataset = (c.chart_template_dataset_json as Record<string, unknown>) ?? {};
      
      const targetChart = {
        pKey: c.chart_template_id,
        supabaseId: c.chart_template_id,
        chart_title: (setup.chart_title as string) ?? 'Untitled',
        chart_type:  (dataset.chart_type  as string) ?? (setup.chart_type as string) ?? 'column',
        // v2 fields
        numerical_fields:        (dataset.numerical_fields         as string[])  ?? undefined,
        group_field:             (dataset.group_field              as string)    ?? undefined,
        group_field_time_bucket: (dataset.group_field_time_bucket  as any)       ?? undefined,
        subgroup_field:          (dataset.subgroup_field           as string)    ?? undefined,
        subgroup_field_time_bucket: (dataset.subgroup_field_time_bucket as any)  ?? undefined,
        stacking:                (dataset.stacking                 as any)       ?? undefined,
        aggregation_method:      (dataset.aggregation_method       as any)       ?? undefined,
        target_field:            (dataset.target_field             as string)    ?? undefined,
        target_value:            (dataset.target_value             as number)    ?? undefined,
        filters:                 (dataset.filters                  as string[])  ?? [],
        // v1 backward-compat
        numerical_field:               (dataset.numerical_field               as string) ?? undefined,
        mathematical_aggregation_method: (dataset.mathematical_aggregation_method as any) ?? undefined,
      } satisfies ReportChartSchema;
    });

    console.log(`[template-2342f0f0] Loaded ${liveSchemas.length} chart schema(s) from DB.`);
    liveSchemas.forEach((s, i) => {
      console.log(`  [${i + 1}] "${s.chart_title}" — type: ${s.chart_type}, agg: ${s.aggregation_method ?? s.mathematical_aggregation_method}`);
    });
  } else {
    console.warn('[template-2342f0f0] No saved chart schemas found (chart_templates table empty for this template).');
  }

  supabaseAvailable = true;
}, 20_000);

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Live DB checks (skipped without Supabase creds)
// ═════════════════════════════════════════════════════════════════════════════
describe('DB Integration — Template 2342f0f0 metadata', () => {
  it('template config_json exists in DB', () => {
    if (!supabaseAvailable) return;
    expect(liveConfigJson).not.toBeNull();
  });

  it('template setup_json exists in DB', () => {
    if (!supabaseAvailable) return;
    expect(liveSetupJson).not.toBeNull();
  });

  it('fieldSchemas can be derived from live config+setup JSON', () => {
    if (!supabaseAvailable || !liveConfigJson || !liveSetupJson) return;
    const schemas = deriveFieldSchemas(liveConfigJson, liveSetupJson);
    expect(Array.isArray(schemas)).toBe(true);
    // At least one field should be resolvable for any usable template
    expect(schemas.length).toBeGreaterThan(0);
    schemas.forEach(s => {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('meaning');
    });
    console.log(`[template-2342f0f0] Derived ${schemas.length} field schema(s):`);
    schemas.slice(0, 8).forEach(s => console.log(`  - ${s.name} (${s.type}) → "${s.meaning}"`));
  });

  it('saved chart schemas are parseable and have required v2 shape', () => {
    if (!supabaseAvailable || liveSchemas.length === 0) return;

    liveSchemas.forEach((schema, i) => {
      expect(schema.pKey, `schema[${i}].pKey`).toBeTruthy();
      expect(schema.chart_title, `schema[${i}].chart_title`).toBeTruthy();
      expect(schema.chart_type, `schema[${i}].chart_type`).toBeTruthy();

      if (schema.chart_type !== 'insight') {
        // Either v2 or v1 numerical field must be present
        const hasNumerical = (schema.numerical_fields && schema.numerical_fields.length > 0)
          || !!schema.numerical_field;
        expect(hasNumerical, `schema[${i}] must have numerical_fields or numerical_field`).toBe(true);
      }
    });
  });

  it('processData with live schemas + fixture rows produces non-empty ChartConfig list', () => {
    if (!supabaseAvailable || liveSchemas.length === 0) return;

    const configs = processData(FIXTURE_ROWS, liveSchemas, REPORT_CONTEXT);
    console.log(`[template-2342f0f0] processData produced ${configs.length} ChartConfig(s)`);

    expect(configs.length).toBeGreaterThan(0);
    configs.forEach((cfg, i) => {
      expect(cfg.id, `cfg[${i}].id`).toBeTruthy();
      expect(cfg.kind, `cfg[${i}].kind`).toBeTruthy();
      expect(cfg.title, `cfg[${i}].title`).toBeTruthy();
      // Every non-insight chart must have at least 1 series
      if (cfg.kind !== 'insight') {
        expect(cfg.series.length, `cfg[${i}] must have ≥1 series`).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Fixture-based functional tests (always run, no network required)
// ═════════════════════════════════════════════════════════════════════════════

describe('Functional — v1 backward-compat chart (numerical_field string)', () => {
  const v1Schema: ReportChartSchema[] = [{
    pKey:        "v1-revenue-by-contact",
    chart_title: "Revenue by Contact",
    chart_type:  "column",
    group_field: "Contact Name",
    numerical_field: "Line Revenue",             // v1 single string
    mathematical_aggregation_method: "sum",      // v1 agg field
    isActive: true,
  }];

  it('produces a column chart with 4 categories (one per unique contact)', () => {
    const [cfg] = processData(FIXTURE_ROWS, v1Schema, REPORT_CONTEXT);
    expect(cfg.kind).toBe('column');
    expect(cfg.categories.length).toBe(4);  // GIVAUDAN, BASF, DOW, AKZO
    expect(cfg.series.length).toBe(1);
    expect(cfg.series[0].name).toBe('Line Revenue');
  });

  it('aggregates GIVAUDAN correctly (sum: 4050+1500+5500+6200 = 17250)', () => {
    const [cfg] = processData(FIXTURE_ROWS, v1Schema, REPORT_CONTEXT);
    const givaIdx = cfg.categories.indexOf('GIVAUDAN FLAVORS CORP');
    expect(givaIdx).toBeGreaterThanOrEqual(0);
    expect(cfg.series[0].data[givaIdx]).toBe(17250);
  });
});

describe('Functional — v2 multi-series (numerical_fields array)', () => {
  const v2MultiSchema: ReportChartSchema[] = [{
    pKey:             "v2-paid-vs-total",
    chart_title:      "Amount Paid vs Invoice Total by Contact",
    chart_type:       "column",
    group_field:      "Contact Name",
    numerical_fields: ["Amount Paid", "Invoice Total"],
    aggregation_method: "sum",
    isActive: true,
  }];

  it('produces exactly 2 series', () => {
    const [cfg] = processData(FIXTURE_ROWS, v2MultiSchema, REPORT_CONTEXT);
    expect(cfg.series.length).toBe(2);
    expect(cfg.series.map(s => s.name)).toContain("Amount Paid");
    expect(cfg.series.map(s => s.name)).toContain("Invoice Total");
  });

  it('Amount Paid for BASF is 1000+2800+3300 = 7100', () => {
    const [cfg] = processData(FIXTURE_ROWS, v2MultiSchema, REPORT_CONTEXT);
    const basfIdx = cfg.categories.indexOf('BASF CORP');
    const paidSeries = cfg.series.find(s => s.name === 'Amount Paid')!;
    expect(paidSeries.data[basfIdx]).toBe(7100);
  });
});

describe('Functional — v2 time-bucket grouping (month)', () => {
  const monthSchema: ReportChartSchema[] = [{
    pKey:                  "v2-monthly-revenue",
    chart_title:           "Monthly Revenue Trend",
    chart_type:            "line",
    group_field:           "Invoice Date",
    group_field_time_bucket: "month",
    numerical_fields:      ["Line Revenue"],
    aggregation_method:    "sum",
    isActive: true,
  }];

  it('collapses daily dates into 3 monthly categories', () => {
    const [cfg] = processData(FIXTURE_ROWS, monthSchema, REPORT_CONTEXT);
    expect(cfg.categories).toContain("2026-Mar");
    expect(cfg.categories).toContain("2026-Apr");
    expect(cfg.categories).toContain("2026-May");
    expect(cfg.categories.length).toBe(3);
  });

  it('March revenue is 4050+2000+3200+1500 = 10750', () => {
    const [cfg] = processData(FIXTURE_ROWS, monthSchema, REPORT_CONTEXT);
    const marchIdx = cfg.categories.indexOf("2026-Mar");
    expect(cfg.series[0].data[marchIdx]).toBe(10750);
  });
});

describe('Functional — v2 subgroup + time-bucket (multi-series by year)', () => {
  const subgroupSchema: ReportChartSchema[] = [{
    pKey:                     "v2-monthly-by-status",
    chart_title:              "Monthly Revenue by Payment Status",
    chart_type:               "column",
    group_field:              "Invoice Date",
    group_field_time_bucket:  "month",
    subgroup_field:           "Payment Status",
    numerical_fields:         ["Line Revenue"],
    aggregation_method:       "sum",
    stacking:                 "normal",
    isActive: true,
  }];

  it('produces one series per payment status', () => {
    const [cfg] = processData(FIXTURE_ROWS, subgroupSchema, REPORT_CONTEXT);
    const statusNames = cfg.series.map(s => s.name);
    expect(statusNames).toContain("Paid");
    expect(statusNames).toContain("Outstanding");
    expect(statusNames).toContain("Partial");
  });

  it('has 3 monthly categories', () => {
    const [cfg] = processData(FIXTURE_ROWS, subgroupSchema, REPORT_CONTEXT);
    expect(cfg.categories.length).toBe(3);
  });

  it('stacking is passed through to ChartConfig', () => {
    const [cfg] = processData(FIXTURE_ROWS, subgroupSchema, REPORT_CONTEXT);
    expect(cfg.stacking).toBe('normal');
  });
});

describe('Functional — v2 percentage aggregation', () => {
  const pctSchema: ReportChartSchema[] = [{
    pKey:             "v2-pct-by-contact",
    chart_title:      "Revenue Share by Contact",
    chart_type:       "pie",
    group_field:      "Contact Name",
    numerical_fields: ["Line Revenue"],
    aggregation_method: "percentage",
    isActive: true,
  }];

  it('all category percentages sum to 100', () => {
    const [cfg] = processData(FIXTURE_ROWS, pctSchema, REPORT_CONTEXT);
    const total = cfg.series[0].data.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('GIVAUDAN has largest share', () => {
    const [cfg] = processData(FIXTURE_ROWS, pctSchema, REPORT_CONTEXT);
    const givaIdx = cfg.categories.indexOf('GIVAUDAN FLAVORS CORP');
    const givaShare = cfg.series[0].data[givaIdx];
    cfg.series[0].data.forEach((v, i) => {
      if (i !== givaIdx) expect(givaShare).toBeGreaterThan(v);
    });
  });
});

describe('Functional — v2 gauge chart (target_field)', () => {
  const gaugeSchema: ReportChartSchema[] = [{
    pKey:             "v2-collection-gauge",
    chart_title:      "Invoice Collection Rate",
    chart_type:       "gauge",
    numerical_fields: ["Amount Paid"],
    target_field:     "Invoice Total",
    aggregation_method: "sum",
    isActive: true,
  }];

  it('produces a gauge ChartConfig', () => {
    const [cfg] = processData(FIXTURE_ROWS, gaugeSchema, REPORT_CONTEXT);
    expect(cfg.kind).toBe('gauge');
  });

  it('target_max equals sum of all Invoice Total values', () => {
    const [cfg] = processData(FIXTURE_ROWS, gaugeSchema, REPORT_CONTEXT);
    // Invoice Total sum: 5000+2500+3200+1800+2800+1500+5500+900+7000+3300 = 33500
    expect(cfg.target_max).toBe(33500);
  });

  it('series[0].data[0] equals sum of Amount Paid', () => {
    const [cfg] = processData(FIXTURE_ROWS, gaugeSchema, REPORT_CONTEXT);
    // Amount Paid sum: 3500+1000+3200+500+2800+600+5500+0+4000+3300 = 24400
    expect(cfg.series[0].data[0]).toBe(24400);
  });
});

describe('Functional — v2 top-N limiting and sort order', () => {
  const topNSchema: ReportChartSchema[] = [{
    pKey:             "v2-top2-contacts",
    chart_title:      "Top 2 Contacts by Revenue",
    chart_type:       "bar",
    group_field:      "Contact Name",
    numerical_fields: ["Line Revenue"],
    aggregation_method: "sum",
    limit_count:      2,
    sort_order:       "desc",
    isActive: true,
  }];

  it('limits output to 2 categories', () => {
    const [cfg] = processData(FIXTURE_ROWS, topNSchema, REPORT_CONTEXT);
    expect(cfg.categories.length).toBe(2);
  });

  it('first category is GIVAUDAN (highest revenue)', () => {
    const [cfg] = processData(FIXTURE_ROWS, topNSchema, REPORT_CONTEXT);
    expect(cfg.categories[0]).toBe('GIVAUDAN FLAVORS CORP');
  });
});

describe('Functional — v2 relative date filters (TODAY / REPORT_START / REPORT_END)', () => {
  const relFilterSchema: ReportChartSchema[] = [{
    pKey:             "v2-recent-invoices",
    chart_title:      "Recent Invoices by Contact",
    chart_type:       "column",
    group_field:      "Contact Name",
    numerical_fields: ["Line Revenue"],
    aggregation_method: "sum",
    filters:          ["Invoice Date: >=REPORT_START", "Invoice Date: <=REPORT_END"],
    isActive: true,
  }];

  it('resolves REPORT_START/END tokens and does not drop all data', () => {
    // Context has reportStart=2026-03-01, reportEnd=2026-05-31 → all fixture rows match
    const [cfg] = processData(FIXTURE_ROWS, relFilterSchema, REPORT_CONTEXT);
    expect(cfg.categories.length).toBeGreaterThan(0);
    expect(cfg.series[0].data.every(v => v >= 0)).toBe(true);
  });

  it('hardcoded absolute date filter is stripped in viewer mode', () => {
    // Admin-era schema has absolute date; viewer mode (context present) should ignore it
    const adminSchema: ReportChartSchema[] = [{
      pKey:             "admin-absolute-date",
      chart_title:      "April Only Revenue",
      chart_type:       "column",
      group_field:      "Contact Name",
      numerical_fields: ["Line Revenue"],
      aggregation_method: "sum",
      filters:          ["Invoice Date: >=2026-04-01", "Invoice Date: <=2026-04-30"],
      isActive: true,
    }];

    const [adminCfg] = processData(FIXTURE_ROWS, adminSchema); // no context → admin mode
    const [viewerCfg] = processData(FIXTURE_ROWS, adminSchema, REPORT_CONTEXT); // viewer mode

    // Admin: only April rows → exactly 4 unique contacts in April fixture data
    expect(adminCfg.categories.length).toBeLessThanOrEqual(4);
    expect(adminCfg.categories.length).toBeGreaterThan(0);
    // Viewer: absolute filter stripped → all contacts (including March-only ones) appear
    expect(viewerCfg.categories.length).toBeGreaterThanOrEqual(adminCfg.categories.length);
  });
});

describe('Functional — v2 average aggregation', () => {
  const avgSchema: ReportChartSchema[] = [{
    pKey:             "v2-avg-revenue",
    chart_title:      "Average Invoice Revenue per Contact",
    chart_type:       "bar",
    group_field:      "Contact Name",
    numerical_fields: ["Line Revenue"],
    aggregation_method: "average",
    isActive: true,
  }];

  it('GIVAUDAN average is (4050+1500+5500+6200) / 4 = 4312.5', () => {
    const [cfg] = processData(FIXTURE_ROWS, avgSchema, REPORT_CONTEXT);
    const givaIdx = cfg.categories.indexOf('GIVAUDAN FLAVORS CORP');
    expect(cfg.series[0].data[givaIdx]).toBeCloseTo(4312.5, 1);
  });
});

describe('Functional — v2 count aggregation', () => {
  const countSchema: ReportChartSchema[] = [{
    pKey:             "v2-invoice-count",
    chart_title:      "Invoice Count per Contact",
    chart_type:       "column",
    group_field:      "Contact Name",
    numerical_fields: ["Line Revenue"],
    aggregation_method: "count",
    isActive: true,
  }];

  it('GIVAUDAN has 4 invoices', () => {
    const [cfg] = processData(FIXTURE_ROWS, countSchema, REPORT_CONTEXT);
    const givaIdx = cfg.categories.indexOf('GIVAUDAN FLAVORS CORP');
    expect(cfg.series[0].data[givaIdx]).toBe(4);
  });

  it('AKZO NOBEL has 1 invoice', () => {
    const [cfg] = processData(FIXTURE_ROWS, countSchema, REPORT_CONTEXT);
    const akzoIdx = cfg.categories.indexOf('AKZO NOBEL');
    expect(cfg.series[0].data[akzoIdx]).toBe(1);
  });
});

describe('Functional — nested BodyField input (legacy v1 data shape)', () => {
  const nestedData = [{
    Body: {
      BodyField: FIXTURE_ROWS,
    }
  }];

  const schema: ReportChartSchema[] = [{
    pKey:        "nested-test",
    chart_title: "Revenue by Contact (nested input)",
    chart_type:  "column",
    group_field: "Contact Name",
    numerical_field: "Line Revenue",
    mathematical_aggregation_method: "sum",
    isActive: true,
  }];

  it('extracts BodyField rows and produces the same result as flat input', () => {
    const [fromNested] = processData(nestedData, schema, REPORT_CONTEXT);
    const [fromFlat]   = processData(FIXTURE_ROWS, schema, REPORT_CONTEXT);

    expect(fromNested.categories.sort()).toEqual(fromFlat.categories.sort());
    expect(fromNested.series[0].data.reduce((a, b) => a + b, 0))
      .toBeCloseTo(fromFlat.series[0].data.reduce((a, b) => a + b, 0), 1);
  });
});

describe('Functional — isActive flag', () => {
  const schemas: ReportChartSchema[] = [
    {
      pKey: "active-true",
      chart_title: "Active Chart",
      chart_type: "column",
      group_field: "Contact Name",
      numerical_fields: ["Line Revenue"],
      aggregation_method: "sum",
      isActive: true,
    },
    {
      pKey: "active-number-1",
      chart_title: "Active Chart (number 1)",
      chart_type: "column",
      group_field: "Contact Name",
      numerical_fields: ["Line Revenue"],
      aggregation_method: "sum",
      isActive: 1,
    },
    {
      pKey: "active-string-1",
      chart_title: "Active Chart (string '1')",
      chart_type: "column",
      group_field: "Contact Name",
      numerical_fields: ["Line Revenue"],
      aggregation_method: "sum",
      isActive: "1",
    },
    {
      pKey: "active-false",
      chart_title: "Inactive Chart",
      chart_type: "column",
      group_field: "Contact Name",
      numerical_fields: ["Line Revenue"],
      aggregation_method: "sum",
      isActive: false,
    },
  ];

  it('coerces boolean true/false, number 1, and string "1" correctly', () => {
    const configs = processData(FIXTURE_ROWS, schemas, REPORT_CONTEXT);
    // All 4 schemas produce chart configs (processData doesn't filter by isActive, UI does)
    expect(configs.length).toBe(4);
    expect(configs[0].isActive).toBe(true);
    expect(configs[1].isActive).toBe(true);
    expect(configs[2].isActive).toBe(true);
    expect(configs[3].isActive).toBe(false);
  });
});
