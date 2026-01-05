import { API_ROUTES } from "@/lib/constants/analytics";
interface UpdateChartParams {
  isActive?: boolean;
  type?: string;
}

// Function to update chart status
export async function updateChartStatus(
  fmRecordId: string,
  params: UpdateChartParams
): Promise<boolean> {
   // Validate fmRecordId 
  if (!fmRecordId) {
    console.warn('[updateChartStatus] Missing fmRecordId');
    return false;
  }
  //Request payload
  try {
    const res = await fetch(API_ROUTES.CHART_SAVE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fmRecordId,
        isActive: params.isActive,
        chartType: params.type,
      }),
    });

    // Handle response
    if (!res.ok) {
      console.error(
        '[updateChartStatus] Failed:',
        await res.text()
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('[updateChartStatus] Error:', error);
    return false;
  }
}
