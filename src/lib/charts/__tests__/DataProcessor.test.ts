
import { describe, it, expect } from 'vitest';
import { processData } from '@/lib/charts/DataProcessor';
import { ReportChartSchema } from '@/lib/charts/ChartTypes';

describe('DataProcessor Filtering & Insight Re-computation', () => {
  const mockData = [
    {
      "Body": {
        "BodyField": [
          {"Contact Name":"GIVAUDAN FLAVORS CORP","Invoice Date":"03/02/2026","Line Revenue":4050},
          {"Contact Name":"BASF","Invoice Date":"03/15/2026","Line Revenue":2000},
          {"Contact Name":"GIVAUDAN FLAVORS CORP","Invoice Date":"04/05/2026","Line Revenue":1000}
        ]
      }
    }
  ];

  const mockConfigs: ReportChartSchema[] = [
    {
      "pKey": "test-chart",
      "filters": ["Invoice Date: >=04/01/2026", "Invoice Date: <=04/30/2026"],
      "chart_type": "bar",
      "chart_title": "Revenue by Contact",
      "group_field": "Contact Name",
      "numerical_field": "Line Revenue",
      "isActive": true
    }
  ];

  it('should only show April data in Admin Mode (no context)', () => {
    const result = processData(mockData, mockConfigs);
    // In admin mode, the filter ">=04/01/2026" should be applied.
    // Only the 3rd record matches.
    expect(result[0].categories).toContain('GIVAUDAN FLAVORS CORP');
    expect(result[0].series[0].data).toEqual([1000]);
  });

  it('should show March data in Viewer Mode (ignoring absolute date filters)', () => {
    const result = processData(mockData, mockConfigs, {
      reportStart: "2026-03-01",
      reportEnd: "2026-03-31"
    });
    // In viewer mode, the absolute date filter should be ignored.
    // All records should be processed.
    // GIVAUDAN: 4050 + 1000 = 5050
    // BASF: 2000
    expect(result[0].categories).toContain('GIVAUDAN FLAVORS CORP');
    expect(result[0].categories).toContain('BASF');
    expect(result[0].series[0].data).toEqual(expect.arrayContaining([5050, 2000]));
  });

  it('should re-calculate insights in Viewer Mode when a plan is provided', () => {
    const mockInsightConfig: ReportChartSchema[] = [
      {
        "pKey": "insight-chart",
        "chart_type": "insight",
        "chart_title": "Business Insights",
        "isActive": true,
        "insight_plan": {
          "insights": [
            {
              "id": "TOTAL_REVENUE",
              "category": "trend",
              "statement_template": "Total revenue is {total}",
              "calculations": {
                "total": { "formula": "SUM(lineRevenue)", "meaning": "Total Revenue" }
              },
              "severity_logic": { "high": "total > 0", "medium": "false" }
            }
          ]
        }
      }
    ];

    const result = processData(mockData, mockInsightConfig, {
      reportStart: "2026-03-01",
      reportEnd: "2026-03-31"
    });

    expect(result[0].kind).toBe('insight');
    expect(result[0].insight_results).toBeDefined();
    // GIVAUDAN: 4050, BASF: 2000, GIVAUDAN (April): 1000. Total = 7050
    expect(result[0].insight_results![0].text).toBe('Total revenue is 7,050');
  });
});
