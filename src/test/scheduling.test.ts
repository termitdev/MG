import { describe, expect, it } from "vitest";
import {
  bookingSchema,
  contactSchema,
  elapsedSince,
  identificationSchema,
  maskCpf,
  maskPhone,
  validCpf,
} from "@/lib/scheduling";
const identity = {
  fullName: "Paciente Sintético",
  documentType: "cpf",
  documentNumber: "529.982.247-25",
  birthDate: "1990-02-28",
};
const booking = {
  ...identity,
  email: "TESTE@EXAMPLE.INVALID",
  phone: "(11) 99999-8888",
  examType: "cnh",
  privacyNoticeVersion: "2026-11-04",
  privacyAcknowledged: true,
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  turnstileToken: "synthetic-token",
  website: "",
};
describe("Validação compartilhada de agendamento", () => {
  it("aceita CPF válido e rejeita dígitos incorretos ou repetidos", () => {
    expect(validCpf(identity.documentNumber)).toBe(true);
    expect(validCpf("111.111.111-11")).toBe(false);
    expect(validCpf("52998224726")).toBe(false);
  });
  it("aplica máscaras brasileiras", () => {
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskPhone("11999998888")).toBe("(11) 99999-8888");
    expect(maskPhone("1133334444")).toBe("(11) 3333-4444");
  });
  it("valida RG, campos obrigatórios e datas", () => {
    expect(
      identificationSchema.safeParse({
        ...identity,
        documentType: "rg",
        documentNumber: "12.345.678-X",
      }).success,
    ).toBe(true);
    for (const value of [
      { fullName: "" },
      { birthDate: "2999-01-01" },
      { birthDate: "2025-02-30" },
      { documentNumber: "00000000000" },
    ])
      expect(identificationSchema.safeParse({ ...identity, ...value }).success).toBe(false);
  });
  it("normaliza contato e rejeita formatos inválidos", () => {
    expect(
      contactSchema.parse({ email: " TESTE@EXAMPLE.INVALID ", phone: "(11) 99999-8888" }),
    ).toEqual({ email: "teste@example.invalid", phone: "11999998888" });
    expect(contactSchema.safeParse({ email: "invalido", phone: "123" }).success).toBe(false);
  });
  it("exige seleção de exame, aviso, chave de idempotência e verificação anti-bot", () => {
    expect(bookingSchema.safeParse(booking).success).toBe(true);
    for (const value of [
      { examType: "" },
      { privacyAcknowledged: false },
      { idempotencyKey: "123" },
      { turnstileToken: "" },
      { website: "spam" },
    ])
      expect(bookingSchema.safeParse({ ...booking, ...value }).success).toBe(false);
  });
  it("calcula espera sem valores negativos", () => {
    expect(elapsedSince("2026-11-04T10:00:00Z", Date.parse("2026-11-04T11:30:00Z"))).toBe(
      "1 h 30 min",
    );
    expect(elapsedSince("2026-11-05T10:00:00Z", Date.parse("2026-11-04T10:00:00Z"))).toBe("0 min");
  });
});
