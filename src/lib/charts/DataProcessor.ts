import { ChartConfig, ChartKind, ReportChartSchema } from './ChartTypes';
import { v4 as uuidv4 } from 'uuid';

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
  const map: Record<string, ChartKind> = {
    bar: 'column', 
    doughnut: 'donut',
    pie: 'pie',
    line: 'line',
    area: 'area'
  };
  return map[legacyType.toLowerCase()] || 'column';
}

// Main data processing function
export function processData(
  rawData: any[], 
  aiConfigs: ReportChartSchema[]
): ChartConfig[] {
  
  let rawBodyData: any[] = [];

  const isAlreadyFlat = Array.isArray(rawData) && rawData.length > 0 && !rawData.some(item => item.Body || item.TitleHeader);

  if (isAlreadyFlat) {

    rawBodyData = rawData;
  } else {
    rawBodyData = extractBodyFields(rawData);
  }


  const bodyData = rawBodyData.map((item: any) => {
    const parse = (val: any) => {
        if (typeof val === 'number') return val;
        const cleaned = String(val || '0').replace(/[^0-9.-]/g, ''); 
        return parseFloat(cleaned) || 0;
    };

    return {
      ...item,
      "Profit": parse(item["Profit"]),
      "Subtotal": parse(item["Subtotal"]),
      "Quantity": parse(item["Quantity"]),
      "Line Price": parse(item["Line Price"] || item["LinePrice"]),
      "Unit Price": parse(item["Unit Price"] || item["UnitPrice"]),
      "Sales Date": item["Sales Date"] || item["SalesDate"],
      "Item Name": item["Item Name"] || item["ItemName"]
    };
  });

  const results: ChartConfig[] = [];

  aiConfigs.forEach((aiResponse) => {
    const newId = aiResponse.pKey || uuidv4();

    const activeStatus = String(aiResponse.isActive) === '1';

    // 1. Handle Insight Cards
    if (aiResponse.business_insights) {
      results.push({
        id: newId,
        kind: 'insight',
        title: 'Business Insights',
        isActive: activeStatus,
        categories: [],
        series: [],
        insights: aiResponse.business_insights,
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
    const filteredData = bodyData.filter(item => {
      return filters.every((rule: string) => {
        const [field, condition] = rule.split(':').map(s => s.trim());
        const value = item[field];
        
        if (condition === 'notEmpty') return value !== '' && value !== null && value !== undefined;
        if (condition === 'empty') return value === '' || value === null || value === undefined;
        
        const numVal = parseFloat(value);
        if (condition.startsWith('>=')) return numVal >= parseFloat(condition.slice(2));
        if (condition.startsWith('<=')) return numVal <= parseFloat(condition.slice(2));
        if (condition.startsWith('>')) return numVal > parseFloat(condition.slice(1));
        if (condition.startsWith('<')) return numVal < parseFloat(condition.slice(1));
        if (condition.startsWith('==')) return value == condition.slice(2);
        
        return true;
      });
    });

    // --- Grouping ---
    const useSubgroups = subgroup_field && subgroup_field.trim() !== "";
    const labels = [...new Set(filteredData.map(item => item[group_field]).filter(Boolean))];
    
    let allSubgroups = ['default'];
    if (useSubgroups) {
      allSubgroups = [...new Set(filteredData.map(item => item[subgroup_field]).filter(Boolean))];
    }

    const groupedData: Record<string, Record<string, number[]>> = {};

    filteredData.forEach(item => {
      const groupKey = item[group_field];
      if (!groupKey) return;

      const subGroupKey = useSubgroups ? item[subgroup_field] : 'default';
      if (useSubgroups && !subGroupKey) return;

      const numVal = parseFloat(item[numerical_field]) || 0;

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
    const W = 6;
    const H = 9; 
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
      fmRecordId: aiResponse.fmRecordId,
      categories: labels,
      series: series,     
      layout
    });
  });

  return results;
}