import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { securityHeaders } from "./lib/security";

type ServerEntry = {
  fetch: (
    request: Request,
    options?: { context?: { nonce: string } },
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request) {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
    const protect = (response: Response) => {
      const protectedResponse = new Response(response.body, response);
      securityHeaders(request, nonce, process.env["NODE_ENV"] === "production").forEach(
        (value, key) => protectedResponse.headers.set(key, value),
      );
      if (protectedResponse.headers.get("Content-Type")?.includes("text/html")) {
        protectedResponse.headers.set("Cache-Control", "no-store, private");
      }
      return protectedResponse;
    };
    try {
      const handler = await getServerEntry();
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-mugui-csp-nonce", nonce);
      // srvx supplies a Request-compatible wrapper in development; native Request cloning
      // requires private runtime internals that this wrapper does not own.
      const incoming = new Request(request.url, {
        method: request.method,
        headers: requestHeaders,
        ...(request.method === "GET" || request.method === "HEAD"
          ? {}
          : { body: request.body, duplex: "half" }),
      });
      const response = await handler.fetch(incoming, { context: { nonce } });
      return protect(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return protect(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
