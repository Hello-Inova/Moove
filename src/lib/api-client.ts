export type ApiErrorBody = {
  error: string;
  issues?: Record<string, string[] | undefined>;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  // `status` vem undefined quando a falha foi de rede (nem chegou a ter uma
  // resposta HTTP) — usado por quem faz polling pra distinguir "erro
  // definitivo" (ex: 403 vínculo revogado) de "falha passageira" (queda de
  // conexão, 5xx) e decidir se continua tentando ou desiste de vez.
  | { ok: false; error: string; issues?: Record<string, string[] | undefined>; status?: number };

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
    return {
      ok: false,
      error: errorBody.error || "Ocorreu um erro inesperado.",
      issues: errorBody.issues,
      status: response.status,
    };
  }

  return { ok: true, data: body as T };
}

export function apiGet<T>(url: string) {
  return request<T>(url, { method: "GET" });
}

export function apiPostJson<T>(url: string, body: unknown) {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatchJson<T>(url: string, body: unknown) {
  return request<T>(url, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiPutJson<T>(url: string, body: unknown) {
  return request<T>(url, { method: "PUT", body: JSON.stringify(body) });
}

export function apiPostForm<T>(url: string, form: FormData) {
  return request<T>(url, { method: "POST", body: form });
}

export function apiDelete<T>(url: string) {
  return request<T>(url, { method: "DELETE" });
}
