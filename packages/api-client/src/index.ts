import type { components } from './generated/schema.js';

export type { components, operations, paths } from './generated/schema.js';

export type AuthProfile = components['schemas']['AuthProfile'];
export type LoginCredentials = components['schemas']['LoginDto'];
export type AnalyticsResponse = components['schemas']['AnalyticsResponseDto'];
export type AnalyticsMetric = AnalyticsResponse['filters']['metric'];
export type Company = components['schemas']['CompanyDto'];
export type Branch = components['schemas']['BranchDto'];
export type ImportRunResponse = components['schemas']['ImportRunResponseDto'];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshPromise: Promise<boolean> | undefined;

async function refreshSession(): Promise<boolean> {
  refreshPromise ??= fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .finally(() => {
      refreshPromise = undefined;
    });
  return refreshPromise;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  if (
    response.status === 401 &&
    retryAfterRefresh &&
    path !== '/api/auth/refresh' &&
    path !== '/api/auth/login'
  ) {
    if (await refreshSession()) return request<T>(path, init, false);
  }
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    } catch {
      // Status remains available when an error response has no JSON body.
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  login: (credentials: LoginCredentials) =>
    request<AuthProfile>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  me: () => request<AuthProfile>('/api/auth/me'),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  companies: () => request<Company[]>('/api/companies'),
  branches: (companyId?: string) =>
    request<Branch[]>('/api/branches', {
      headers: companyId ? { 'X-Company-Id': companyId } : undefined,
    }),
  analytics: (parameters: {
    from: string;
    to: string;
    metric: AnalyticsMetric;
    branchId?: string;
    companyId?: string;
  }) => {
    const query = new URLSearchParams({
      from: parameters.from,
      to: parameters.to,
      metric: parameters.metric,
    });
    if (parameters.branchId) query.set('branchId', parameters.branchId);
    return request<AnalyticsResponse>(`/api/analytics?${query}`, {
      headers: parameters.companyId
        ? { 'X-Company-Id': parameters.companyId }
        : undefined,
    });
  },
  runImport: (parameters: { from: string; to: string }) =>
    request<ImportRunResponse>('/api/imports/statistics', {
      method: 'POST',
      body: JSON.stringify(parameters),
    }),
};
