export type ApiOptions = RequestInit & { query?: Record<string, string | undefined> };
export type ApiError = Error & { status?: number };

function url(path: string, query?: Record<string, string | undefined>) {
  const params = new URLSearchParams(Object.entries(query || {}).filter(([, value]) => value));
  return params.size ? `${path}?${params}` : path;
}

export async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const csrf = document.cookie.match(/(?:^|; )csrf=([^;]+)/)?.[1];
  const response = await fetch(url(path, options.query), { ...options, credentials: 'include', body: options.body, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}), ...(options.headers || {}) } });
  const text = await response.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) { const error = new Error((data as { message?: string }).message || `Não foi possível concluir a operação (${response.status}).`) as ApiError; error.status = response.status; throw error; }
  return data as T;
}
export const get = <T>(path: string, query?: ApiOptions['query']) => request<T>(path, { query });
export const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });
