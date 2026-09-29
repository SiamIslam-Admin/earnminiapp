import appConfig from '../config.json';
import type { ApiResponse } from '../types/api';
import { syncUserBalance } from '../utils/syncUser';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  public getBaseUrl(): string {
    return (
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
      appConfig.apiBaseUrl ||
      'http://localhost:8080/api/v1'
    );
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  public setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  public clearToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  public getAdminToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
  }

  public setAdminToken(token: string) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_token', token);
      localStorage.setItem('admin_token', token);
    }
  }

  public clearAdminToken() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_token');
      localStorage.removeItem('admin_token');
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const method = options.method || 'GET';
    let url = `${this.getBaseUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const searchParams = new URLSearchParams();
    
    // Automatically inject bypass query param for localtunnel compatibility
    searchParams.append('bypass-tunnel-reminder', 'true');

    if (options.params) {
      Object.entries(options.params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
    }

    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
      'bypass-tunnel-reminder': 'true'
    };

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const isAdminEndpoint = endpoint.startsWith('/admin') || endpoint.includes('/admin/');
    const adminToken = this.getAdminToken();
    const userToken = this.getToken();

    if (isAdminEndpoint && adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    } else if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    const config: RequestInit = {
      method,
      mode: 'cors',
      credentials: 'omit',
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>)
      }
    };

    if (options.body) {
      config.body = isFormData ? options.body : JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), appConfig.apiTimeoutMs || 10000);
    config.signal = controller.signal;

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      const json: ApiResponse<T> = await response.json().catch(() => ({
        success: false,
        error: `Server responded with status ${response.status}`
      }));

      if (response.ok && json.success !== false) {
        // Universal 0ms Auto-Sync for any endpoint returning userBalance or user
        try {
          syncUserBalance(json);
        } catch (syncErr) {
          console.error('[ApiClient] Error during automatic user sync:', syncErr);
        }
      } else {
        const errMsg = json.error || json.message || `HTTP ${response.status}`;
        console.warn(`[ApiClient] ${method} ${endpoint}: ${errMsg}`);
      }

      if (response.status === 401) {
        console.warn('[ApiClient] Session expired or unauthorized.');
      }

      return json;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err?.name === 'AbortError';
      const errMsg = isAbort ? 'Request Timeout' : (err?.message || 'Network / CORS Error');
      console.error(`[ApiClient] ${method} ${endpoint} Failed:`, errMsg);
      return {
        success: false,
        error: errMsg
      };
    }
  }

  get<T>(endpoint: string, params?: Record<string, any>, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'GET', params, headers });
  }

  post<T>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  put<T>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  delete<T>(endpoint: string, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();
export default api;
