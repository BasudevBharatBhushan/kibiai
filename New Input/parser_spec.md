# Highcharts Application-Level Parser Specification

This document details the parser and aggregation functions required to map the AI's JSON chart instructions to Highcharts datasets.

## 1. Date Extraction Helpers
Implement these helpers to parse standard Date formats into grouping buckets.

```typescript
// Extracts year (e.g., "2026")
function getYear(date: Date | string): string {
  const d = new Date(date);
  return d.getFullYear().toString();
}

// Extracts month name (e.g., "Jan", "February")
function getMonth(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('default', { month: 'short' });
}

// Extracts quarter (e.g., "Q1" - "Q4")
function getQuarter(date: Date | string): string {
  const d = new Date(date);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q}`;
}

// Extracts day of week name (e.g., "Monday" - "Sunday")
function getDayOfWeek(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('default', { weekday: 'long' });
}

// Extracts ISO week number (1 - 53)
function getWeekNumber(date: Date | string): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Utility to dispatch time bucket transformations
function formatTimeBucket(dateStr: string, bucket: string): string {
  switch (bucket) {
    case 'year': return getYear(dateStr);
    case 'month': return getMonth(dateStr);
    case 'quarter': return getQuarter(dateStr);
    case 'day_of_week': return getDayOfWeek(dateStr);
    case 'week': return `Week ${getWeekNumber(dateStr)}`;
    default: return dateStr;
  }
}
```

## 2. Aggregation Helper Functions
Use these core math functions on the grouped record arrays.

```typescript
function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function average(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function count(values: any[]): number {
  return values.length;
}

function percentage(values: number[], total: number): number {
  return total ? (sum(values) / total) * 100 : 0;
}
```

## 3. Core Parser Pipeline
Main pipeline implementation to transform raw database records into Highcharts-ready series and categories.

```typescript
interface ChartPlan {
  chart_type: string;
  numerical_fields: string[];
  group_field: string;
  group_field_time_bucket?: string;
  subgroup_field?: string;
  subgroup_field_time_bucket?: string;
  aggregation_method: 'sum' | 'average' | 'count' | 'percentage';
  limit_count?: number;
  sort_order?: 'asc' | 'desc';
  stacking?: 'none' | 'normal' | 'percent';
}

function parseAndAggregate(records: any[], plan: ChartPlan) {
  const groupedData: { [key: string]: any[] } = {};
  
  // 1. Group records by primary group key
  records.forEach(record => {
    let groupKey = record[plan.group_field];
    if (plan.group_field_time_bucket && groupKey) {
      groupKey = formatTimeBucket(groupKey, plan.group_field_time_bucket);
    }
    if (!groupKey) groupKey = 'N/A';
    
    if (!groupedData[groupKey]) {
      groupedData[groupKey] = [];
    }
    groupedData[groupKey].push(record);
  });

  // 2. Extract unique categories (X-Axis labels)
  let categories = Object.keys(groupedData);

  // Calculate grand total for percentage calculations
  const allNumericalValues = records.map(r => Number(r[plan.numerical_fields[0]]) || 0);
  const grandTotal = sum(allNumericalValues);

  // 3. Process aggregation and subgrouping
  const seriesMap: { [seriesName: string]: number[] } = {};
  
  if (plan.subgroup_field) {
    // Collect all unique subgroup keys (e.g., statuses or years)
    const subgroupKeysSet = new Set<string>();
    records.forEach(record => {
      let subKey = record[plan.subgroup_field!];
      if (plan.subgroup_field_time_bucket && subKey) {
        subKey = formatTimeBucket(subKey, plan.subgroup_field_time_bucket!);
      }
      subgroupKeysSet.add(subKey || 'Other');
    });
    const subgroupKeys = Array.from(subgroupKeysSet);

    // Initialize series for each subgroup
    subgroupKeys.forEach(subKey => {
      seriesMap[subKey] = new Array(categories.length).fill(0);
    });

    // Populate values
    categories.forEach((catKey, catIdx) => {
      const catRecords = groupedData[catKey];
      catRecords.forEach(rec => {
        let subKey = rec[plan.subgroup_field!];
        if (plan.subgroup_field_time_bucket && subKey) {
          subKey = formatTimeBucket(subKey, plan.subgroup_field_time_bucket!);
        }
        subKey = subKey || 'Other';

        // Add first numerical field to subgroup
        const val = Number(rec[plan.numerical_fields[0]]) || 0;
        seriesMap[subKey][catIdx] += val;
      });
    });

    // Post-aggregation step (e.g. average)
    subgroupKeys.forEach(subKey => {
      categories.forEach((catKey, catIdx) => {
        const catRecords = groupedData[catKey].filter(rec => {
          let sKey = rec[plan.subgroup_field!];
          if (plan.subgroup_field_time_bucket && sKey) {
            sKey = formatTimeBucket(sKey, plan.subgroup_field_time_bucket!);
          }
          return (sKey || 'Other') === subKey;
        });

        const numValues = catRecords.map(r => Number(r[plan.numerical_fields[0]]) || 0);
        if (plan.aggregation_method === 'average') {
          seriesMap[subKey][catIdx] = average(numValues);
        } else if (plan.aggregation_method === 'count') {
          seriesMap[subKey][catIdx] = count(numValues);
        } else if (plan.aggregation_method === 'percentage') {
          seriesMap[subKey][catIdx] = percentage(numValues, grandTotal);
        }
      });
    });

  } else {
    // Multi-series logic (one series per numerical field)
    plan.numerical_fields.forEach(numField => {
      seriesMap[numField] = [];
      categories.forEach(catKey => {
        const catRecords = groupedData[catKey];
        const numValues = catRecords.map(r => Number(r[numField]) || 0);

        let finalVal = 0;
        if (plan.aggregation_method === 'sum') {
          finalVal = sum(numValues);
        } else if (plan.aggregation_method === 'average') {
          finalVal = average(numValues);
        } else if (plan.aggregation_method === 'count') {
          finalVal = count(numValues);
        } else if (plan.aggregation_method === 'percentage') {
          finalVal = percentage(numValues, grandTotal);
        }
        seriesMap[numField].push(finalVal);
      });
    });
  }

  // 4. Sort and Limit (Max 15 categories constraint)
  const sortIndexes = categories.map((_, idx) => idx);
  if (plan.sort_order) {
    const primarySeries = Object.values(seriesMap)[0];
    sortIndexes.sort((a, b) => {
      const valA = primarySeries[a];
      const valB = primarySeries[b];
      return plan.sort_order === 'asc' ? valA - valB : valB - valA;
    });
  }

  // Enforce Max 15 slots rule
  const limit = plan.limit_count ? Math.min(plan.limit_count, 15) : 15;
  const targetIndexes = sortIndexes.slice(0, limit);

  // Slice categories and series data
  const finalCategories = targetIndexes.map(idx => categories[idx]);
  const finalSeries = Object.keys(seriesMap).map(name => ({
    name,
    data: targetIndexes.map(idx => Number(seriesMap[name][idx].toFixed(2)))
  }));

  return {
    categories: finalCategories,
    series: finalSeries
  };
}
```
