import { ChartConfig, ChartKind, ComputedChartField, ReportChartSchema, InsightContext } from './ChartTypes';
import { v4 as uuidv4 } from 'uuid';
import {
  PROCESSOR_DEFAULTS,
  CHART_TYPE_MAP
} from "@/constants/analytics";
import { executeV3InsightPlan } from '@/lib/insights/v3/scopedExecutor';
import type { FieldSchema } from '@/lib/insights/fieldSchemaAdapter';
import { resolveFilterDates } from './filterDateResolver';
import { bucketDate, TimeBucket, sortTimeLabels } from './timeBucket';


// Helper to recursively extract BodyFields from nested data
function extractBodyFields(data: any): any[] {
  let bodyFields: any[] = [];
  function searchForBodyFields(item: any) {
    if (item?.Body?.BodyField && Array.isArray(item.Body.BodyField)) {
      bodyFields = bodyFields.concat(item.Body.BodyField);
    }
    if (typeof item === 'object' && item !== null) {
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          searchForBodyFields(item[key]);
        }
      }
    }
  }
  searchForBodyFields(data);
  return bodyFields;
}

// Map legacy chart types to ChartKind
function mapChartType(legacyType: string): ChartKind {
  return (CHART_TYPE_MAP[legacyType.toLowerCase()] as ChartKind) || 'column';
}

// Coerce isActive values from FileMaker/JSON into a boolean
function coerceIsActive(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return Boolean(value);
}

function round2(num: number): number {
  if (typeof num !== 'number' || isNaN(num)) return 0;
  return Number(num.toFixed(2));
}

