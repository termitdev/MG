export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      signal: signal ?? AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      503,
      "Não foi possível comunicar com o servidor. Tente novamente.",
      "NETWORK_UNAVAILABLE",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      502,
      "Resposta indisponível. Tente novamente mais tarde.",
      "INVALID_RESPONSE",
    );
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error ?? "Não foi possível concluir a operação.",
      data.code,
    );
  return data as T;
}
