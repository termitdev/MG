// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { decryptDocument, encryptDocument, fingerprint } from "@/services/backend/crypto.server";
beforeEach(() => {
  vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", btoa("01234567890123456789012345678901"));
  vi.stubEnv("DATA_HMAC_KEY", "synthetic-test-key-with-at-least-32-characters");
});
afterEach(() => vi.unstubAllEnvs());
describe("Proteção de documentos com chaves exclusivamente sintéticas", () => {
  it("criptografa com IV aleatório e recupera somente com chave válida", async () => {
    const first = await encryptDocument("DOCUMENTO-SINTETICO");
    const second = await encryptDocument("DOCUMENTO-SINTETICO");
    expect(first).not.toBe(second);
    expect(first).not.toContain("DOCUMENTO-SINTETICO");
    expect(await decryptDocument(first, "v1")).toBe("DOCUMENTO-SINTETICO");
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", btoa("98765432109876543210987654321098"));
    await expect(decryptDocument(first, "v1")).rejects.toThrow();
  });
  it("rejeita ciphertext adulterado e versão desconhecida", async () => {
    const value = await encryptDocument("DOCUMENTO-SINTETICO");
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    bytes[15] = bytes[15]! ^ 1;
    await expect(decryptDocument(btoa(String.fromCharCode(...bytes)), "v1")).rejects.toThrow();
    await expect(decryptDocument(value, "v2")).rejects.toThrow();
  });
  it("gera fingerprint estável e não permite funcionar sem chave", async () => {
    expect(await fingerprint("synthetic")).toBe(await fingerprint("synthetic"));
    vi.stubEnv("DATA_HMAC_KEY", "");
    await expect(fingerprint("synthetic")).rejects.toMatchObject({
      status: 500,
      code: "BACKEND_CONFIGURATION_ERROR",
    });
  });
});
