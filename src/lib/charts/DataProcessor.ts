import { ChartConfig, ChartKind, ReportChartSchema, InsightContext } from './ChartTypes';
import { v4 as uuidv4 } from 'uuid';
import { 
  PROCESSOR_DEFAULTS, 
  CHART_TYPE_MAP 
} from "@/constants/analytics";
import { executeInsightPlan } from '@/lib/insights/insightFormulaExecutor';

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

// Main data processing function
export function processData(
  rawData: any[], 
  aiConfigs: ReportChartSchema[],
  context?: InsightContext
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

  const results: ChartConfig[] = [];

  aiConfigs.forEach((aiResponse) => {
    const newId = aiResponse.pKey || uuidv4();
    const activeStatus = coerceIsActive(aiResponse.isActive);

    // 1. Handle Insight Cards
    if (aiResponse.chart_type === 'insight' || aiResponse.insight_plan || aiResponse.insight_results) {
      
      let finalResults = aiResponse.insight_results;
      
      // If we have a plan, re-calculate based on current data
      if (aiResponse.insight_plan && bodyData.length > 0) {
        try {
          console.log(`[DataProcessor] Re-calculating insights for chart ${newId}`);
          finalResults = executeInsightPlan(aiResponse.insight_plan, bodyData, {
            reportStart: context?.reportStart,
            reportEnd: context?.reportEnd
          });
        } catch (err) {
          console.error(`[DataProcessor] Failed to execute insight plan for ${newId}:`, err);
        }
      }

      results.push({
        id: newId,
        kind: 'insight',
        title: aiResponse.chart_title || 'Business Insights',
        isActive: activeStatus,
        categories: [],
        series: [],
        insights: aiResponse.business_insights,
        insight_results: finalResults,
        insight_date_range: aiResponse.insight_date_range,
        layout: { x: 0, y: 0, w: 6, h: 6, i: newId }
      });
      return; 
    }

    // 2. Handle Charts
    const {
      chart_title,
      chart_type,
      numerical_field = '',
      group_field = '',
      subgroup_field = '',
      mathematical_aggregation_method: aggMethod,
      filters: filterCriteriaRaw = []
    } = aiResponse;

    if (!group_field) return;

    const filters = filterCriteriaRaw.length > 0 ? filterCriteriaRaw : [];

    // --- Filtering ---
    const isViewerMode = !!(context?.reportStart || context?.reportEnd);
    
    // ST-8: Pre-process filters to skip hardcoded absolute date filters in viewer mode.
    // We do this once per chart, not inside the row-by-row filter loop.
    const activeFilters = filters.filter((rule: string) => {
      const [field, condition] = rule.split(':').map(s => s.trim());
      const isDateField = field.toLowerCase().includes('date');
      
      if (isDateField && isViewerMode) {
        const condValue = condition.replace(/[>=|<=|>|<|==]/g, '').trim();
        const isAbsoluteDate = !isNaN(new Date(condValue).getTime());
        if (isAbsoluteDate) {
          console.log(`[DataProcessor] Skipping hardcoded date filter "${rule}" for chart "${chart_title}" in viewer mode.`);
          return false; // Remove from active filters
        }
      }
      return true;
    });

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

        const rawValue = getFilterVal(field);
        
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
    const findActualKey = (target: string) => {
      if (!target) return null;
      if (bodyData[0] && bodyData[0][target] !== undefined) return target;
      const lowerTarget = target.toLowerCase().replace(/\s/g, '');
      if (bodyData[0]) {
        return Object.keys(bodyData[0]).find(k => k.toLowerCase().replace(/\s/g, '') === lowerTarget) || target;
      }
      return target;
    };

    const actualGroupField = findActualKey(group_field);
    const actualNumericalField = findActualKey(numerical_field);
    const actualSubgroupField = findActualKey(subgroup_field);

    // --- Grouping ---
    const useSubgroups = subgroup_field && subgroup_field.trim() !== "";
    const labels = [...new Set(filteredData.map(item => item[actualGroupField || group_field]).filter(Boolean))];
    
    if (labels.length === 0) {
      console.warn(`[DataProcessor] No labels found for chart "${chart_title}" using group_field "${group_field}" (Actual: ${actualGroupField})`);
    }

    let allSubgroups = ['default'];
    if (useSubgroups) {
      allSubgroups = [...new Set(filteredData.map(item => item[actualSubgroupField || subgroup_field]).filter(Boolean))];
    }

    const groupedData: Record<string, Record<string, number[]>> = {};

    filteredData.forEach(item => {
      const groupKey = item[actualGroupField || group_field];
      if (!groupKey) return;

      const subGroupKey = useSubgroups ? item[actualSubgroupField || subgroup_field] : 'default';
      if (useSubgroups && !subGroupKey) return;

      const numVal = parseFloat(item[actualNumericalField || numerical_field]) || 0;

      if (!groupedData[groupKey]) groupedData[groupKey] = {};
      if (!groupedData[groupKey][subGroupKey]) groupedData[groupKey][subGroupKey] = [];
      
      groupedData[groupKey][subGroupKey].push(numVal);
    });

    // --- Aggregation ---
    const series = allSubgroups.map(subgroup => {
      const data = labels.map(label => {
        const values = groupedData[label]?.[subgroup] || [];
        
        if (values.length === 0) return 0;

        if (aggMethod === 'sum') return values.reduce((a, b) => a + b, 0);
        if (aggMethod === 'average') return values.reduce((a, b) => a + b, 0) / values.length;
        if (aggMethod === 'count') return values.length;
        
        return values.reduce((a, b) => a + b, 0);
      });

      return {
        name: subgroup === 'default' ? numerical_field || 'Value' : subgroup, 
        data: data
      };
    });

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
      layout
    });
  });

  return results;
}
