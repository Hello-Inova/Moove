export type ApiErrorBody = {
  error: string;
  issues?: Record<string, string[] | undefined>;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: Record<string, string[] | undefined> };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, error: "Não foi possível conectar ao servidor. Verifique sua conexão." };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const errorBody = (body ?? {}) as ApiErrorBody;
    return { ok: false, error: errorBody.error || "Ocorreu um erro inesperado.", issues: errorBody.issues };
  }

  return { ok: true, data: body as T };
}

export function apiGet<T>(url: string) {
  return request<T>(url, { method: "GET" });
}

export function apiPostJson<T>(url: string, body: unknown) {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function apiPostForm<T>(url: string, form: FormData) {
  return request<T>(url, { method: "POST", body: form });
}
