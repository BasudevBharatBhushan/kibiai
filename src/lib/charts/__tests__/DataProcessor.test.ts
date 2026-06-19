
import { describe, it, expect, beforeEach } from 'vitest';
import { processData } from '@/lib/charts/DataProcessor';
import { ReportChartSchema } from '@/lib/charts/ChartTypes';
import { resolveFilterDates } from '@/lib/charts/filterDateResolver';
import { bucketDate } from '@/lib/charts/timeBucket';

// Shared flat dataset (already-flat BodyField rows)
const flatData = [
  {"Contact Name": "GIVAUDAN FLAVORS CORP", "Invoice Date": "2026-03-02", "Line Revenue": 4050, "Amount Paid": 2000, "Invoice Total": 5000},
  {"Contact Name": "BASF",                  "Invoice Date": "2026-03-15", "Line Revenue": 2000, "Amount Paid": 1500, "Invoice Total": 3000},
  {"Contact Name": "GIVAUDAN FLAVORS CORP", "Invoice Date": "2026-04-05", "Line Revenue": 1000, "Amount Paid": 900,  "Invoice Total": 1200},
];

const nestedData = [
  {
    "Body": {
      "BodyField": [
        {"Contact Name":"GIVAUDAN FLAVORS CORP","Invoice Date":"2026-03-02","Line Revenue":4050},
        {"Contact Name":"BASF","Invoice Date":"2026-03-15","Line Revenue":2000},
        {"Contact Name":"GIVAUDAN FLAVORS CORP","Invoice Date":"2026-04-05","Line Revenue":1000}
      ]
    }
  }
];

describe('DataProcessor — v1 backward-compatibility', () => {
  const v1Config: ReportChartSchema[] = [{
    pKey: "test-v1",
    filters: ["Invoice Date: >=2026-04-01", "Invoice Date: <=2026-04-30"],
    chart_type: "bar",
    chart_title: "Revenue by Contact",
    group_field: "Contact Name",
    numerical_field: "Line Revenue",     // v1 field
    mathematical_aggregation_method: "sum", // v1 field
    isActive: true
  }];

  it('should process v1 chart schema with numerical_field (admin mode)', () => {
    const result = processData(nestedData, v1Config);
    expect(result[0].categories).toContain('GIVAUDAN FLAVORS CORP');
    expect(result[0].series[0].data).toEqual([1000]);
  });

  it('should ignore absolute date filters in viewer mode', () => {
    const result = processData(nestedData, v1Config, {
      reportStart: "2026-03-01",
      reportEnd: "2026-03-31"
    });
    expect(result[0].categories).toContain('BASF');
    expect(result[0].series[0].data).toEqual(expect.arrayContaining([5050, 2000]));
  });
});

describe('DataProcessor — v2 multi-series (numerical_fields)', () => {
  const v2MultiConfig: ReportChartSchema[] = [{
    pKey: "multi-series",
    chart_type: "column",
    chart_title: "Paid vs Total by Contact",
    group_field: "Contact Name",
    numerical_fields: ["Amount Paid", "Invoice Total"],
    aggregation_method: "sum",
    isActive: true
  }];

  it('should produce 2 series when 2 numerical_fields are specified', () => {
    const result = processData(flatData, v2MultiConfig);
    expect(result[0].series.length).toBe(2);
    expect(result[0].series.map(s => s.name)).toContain("Amount Paid");
    expect(result[0].series.map(s => s.name)).toContain("Invoice Total");
  });
});

describe('DataProcessor — v2 percentage aggregation', () => {
  const percentConfig: ReportChartSchema[] = [{
    pKey: "pct-chart",
    chart_type: "column",
    chart_title: "Revenue Share",
    group_field: "Contact Name",
    numerical_fields: ["Line Revenue"],
    aggregation_method: "percentage",
    isActive: true
  }];

  it('should produce values that sum to 100 across groups', () => {
    const result = processData(flatData, percentConfig);
    const total = result[0].series[0].data.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 1);
  });
});

