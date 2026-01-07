export const FM_CONFIG = {
  // Fallback URL if the environment variable is missing
  API_URL_DEFAULT: 'https://py-fmd.vercel.app/api/dataApi',

  // Layout name
  LAYOUTS: {
    REPORTS: 'MultiTableReport Filtered Datas',
    CHARTS_DEFAULT: 'CHARTS_DAPI',
  },
  
  // Boolean field mappings
  BOOL: {
    TRUE: '1',
    FALSE: '0',
  },
} as const;