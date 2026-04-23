const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type ApiRequestOptions = RequestInit & {
  json?: unknown;
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { json, token, headers, body, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (json !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  const raw = await response.text();
  const data = raw ? tryParseJSON(raw) : null;

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

function tryParseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export { API_BASE_URL };