describe('DataProcessor — v2 gauge chart', () => {
  const gaugeConfig: ReportChartSchema[] = [{
    pKey: "gauge-chart",
    chart_type: "gauge",
    chart_title: "Collection Progress",
    numerical_fields: ["Amount Paid"],
    target_field: "Invoice Total",
    aggregation_method: "sum",
    isActive: true
  }];

  it('should compute target_max from target_field', () => {
    const result = processData(flatData, gaugeConfig);
    expect(result[0].kind).toBe('gauge');
    // Invoice Total sum: 5000 + 3000 + 1200 = 9200
    expect(result[0].target_max).toBe(9200);
  });
});

describe('DataProcessor — v2 time bucket grouping', () => {
  const monthConfig: ReportChartSchema[] = [{
    pKey: "month-group",
    chart_type: "column",
    chart_title: "Revenue by Month",
    group_field: "Invoice Date",
    group_field_time_bucket: "month",
    numerical_fields: ["Line Revenue"],
    aggregation_method: "sum",
    isActive: true
  }];

  it('should bucket daily dates into month labels', () => {
    const result = processData(flatData, monthConfig);
    // Both 2026-03-02 and 2026-03-15 should collapse into "2026-Mar"
    expect(result[0].categories).toContain("2026-Mar");
    expect(result[0].categories).toContain("2026-Apr");
    expect(result[0].categories.length).toBe(2);
  });
});

describe('filterDateResolver — relative date tokens', () => {
  it('resolves TODAY to an ISO date string', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const result = resolveFilterDates("Invoice Date: >=TODAY");
    expect(result).toBe(`Invoice Date: >=${iso}`);
  });

  it('resolves TODAY - 3 Months correctly', () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setMonth(d.getMonth() - 3);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const result = resolveFilterDates("Invoice Date: >=TODAY - 3 Months");
    expect(result).toBe(`Invoice Date: >=${iso}`);
  });

  it('resolves REPORT_START and REPORT_END when context is provided', () => {
    const result = resolveFilterDates(
      "Invoice Date: >=REPORT_START and Invoice Date: <=REPORT_END",
      "2026-01-01",
      "2026-03-31"
    );
    expect(result).toContain("2026-01-01");
    expect(result).toContain("2026-03-31");
  });
});

describe('timeBucket — bucketDate utility', () => {
  it('returns month label for month bucket', () => {
    expect(bucketDate("2026-04-15", "month")).toBe("2026-Apr");
  });

  it('returns year string for year bucket', () => {
    expect(bucketDate("2026-04-15", "year")).toBe("2026");
  });

  it('returns quarter label for quarter bucket', () => {
    expect(bucketDate("2026-04-15", "quarter")).toBe("2026-Q2");
  });

  it('returns day of week for day_of_week bucket', () => {
    // 2026-04-15 is a Wednesday
    expect(bucketDate("2026-04-15", "day_of_week")).toBe("Wednesday");
  });

  it('passes through non-date strings unchanged', () => {
    expect(bucketDate("ACME Corp", "month")).toBe("ACME Corp");
  });
});

describe('DataProcessor — insight cards (v3) backward-compat', () => {
  it('should re-execute insight plans when insight_items are provided', () => {
    const mockInsightConfig: ReportChartSchema[] = [{
      pKey: "insight-chart",
      chart_type: "insight",
      chart_title: "Business Insights",
      isActive: true,
      insight_items: [
        {
          "id": "TOTAL_REVENUE",
          "group": "Revenue",
          "category": "trend",
          "priority_tag": "MONITOR",
          "severity_color": "blue",
          "statement_template": "Total revenue is {total}.",
          "calculations": {
            "total": {
              "scope": "period",
              "description": "Sum of line revenue",
              "formula": "SUM(lineRevenue)"
            }
          },
          "severity_logic": { "high": "total > 0", "medium": "false", "low": "true" },
          "drill_down": {
            "breakdown_by": "contactName",
            "calc_trace": ["total"],
            "overview_kpis": [{ "key": "total", "label": "Total Revenue", "highlighted": true }],
            "trend_bucket": "month"
          }
        }
      ]
    }];

    const result = processData(flatData, mockInsightConfig, {
      reportStart: "2026-03-01",
      reportEnd: "2026-03-31"
    });

    expect(result[0].kind).toBe('insight');
    expect(result[0].insight_results).toBeDefined();
  });
});
