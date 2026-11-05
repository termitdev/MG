export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export function assertSameOrigin(request: Request, allowedOrigin: string | readonly string[]) {
  const allowed = typeof allowedOrigin === "string" ? [allowedOrigin] : allowedOrigin;
  if (
    !allowed.includes(request.headers.get("origin") ?? "") ||
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new HttpError(403, "Origem não autorizada.", "ORIGIN_FORBIDDEN");
  }
}
export async function readJson(request: Request, limit = 16384): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Envie JSON.");
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new HttpError(413, "Requisição muito grande.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Requisição inválida.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "Requisição muito grande.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "JSON inválido.");
  } finally {
    reader.releaseLock();
  }
}
export function securityHeaders(request: Request, nonce: string, production: boolean) {
  const headers = new Headers({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' ${production ? `'nonce-${nonce}'` : "'unsafe-inline'"} https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      `connect-src 'self' https://challenges.cloudflare.com${production ? "" : " ws: wss:"}`,
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "form-action 'self'",
    ].join("; "),
  });
  if (production && new URL(request.url).protocol === "https:")
    headers.set("Strict-Transport-Security", "max-age=31536000");
  return headers;
}
