// Function to save dashboard state
export async function saveDashboardState(
  reportRecordId: string,
  canvasState: any
): Promise<boolean> {
  if (!reportRecordId) {
    console.warn('[saveDashboardState] Missing reportRecordId');
    return false;
  }

  try {
    const res = await fetch('/api/dashboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reportRecordId,
        canvasState,
      }),
    });

    if (!res.ok) {
      console.error(
        '[saveDashboardState] Failed:',
        await res.text()
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('[saveDashboardState] Error:', error);
    return false;
  }
}
