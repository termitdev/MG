import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { networkInterfaces } from "node:os";

export default defineConfig(({ command, isPreview, mode }) => {
  // Backend environment only: never serialize these values into client defines.
  const runtime = globalThis as typeof globalThis & { __muguiLoadedEnv?: Record<string, string> };
  for (const [key, value] of Object.entries(runtime.__muguiLoadedEnv ?? {})) {
    if (process.env[key] === value) delete process.env[key];
  }
  runtime.__muguiLoadedEnv = {};
  const localEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(localEnv)) {
    if (
      /^(SUPABASE_|APP_ORIGIN$|APP_DEV_ORIGINS$|DOCUMENT_ENCRYPTION_KEY$|DATA_HMAC_KEY$|TURNSTILE_|TRUSTED_CLIENT_IP_HEADER$)/.test(
        key,
      ) &&
      process.env[key] === undefined
    ) {
      process.env[key] = value;
      runtime.__muguiLoadedEnv[key] = value;
    }
  }
  return {
    plugins: [
      {
        name: "mugui-local-origins",
        apply: "serve",
        configureServer(server) {
          server.httpServer?.once("listening", () => {
            const address = server.httpServer?.address();
            if (!address || typeof address === "string") return;
            const hosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
            for (const entries of Object.values(networkInterfaces()))
              for (const entry of entries ?? []) {
                if (
                  entry.family === "IPv4" &&
                  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)
                )
                  hosts.add(entry.address);
              }
            const scheme = server.config.server.https ? "https" : "http";
            process.env["APP_DEV_ORIGINS"] = [
              ...new Set([
                ...(localEnv["APP_DEV_ORIGINS"] ?? "")
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
                ...[...hosts].map((host) => `${scheme}://${host}:${address.port}`),
              ]),
            ].join(",");
          });
        },
      },
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({ server: { entry: "server" } }),
      ...(command === "build" || isPreview ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
      react(),
    ],
    css: { transformer: "lightningcss" },
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: { host: "::", port: 8080 },
  };
});