// Main data processing function
export function processData(
  rawData: any[],
  aiConfigs: ReportChartSchema[],
  context?: InsightContext,
  fieldSchemas?: FieldSchema[]
): ChartConfig[] {

  let rawBodyData: any[] = [];

  const isAlreadyFlat = Array.isArray(rawData) && rawData.length > 0 && !rawData.some(item => item.Body || item.TitleHeader);

  if (isAlreadyFlat) {
    rawBodyData = rawData;
  } else {
    rawBodyData = extractBodyFields(rawData);
  }

  console.log(`[DataProcessor] Processing ${rawBodyData.length} rows with ${aiConfigs.length} configs.`);

  // Spread raw items directly — labels are the source of truth.
  // findActualKey handles case/space normalization at lookup time.
  const bodyData = rawBodyData.map((item: any) => ({ ...item }));

  // Date range shared by every card in the current report
  const reportDateRange = context?.reportStart && context?.reportEnd
    ? {
        field: context.reportDateField,
        start: context.reportStart,
        end: context.reportEnd,
      }
    : undefined;

  const results: ChartConfig[] = [];

  aiConfigs.forEach((aiResponse) => {
    const newId = aiResponse.pKey || uuidv4();
    const activeStatus = coerceIsActive(aiResponse.isActive);

    // 1. Handle Insight Cards (v3)
    // insight_results holds the pre-computed v3 results persisted at generation time.
    // If insight_items are present we can re-execute them live against the current dataset.
    if (aiResponse.chart_type === 'insight') {
      const items = aiResponse.insight_items;
      if (!items || !Array.isArray(items) || bodyData.length === 0) {
        // Fall back to cached results if no items to re-execute
        if (aiResponse.insight_results?.length) {
          const insightDateRange = reportDateRange
            ? { field: reportDateRange.field ?? aiResponse.insight_date_range?.field ?? 'Report range', start: reportDateRange.start, end: reportDateRange.end }
            : aiResponse.insight_date_range;
            
          aiResponse.insight_results.forEach((insightResult, idx) => {
            const singleId = aiResponse.insight_results!.length > 1 ? `${newId}-${idx}` : newId;
            results.push({
              id: singleId,
              kind: 'insight',
              title: insightResult.group || aiResponse.chart_title || 'Business Insights',
              isActive: activeStatus,
              categories: [],
              series: [],
              insight_results: [insightResult],
              insight_date_range: insightDateRange,
              report_date_range: reportDateRange,
              layout: { x: 0, y: 0, w: 6, h: 6, i: singleId }
            });
          });
        } else if (aiResponse.business_insights?.length) {
          const insightDateRange = reportDateRange
            ? { field: reportDateRange.field ?? aiResponse.insight_date_range?.field ?? 'Report range', start: reportDateRange.start, end: reportDateRange.end }
            : aiResponse.insight_date_range;
          results.push({
            id: newId,
            kind: 'insight',
            title: aiResponse.chart_title || 'Business Insights',
            isActive: activeStatus,
            categories: [],
            series: [],
            insights: aiResponse.business_insights,
            insight_date_range: insightDateRange,
            report_date_range: reportDateRange,
            layout: { x: 0, y: 0, w: 6, h: 6, i: newId }
          });
        } else {
          console.warn(`[DataProcessor] Skipping insight card ${newId}: no insight_items or data.`);
        }
        return;
      }

      let finalResults;
      try {
        finalResults = executeV3InsightPlan(
          items,
          bodyData,
          { reportStart: context?.reportStart, reportEnd: context?.reportEnd },
          fieldSchemas
        );
      } catch (err) {
        console.error(`[DataProcessor] Failed to execute insight plan for ${newId}:`, err);
        return;
      }

      if (!finalResults || finalResults.length === 0) {
        console.warn(`[DataProcessor] Insight plan for ${newId} produced no results.`);
        return;
      }

      const insightDateRange = reportDateRange
        ? {
            field: reportDateRange.field
              ?? aiResponse.insight_date_range?.field
              ?? 'Report range',
            start: reportDateRange.start,
            end: reportDateRange.end,
          }
        : aiResponse.insight_date_range;

      finalResults.forEach((insightResult, idx) => {
        const singleId = finalResults.length > 1 ? `${newId}-${idx}` : newId;
        results.push({
          id: singleId,
          kind: 'insight',
          title: insightResult.group || aiResponse.chart_title || 'Business Insights',
          isActive: activeStatus,
          categories: [],
          series: [],
          insights: aiResponse.business_insights,
          insight_results: [insightResult],
          insight_date_range: insightDateRange,
          report_date_range: reportDateRange,
          layout: { x: 0, y: 0, w: 6, h: 6, i: singleId }
        });
      });
      return;
    }

    // 2. Handle Charts (v2 + backward-compat v1)
    const {
      chart_title,
      chart_type,
      numerical_fields,
      numerical_field = '',            // v1 backward-compat
      group_field = '',
      group_field_time_bucket,
      subgroup_field = '',
      subgroup_field_time_bucket,
      stacking,
      target_field,
      target_value,
      mathematical_aggregation_method, // v1 backward-compat
      aggregation_method,              // v2 preferred
      filters: filterCriteriaRaw = [],
      computed_field,
      computed_fields,
    } = aiResponse;

    // Resolve aggregation — prefer v2 field, fall back to v1
    const aggMethod = aggregation_method ?? mathematical_aggregation_method;

    // Build the active numerical fields list — support both v1 (string) and v2 (array)
    const activeNumericalFields: string[] =
      numerical_fields && numerical_fields.length > 0
        ? numerical_fields
        : numerical_field
          ? [numerical_field]
          : [];

    // For gauge charts, group_field is optional
    if (!group_field && chart_type !== 'gauge') return;

    const filters = filterCriteriaRaw.length > 0 ? filterCriteriaRaw : [];

    // Resolve relative date tokens in filter strings (v2 feature)
    const resolvedFilters = filters.map(rule =>
      resolveFilterDates(rule, context?.reportStart, context?.reportEnd)
    );

    // Resolves fields like 'totalAmount' back to 'Invoice Total' (or their actual labels in the dataset)
    const findActualKey = (target: string) => {
      if (!target) return null;
      if (bodyData[0] && bodyData[0][target] !== undefined) return target;
      
      const lowerTarget = target.toLowerCase().replace(/\s/g, '');
      if (bodyData[0]) {
        // 1. Exact match ignoring case/spaces
        let match = Object.keys(bodyData[0]).find(k => k.toLowerCase().replace(/\s/g, '') === lowerTarget);
        if (match) return match;

        // 2. Schema lookup (AI uses camelCase safe names, but data uses labels)
        if (fieldSchemas) {
          const schema = fieldSchemas.find(s => s.name === target);
          if (schema) {
            const meaningLower = schema.meaning.toLowerCase().replace(/\s/g, '');
            match = Object.keys(bodyData[0]).find(k => k.toLowerCase().replace(/\s/g, '') === meaningLower);
            if (match) return match;

            const originalLower = schema.originalName.toLowerCase().replace(/\s/g, '');
            match = Object.keys(bodyData[0]).find(k => k.toLowerCase().replace(/\s/g, '') === originalLower);
            if (match) return match;
          }
        }
      }
      return target;
    };

    // --- Computed Field Evaluation (before filtering) ---
    // Evaluate row-level virtual columns so they can be used in filters.
    // Uses new Function() with positional args to handle field names that contain spaces.
    const allComputedFields: ComputedChartField[] = [
      ...(computed_fields ?? []),
      ...(computed_field ? [computed_field] : []),
    ];

    if (allComputedFields.length > 0 && bodyData.length > 0) {
      const dataKeys = Object.keys(bodyData[0]);

      for (const cf of allComputedFields) {
        // Auto-infer dependencies from data keys when not provided by AI.
        // Match data field names against the formula as substrings, longest-first
        // to avoid "Total" matching inside "Invoice Total".
        const deps: string[] = (cf.dependencies && cf.dependencies.length > 0)
          ? cf.dependencies
          : dataKeys
              .filter(k => cf.formula.includes(k))
              .sort((a, b) => b.length - a.length);

        if (deps.length === 0) {
          console.warn(`[DataProcessor] Computed field "${cf.name}": no dependencies found in formula "${cf.formula}"`);
          bodyData.forEach(row => { row[cf.name] = 0; });
          continue;
        }

        const resolvedKeys = deps.map(dep => findActualKey(dep) ?? dep);

        // Sort by descending length before substitution to prevent partial matches
        const sortedDeps = deps
          .map((dep, i) => ({ dep, idx: i }))
          .sort((a, b) => b.dep.length - a.dep.length);

        let rewrittenFormula = cf.formula;
        for (const { dep, idx } of sortedDeps) {
          rewrittenFormula = rewrittenFormula.split(dep).join(`__arg${idx}__`);
        }

        let evalFn: ((...args: number[]) => number) | null = null;
        try {
          const argNames = deps.map((_, i) => `__arg${i}__`);
          evalFn = new Function(...argNames, `return (${rewrittenFormula});`) as (...args: number[]) => number;
        } catch (err) {
          console.warn(`[DataProcessor] Failed to compile computed field "${cf.name}": ${err}`);
          continue;
        }

        for (const row of bodyData) {
          try {
            const args = resolvedKeys.map(key => parseFloat(String(row[key] ?? 0)) || 0);
            const result = evalFn(...args);
            row[cf.name] = isFinite(result) ? result : 0;
          } catch {
            row[cf.name] = 0;
          }
        }
      }
    }

    // --- Filtering ---
    // All resolved filters are applied as-is. Absolute date filters are intentional
    // (e.g. user requesting "only 2025 data"). Relative tokens (REPORT_START, TODAY - X)
    // handle context-sensitive filtering and are already resolved above.
    const activeFilters = resolvedFilters;

    const filteredData = bodyData.filter(item => {
      return activeFilters.every((rule: string) => {
        const [field, condition] = rule.split(':').map(s => s.trim());
        
        // Resilient field lookup for filters
        const getFilterVal = (target: string) => {
          if (item[target] !== undefined) return item[target];
          const lowerT = target.toLowerCase().replace(/\s/g, '');
          for (const k of Object.keys(item)) {
            if (k.toLowerCase().replace(/\s/g, '') === lowerT) return item[k];
          }
          return undefined;
        };

        const resolvedFilterKey = findActualKey(field) || field;
        const rawValue = getFilterVal(resolvedFilterKey);

        // If the field doesn't exist in this row at all (not a raw column and not a
        // computed-field virtual column written above), skip this filter rule rather
        // than evaluating undefined values — which would cause NaN comparisons that
        // silently drop every row and produce a blank chart.
        if (rawValue === undefined) return true;

        if (condition === 'notEmpty') return rawValue !== '' && rawValue !== null && rawValue !== undefined;
        if (condition === 'empty') return rawValue === '' || rawValue === null || rawValue === undefined;
        
        // Date Handling
        const isDateField = field.toLowerCase().includes('date');
        
        if (isDateField) {
          const itemDate = new Date(rawValue);
          if (isNaN(itemDate.getTime())) return true; 

          const condValue = condition.replace(/[>=|<=|>|<|==]/g, '').trim();
          const condDate = new Date(condValue);
          
          if (!isNaN(condDate.getTime())) {
             const itemTs = itemDate.getTime();
             const condTs = condDate.getTime();
             if (condition.startsWith('>=')) return itemTs >= condTs;
             if (condition.startsWith('<=')) return itemTs <= condTs;
             if (condition.startsWith('>')) return itemTs > condTs;
             if (condition.startsWith('<')) return itemTs < condTs;
             if (condition.startsWith('==')) return itemTs === condTs;
          }
        }

        const numVal = parseFloat(rawValue);
        const condNum = parseFloat(condition.replace(/[>=|<=|>|<|==]/g, '').trim());

        if (condition.startsWith('>=')) return numVal >= condNum;
        if (condition.startsWith('<=')) return numVal <= condNum;
        if (condition.startsWith('>')) return numVal > condNum;
        if (condition.startsWith('<')) return numVal < condNum;
        if (condition.startsWith('==')) return rawValue == condition.slice(2);
        
        return true;
      });
    });
    
    if (filteredData.length === 0 && bodyData.length > 0) {
       console.warn(`[DataProcessor] Chart "${chart_title}" is empty after filtering. Original: ${bodyData.length}, Filtered: 0. Rules:`, filters);
    }

    // --- Resilient Group/Numerical Field Access ---


    const actualGroupField = findActualKey(group_field);
    const actualSubgroupField = findActualKey(subgroup_field);

    // --- Time-bucketed group key functions ---
    const getGroupKey = (item: any): string => {
      const raw = item[actualGroupField || group_field];
      return group_field_time_bucket
        ? bucketDate(raw, group_field_time_bucket as TimeBucket)
        : String(raw ?? '');
    };

    const getSubGroupKey = (item: any): string => {
      const raw = item[actualSubgroupField || subgroup_field];
      return subgroup_field_time_bucket
        ? bucketDate(raw, subgroup_field_time_bucket as TimeBucket)
        : String(raw ?? '');
    };

    // --- Grouping ---
    const useSubgroups = subgroup_field && subgroup_field.trim() !== "";
    let labels = [...new Set(filteredData.map(getGroupKey).filter(Boolean))];

    // Sort time-bucketed labels chronologically when no explicit value-sort is requested.
    // Value-based sort (limit_count / sort_order) runs below and will override this if present.
    if (group_field_time_bucket && !aiResponse.sort_order && !aiResponse.limit_count) {
      labels = sortTimeLabels(labels, group_field_time_bucket as TimeBucket);
    }

    if (labels.length === 0) {
      console.warn(`[DataProcessor] No labels found for chart "${chart_title}" using group_field "${group_field}" (Actual: ${actualGroupField})`);
    }

    let allSubgroups = ['default'];
    if (useSubgroups) {
      allSubgroups = [...new Set(filteredData.map(getSubGroupKey).filter(Boolean))];
    }

    // groupedData stores raw row objects so we can look up any numerical field later
    const groupedData: Record<string, Record<string, any[]>> = {};

    filteredData.forEach(item => {
      const groupKey = getGroupKey(item);
      if (!groupKey) return;

      const subGroupKey = useSubgroups ? getSubGroupKey(item) : 'default';
      if (useSubgroups && !subGroupKey) return;

      if (!groupedData[groupKey]) groupedData[groupKey] = {};
      if (!groupedData[groupKey][subGroupKey]) groupedData[groupKey][subGroupKey] = [];
      
      groupedData[groupKey][subGroupKey].push(item);
    });

    // --- Sorting & Limiting (Top/Bottom N) ---
    if (aiResponse.limit_count || aiResponse.sort_order) {
      const order = aiResponse.sort_order || 'desc';
      const primaryNumField = activeNumericalFields[0] || '';
      const actualPrimaryNumField = findActualKey(primaryNumField);

      const labelTotals = labels.map(label => {
        let total = 0;
        allSubgroups.forEach(sub => {
          const items = groupedData[label]?.[sub] || [];
          if (items.length === 0) return;
          const values = items.map((it: any) =>
            parseFloat(it[actualPrimaryNumField || primaryNumField]) || 0
          );
          if (aggMethod === 'sum') total += values.reduce((a, b) => a + b, 0);
          else if (aggMethod === 'average') total += values.reduce((a, b) => a + b, 0) / values.length;
          else if (aggMethod === 'count') total += values.length;
          else total += values.reduce((a, b) => a + b, 0);
        });
        return { label, total };
      });
      
      labelTotals.sort((a, b) => order === 'desc' ? b.total - a.total : a.total - b.total);
      
      const limit = aiResponse.limit_count ? parseInt(String(aiResponse.limit_count), 10) : labelTotals.length;
      labels = labelTotals.slice(0, limit).map(lt => String(lt.label));
    }

    // --- Gauge without group_field: aggregate all rows into a single scalar ---
    if (chart_type === 'gauge' && !group_field) {
      const gaugeSeriesData: { name: string; data: number[] }[] = [];

      for (const numField of activeNumericalFields.length > 0 ? activeNumericalFields : ['']) {
        const actualNumField = findActualKey(numField);
        const values: number[] = filteredData.map(
          (it: any) => parseFloat(it[actualNumField || numField]) || 0
        );

        let scalar = 0;
        if (values.length > 0) {
          if (aggMethod === 'sum' || aggMethod === 'percentage') scalar = values.reduce((a, b) => a + b, 0);
          else if (aggMethod === 'average') scalar = values.reduce((a, b) => a + b, 0) / values.length;
          else if (aggMethod === 'count') scalar = values.length;
          else scalar = values.reduce((a, b) => a + b, 0);
        }

        gaugeSeriesData.push({ name: actualNumField || numField || 'Value', data: [round2(scalar)] });
      }

      // Compute target_max
      let computedTargetMax: number | undefined;
      if (target_field) {
        const actualTargetField = findActualKey(target_field);
        const sum = filteredData.reduce((acc: number, item: any) => {
          return acc + (parseFloat(item[actualTargetField || target_field]) || 0);
        }, 0);
        computedTargetMax = round2(sum);
      }

      const W = PROCESSOR_DEFAULTS.LAYOUT_WIDTH;
      const H = PROCESSOR_DEFAULTS.LAYOUT_HEIGHT;
      results.push({
        id: newId,
        kind: 'gauge',
        title: chart_title,
        isActive: activeStatus,
        supabaseId: aiResponse.supabaseId,
        categories: [],
        series: gaugeSeriesData,
        target_value: target_value ?? computedTargetMax,
        target_max: computedTargetMax,
        computed_field_meta: allComputedFields.length > 0
          ? allComputedFields.map(cf => ({ name: cf.name, formula: cf.formula }))
          : undefined,
        report_date_range: reportDateRange,
        layout: { x: (results.length % 2) * W, y: Math.floor(results.length / 2) * H, w: W, h: H, i: newId },
      });
      return; // skip the generic label-based path below
    }

    // --- Aggregation: outer loop over numerical fields, inner loop over subgroups ---
    const series: { name: string; data: number[] }[] = [];

    for (const numField of activeNumericalFields.length > 0 ? activeNumericalFields : ['']) {
      const actualNumField = findActualKey(numField);

      for (const subgroup of allSubgroups) {
        const data = labels.map(label => {
          const items: any[] = groupedData[label]?.[subgroup] ?? [];
          const values: number[] = items.map(
            (it: any) => parseFloat(it[actualNumField || numField]) || 0
          );

          if (values.length === 0) return 0;
          let val = 0;
          if (aggMethod === 'sum')     val = values.reduce((a, b) => a + b, 0);
          else if (aggMethod === 'average') val = values.reduce((a, b) => a + b, 0) / values.length;
          else if (aggMethod === 'count')   val = values.length;
          // 'percentage' is resolved after all series are built (requires grand total)
          else val = values.reduce((a, b) => a + b, 0); // default to sum for now

          return round2(val);
        });

        const displayField = actualNumField || numField || 'Value';
        const seriesName = activeNumericalFields.length > 1
          ? (subgroup === 'default' ? displayField : `${displayField} (${subgroup})`)
          : (subgroup === 'default' ? displayField : subgroup);

        series.push({ name: seriesName, data });
      }
    }

    // Post-process: convert to percentage if requested
    // grand_total = sum of all values across all series and all labels
    if (aggMethod === 'percentage') {
      const grandTotal = series.reduce(
        (acc, s) => acc + s.data.reduce((a, b) => a + b, 0),
        0
      );
      if (grandTotal > 0) {
        series.forEach(s => {
          s.data = s.data.map(val =>
            parseFloat(((val / grandTotal) * 100).toFixed(2))
          );
        });
      }
    }

    // --- Gauge: compute target_max from target_field ---
    let computedTargetMax: number | undefined;
    if (chart_type === 'gauge' && target_field) {
      const actualTargetField = findActualKey(target_field);
      const sum = filteredData.reduce((acc, item) => {
        const v = parseFloat(item[actualTargetField || target_field]) || 0;
        return acc + v;
      }, 0);
      computedTargetMax = round2(sum);
    }

    // --- Layout ---
    const W = PROCESSOR_DEFAULTS.LAYOUT_WIDTH;
    const H = PROCESSOR_DEFAULTS.LAYOUT_HEIGHT;
    const layout = {
      x: (results.length % 2) * W,
      y: Math.floor(results.length / 2) * H,
      w: W,
      h: H,
      i: newId
    };

    results.push({
      id: newId,
      kind: mapChartType(chart_type),
      title: chart_title,
      isActive: activeStatus,
      supabaseId: aiResponse.supabaseId,
      categories: labels as string[],
      series: series,
      stacking: stacking,
      target_value: target_value ?? computedTargetMax,
      target_max: computedTargetMax,
      filters: activeFilters,
      computed_field_meta: allComputedFields.length > 0
        ? allComputedFields.map(cf => ({ name: cf.name, formula: cf.formula }))
        : undefined,
      report_date_range: reportDateRange,
      layout
    });
  });

  return results;
}
