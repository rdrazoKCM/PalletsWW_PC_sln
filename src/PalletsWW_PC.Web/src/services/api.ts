import { APP_CONFIG } from '../config';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${APP_CONFIG.apiBaseUrl}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  const isPalletMutation = endpoint.startsWith('/api/pallets') && (options.method === 'POST' || options.method === 'PUT');
  const timeoutMs = isPalletMutation ? 75000 : 40000; // 75s para transacciones de pallets en planta; 40s para consultas regulares (homologado con Pallets Pañal)

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMsg = `Error HTTP ${response.status}: ${response.statusText}`;
      let errorData: any = null;
      try {
        errorData = await response.json();
        if (errorData?.mensaje) errorMsg = errorData.mensaje;
        else if (errorData?.title) errorMsg = errorData.title;
      } catch {
        // Response wasn't json
      }
      throw new ApiError(response.status, errorMsg, errorData);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'Tiempo de espera agotado al conectar con el servidor.');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, error.message || 'Error de red al conectar con el servidor.');
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
