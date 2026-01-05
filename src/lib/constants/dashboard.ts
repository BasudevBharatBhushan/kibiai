// Allowed Layout Modes
export const ALLOWED_LAYOUTS = [
  'grid',
  'two-columns',
  'single-row',
  'insight',
] as const;

export type LayoutMode = typeof ALLOWED_LAYOUTS[number];

// Grid Configuration
export const GRID_CONFIG = {
  breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  rowHeight: 60,
  margin: [10, 10] as [number, number],
};

// Default styling or fallbacks
export const DASHBOARD_DEFAULTS = {
  layoutMode: 'grid' as LayoutMode,
  chartHeight: 9,
  chartWidth: 6,
};

//Highcharts Visual Theme (Used in ChartCard.tsx)
export const CHART_VISUALS = {
  SPACING: {
    TOP: 10,
    BOTTOM: 5,
    LEFT: 5,
    RIGHT: 5,
  },
  LEGEND: {
    MARGIN: 5,
    ITEM_STYLE: { fontSize: '11px', color: '#64748b' }, // slate-500
  },
  BACKGROUND: 'transparent',
} as const;

//UI Text & Messages
export const UI_TEXT = {
  CONFIRM_RESET: "Are you sure? This will discard your saved layout and reset to Grid.",
  NO_CHARTS: 'No charts visible. Click "Configure" to add charts.',
  COMING_SOON: {
    AI_GEN: "Coming soon: AI Chart Generation",
    INSIGHTS: "Coming soon: Business Insights",
  },
} as const;

// Chart Type Options
export const AVAILABLE_CHART_TYPES = ['column', 'line', 'area', 'pie', 'donut'] as const;