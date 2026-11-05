import "@tanstack/react-start/server-only";
import { HttpError } from "@/lib/security";

function secret(name: string) {
  const value = process.env[name];
  if (!value || value.length < 32)
    throw new HttpError(
      500,
      "Configuração do acesso indisponível. Contate a administração.",
      "BACKEND_CONFIGURATION_ERROR",
    );
  return value;
}
function keyBytes() {
  try {
    const bytes = Uint8Array.from(atob(secret("DOCUMENT_ENCRYPTION_KEY")), (c) => c.charCodeAt(0));
    if (bytes.length === 32) return bytes;
  } catch {
    /* Never include secret values in configuration errors. */
  }
  throw new HttpError(
    500,
    "Configuração do acesso indisponível. Contate a administração.",
    "BACKEND_CONFIGURATION_ERROR",
  );
}
export async function fingerprint(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret("DATA_HMAC_KEY")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
export async function encryptDocument(value: string) {
  const key = await crypto.subtle.importKey("raw", keyBytes(), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("mugui:document:v1") },
      key,
      new TextEncoder().encode(value),
    ),
  );
  return btoa(String.fromCharCode(...iv, ...ciphertext));
}
export async function decryptDocument(value: string, version: string) {
  if (version !== "v1") throw new HttpError(503, "Versão de criptografia indisponível.");
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes(), "AES-GCM", false, ["decrypt"]);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes.slice(0, 12),
        additionalData: new TextEncoder().encode("mugui:document:v1"),
      },
      key,
      bytes.slice(12),
    ),
  );
}
