// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createSubmissionId } from "@/lib/submission-id";
afterEach(() => vi.unstubAllGlobals());
it("generates independent cryptographic UUIDv4 identifiers without randomUUID on HTTP LAN", () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal("crypto", { getRandomValues });
  const first = createSubmissionId(),
    second = createSubmissionId();
  expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  expect(second).not.toBe(first);
});
