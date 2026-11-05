import { z } from "zod";

export const examTypes = {
  cnh: "Exame toxicológico para CNH",
  clt: "Exame toxicológico para CLT",
} as const;
export const operationalStatuses = {
  awaiting_review: "Aguardando análise",
  processing: "Em processamento",
  scheduled: "Agendado",
  performed: "Exame realizado",
  completed: "Concluído",
  cancelled: "Cancelado",
} as const;
export const acceptanceStatuses = {
  awaiting: "Aguardando",
  accepted: "Aceito",
  rejected: "Recusado",
} as const;
export const integrationStatuses = {
  not_configured: "Não configurada",
  pending: "Pendente",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Falha",
  acknowledged: "Confirmada tecnicamente",
} as const;
export type OperationalStatus = keyof typeof operationalStatuses;
export const digits = (value: string) => value.replace(/\D/g, "");
export function validCpf(value: string) {
  const n = digits(value);
  if (!/^\d{11}$/.test(n) || /^(\d)\1{10}$/.test(n)) return false;
  return [9, 10].every((length) => {
    const sum = [...n.slice(0, length)].reduce(
      (total, digit, i) => total + Number(digit) * (length + 1 - i),
      0,
    );
    return ((sum * 10) % 11) % 10 === Number(n[length]);
  });
}
export function maskCpf(value: string) {
  return digits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
export function maskPhone(value: string) {
  const n = digits(value).slice(0, 11);
  return n
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(n.length === 11 ? /(\d{5})(\d{1,4})$/ : /(\d{4})(\d{1,4})$/, "$1-$2");
}
export function todayInBrazil(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const identificationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(5, "Informe seu nome completo.")
      .max(150)
      .refine((v) => v.split(/\s+/).length > 1, "Informe nome e sobrenome."),
    documentType: z.enum(["cpf", "rg"]),
    documentNumber: z.string().trim().min(4, "Informe o documento.").max(25),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
      .refine((value) => {
        const date = new Date(value + "T12:00:00Z");
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          value <= todayInBrazil() &&
          value >= "1900-01-01"
        );
      }, "A data deve ser válida e não pode estar no futuro."),
  })
  .superRefine((data, ctx) => {
    if (
      data.documentType === "cpf"
        ? !validCpf(data.documentNumber)
        : !/^[\dA-Za-z.\-\s]{4,25}$/.test(data.documentNumber)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["documentNumber"],
        message: data.documentType === "cpf" ? "CPF inválido. Confira os números." : "RG inválido.",
      });
    }
  });
export const contactSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .transform(digits)
    .refine((v) => /^[1-9]\d{9,10}$/.test(v), "Informe um telefone com DDD válido."),
});
export const examSchema = z.object({
  examType: z.enum(["cnh", "clt"], { error: "Selecione o tipo de exame." }),
});
export const bookingSchema = identificationSchema
  .and(contactSchema)
  .and(examSchema)
  .and(
    z.object({
      privacyNoticeVersion: z.literal("2026-11-04"),
      privacyAcknowledged: z.literal(true, {
        error: "Confirme a leitura do aviso de privacidade.",
      }),
      idempotencyKey: z.string().uuid(),
      turnstileToken: z.string().min(1).max(2048),
      website: z.string().max(0),
    }),
  );
export type BookingInput = z.infer<typeof bookingSchema>;
export type StaffProfile = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "staff";
  active: boolean;
  can_view_sensitive: boolean;
  invitation_pending?: boolean;
};
export function elapsedSince(timestamp: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`;
}
