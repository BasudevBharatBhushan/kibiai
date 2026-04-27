/**
 * Common API Client for KiBiAI.
 * Automatically handles companyId scoping and standardized error handling.
 */

type ApiOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>;
  companyId?: string;
};

class ApiClient {
  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { params, companyId, ...fetchOptions } = options;
    
    // Construct URL with params
    const url = new URL(endpoint, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, String(value));
      });
    }
    
    // Automatically add companyId to params if not present and provided
    if (companyId && !url.searchParams.has('companyId')) {
      url.searchParams.append('companyId', companyId);
    }

    // Standard headers
    const headers = new Headers(fetchOptions.headers);
    if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Standardize body for POST/PUT/PATCH to include companyId
    let finalBody = fetchOptions.body;
    if (
      companyId && 
      fetchOptions.method && 
      ['POST', 'PUT', 'PATCH'].includes(fetchOptions.method.toUpperCase()) &&
      typeof finalBody === 'string'
    ) {
      try {
        const bodyObj = JSON.parse(finalBody);
        if (!bodyObj.companyId) {
          bodyObj.companyId = companyId;
          finalBody = JSON.stringify(bodyObj);
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }

    const response = await fetch(url.toString(), {
      ...fetchOptions,
      headers,
      body: finalBody,
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'Unknown API error' };
      }
      
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    // Standard KI-BI response format
    const data = await response.json();
    return data as T;
  }

  async get<T>(endpoint: string, options?: ApiOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body: any, options?: ApiOptions) {
    return this.request<T>(endpoint, { 
      ...options, 
      method: 'POST', 
      body: JSON.stringify(body) 
    });
  }

  async put<T>(endpoint: string, body: any, options?: ApiOptions) {
    return this.request<T>(endpoint, { 
      ...options, 
      method: 'PUT', 
      body: JSON.stringify(body) 
    });
  }

  async delete<T>(endpoint: string, options?: ApiOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
