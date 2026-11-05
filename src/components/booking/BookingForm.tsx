import { AppLink } from "@/components/platform/AppLink";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import {
  bookingSchema,
  contactSchema,
  examSchema,
  examTypes,
  identificationSchema,
  maskCpf,
  maskPhone,
  todayInBrazil,
  type BookingInput,
} from "@/lib/scheduling";
import { api, ApiError } from "@/services/api";
import { Action, Field, Notice } from "@/components/platform/Controls";
import { Turnstile } from "./Turnstile";
import { createSubmissionId } from "@/lib/submission-id";

const steps = ["Identificação", "Contato", "Tipo de exame", "Revisão"];
type Draft = {
  fullName: string;
  documentType: "cpf" | "rg";
  documentNumber: string;
  birthDate: string;
  email: string;
  phone: string;
  examType: "cnh" | "clt" | "";
  privacyAcknowledged: boolean;
  website: string;
};
export function BookingForm() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    fullName: "",
    documentType: "cpf",
    documentNumber: "",
    birthDate: "",
    email: "",
    phone: "",
    examType: "",
    privacyAcknowledged: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<{ bookingEnabled: boolean; turnstileSiteKey: string }>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const pendingPayload = useRef<BookingInput | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const [token, setToken] = useState("");
  const canSubmit =
    Boolean(config?.bookingEnabled && token) &&
    draft.privacyAcknowledged &&
    identificationSchema.safeParse(draft).success &&
    contactSchema.safeParse(draft).success &&
    examSchema.safeParse(draft).success;
  const [attempt, setAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState<{ protocol: string; requestedAt: string }>();
  const key = useRef<string>("");
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
  }, [confirmation]);
  useEffect(() => {
    api<typeof config>("config")
      .then(setConfig)
      .catch(() => setMessage("Não foi possível verificar a disponibilidade do serviço."));
  }, []);
  const update = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };
  const validate = (schema: z.ZodTypeAny, value: unknown) => {
    const result = schema.safeParse(value);
    if (result.success) {
      setErrors({});
      return true;
    }
    const issues: Record<string, string> = {};
    for (const issue of result.error.issues) issues[String(issue.path[0])] = issue.message;
    setErrors(issues);
    setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
    return false;
  };
  const changeStep = (value: number) => {
    setStep(value);
    setErrors({});
    setMessage("");
    setTimeout(() => heading.current?.focus(), 0);
  };
  const acceptReceipt = (result: { protocol: string; requestedAt: string }) => {
    const receipt = z
      .object({
        protocol: z.string().trim().min(5).max(100),
        requestedAt: z.string().datetime({ offset: true }),
      })
      .safeParse(result);
    if (!receipt.success)
      throw new Error(
        "O serviço não retornou um comprovante válido. Vamos verificar o recebimento.",
      );
    setConfirmation(receipt.data);
    setUncertain(false);
    pendingPayload.current = null;
    setDraft({
      fullName: "",
      documentType: "cpf",
      documentNumber: "",
      birthDate: "",
      email: "",
      phone: "",
      examType: "",
      privacyAcknowledged: false,
      website: "",
    });
  };
  const reconcile = async () => {
    if (!pendingPayload.current) return;
    const result = await api<{
      state: "confirmed" | "not_found";
      protocol?: string;
      requestedAt?: string;
    }>("booking/reconcile", pendingPayload.current, AbortSignal.timeout(8000));
    if (result.state === "confirmed" && result.protocol && result.requestedAt)
      acceptReceipt({ protocol: result.protocol, requestedAt: result.requestedAt });
    else if (result.state === "not_found") {
      setUncertain(false);
      setMessage(
        "Nenhuma confirmação foi localizada. Você pode tentar novamente; manteremos a mesma chave para evitar duplicidade.",
      );
    } else throw new Error("Confirmação ainda indisponível.");
  };
  const submit = async () => {
    if (submitting.current || uncertain || !canSubmit) return;
    if (!key.current) key.current = createSubmissionId();
    const payload = {
      ...draft,
      privacyNoticeVersion: "2026-11-04",
      idempotencyKey: key.current,
      turnstileToken: token,
    };
    if (!validate(bookingSchema, payload)) return;
    pendingPayload.current = bookingSchema.parse(payload);
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ protocol: string; requestedAt: string }>(
        "booking",
        pendingPayload.current,
        AbortSignal.timeout(45000),
      );
      acceptReceipt(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível enviar. Tente novamente.",
      );
      if (!(error instanceof ApiError) || error.status >= 500 || error.status === 408) {
        setUncertain(true);
        try {
          await reconcile();
        } catch {
          /* Keep the original data and submission key; do not enable a new submission yet. */
        }
      }
    } finally {
      submitting.current = false;
      setBusy(false);
      setToken("");
      setAttempt((n) => n + 1);
    }
  };
  if (confirmation)
    return (
      <div className="space-y-6 py-6" role="status">
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Check />
        </span>
        <h1 ref={confirmationHeading} tabIndex={-1} className="text-3xl font-semibold outline-none">
          Solicitação recebida com sucesso!
        </h1>
        <p className="text-muted-foreground">
          Nossa equipe acompanhará seu agendamento. A data e o horário ainda precisam ser
          confirmados.
        </p>
        <div className="rounded-3xl bg-muted p-5">
          <p className="text-sm text-muted-foreground">Seu protocolo</p>
          <p className="mt-2 break-all font-mono text-lg font-semibold">{confirmation.protocol}</p>
          <p className="mt-2 text-sm">
            {new Date(confirmation.requestedAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </p>
        </div>
        <AppLink href="/" className="inline-block text-primary underline underline-offset-4">
          Voltar ao início
        </AppLink>
      </div>
    );
  return (
    <form
      aria-label="Agendamento de exame"
      aria-busy={busy}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 3) {
          void submit();
          return;
        }
        if (validate([identificationSchema, contactSchema, examSchema][step]!, draft))
          changeStep(step + 1);
      }}
      className="space-y-8"
    >
      {busy && (
        <p
          role="status"
          className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground"
        >
          {uncertain
            ? "Verificando o recebimento da sua solicitação…"
            : "Enviando sua solicitação com segurança…"}
        </p>
      )}
      <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do agendamento">
        {steps.map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined} className="min-w-0">
            <div
              className={`mb-3 h-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`}
            />
            <span
              className={`text-xs sm:text-sm ${step === index ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {index + 1}
              <span className="hidden sm:inline">. {label}</span>
            </span>
          </li>
        ))}
      </ol>
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Etapa {step + 1} de 4</p>
        <h2 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none">
          {steps[step]}
        </h2>
      </div>
      <fieldset key={step} disabled={busy || uncertain} className="booking-step min-w-0 space-y-5">
        <legend className="sr-only">{steps[step]}</legend>
        {step === 0 && (
          <>
            <Field
              id="fullName"
              label="Nome completo"
              autoComplete="name"
              maxLength={150}
              value={draft.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              error={errors["fullName"]}
              required
            />
            <div>
              <p id="document-label" className="mb-2 text-sm font-medium">
                Tipo de documento
              </p>
              <div role="radiogroup" aria-labelledby="document-label" className="flex gap-5">
                {(["cpf", "rg"] as const).map((type) => (
                  <label key={type} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="documentType"
                      value={type}
                      checked={draft.documentType === type}
                      onChange={() => {
                        update("documentType", type);
                        update("documentNumber", "");
                      }}
                      className="size-4 accent-primary"
                    />
                    {type.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <Field
              id="documentNumber"
              label={`Número do ${draft.documentType.toUpperCase()}`}
              inputMode={draft.documentType === "cpf" ? "numeric" : "text"}
              autoComplete="off"
              maxLength={draft.documentType === "cpf" ? 14 : 25}
              value={draft.documentNumber}
              onChange={(e) =>
                update(
                  "documentNumber",
                  draft.documentType === "cpf" ? maskCpf(e.target.value) : e.target.value,
                )
              }
              error={errors["documentNumber"]}
              required
            />
            <Field
              id="birthDate"
              label="Data de nascimento"
              type="date"
              autoComplete="bday"
              min="1900-01-01"
              max={todayInBrazil()}
              value={draft.birthDate}
              onChange={(e) => update("birthDate", e.target.value)}
              error={errors["birthDate"]}
              required
            />
          </>
        )}
        {step === 1 && (
          <>
            <Field
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={draft.email}
              onChange={(e) => update("email", e.target.value)}
              error={errors["email"]}
              required
            />
            <Field
              id="phone"
              label="Telefone com DDD"
              type="tel"
              autoComplete="tel-national"
              value={draft.phone}
              onChange={(e) => update("phone", maskPhone(e.target.value))}
              error={errors["phone"]}
              required
            />
          </>
        )}
        {step === 2 && (
          <div
            role="radiogroup"
            aria-label="Tipo de exame"
            aria-invalid={Boolean(errors["examType"])}
            className="space-y-3"
          >
            {Object.entries(examTypes).map(([value, label]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-4 rounded-3xl border p-5 transition ${draft.examType === value ? "border-primary bg-primary/5" : "border-border bg-surface"}`}
              >
                <input
                  type="radio"
                  name="examType"
                  className="size-5 shrink-0 accent-primary"
                  checked={draft.examType === value}
                  onChange={() => update("examType", value as "cnh" | "clt")}
                />
                <span className="font-medium">{label}</span>
              </label>
            ))}
            {errors["examType"] && (
              <p role="alert" className="text-sm text-destructive">
                Selecione o tipo de exame.
              </p>
            )}
          </div>
        )}
        {step === 3 && (
          <>
            <dl className="divide-y divide-border rounded-3xl bg-muted/60 px-5">
              {[
                ["Nome", draft.fullName],
                [
                  "Documento",
                  `${draft.documentType.toUpperCase()} •••• ${draft.documentNumber.replace(/\W/g, "").slice(-4)}`,
                ],
                ["Nascimento", draft.birthDate.split("-").reverse().join("/")],
                ["E-mail", draft.email],
                ["Telefone", draft.phone],
                ["Exame", draft.examType ? examTypes[draft.examType] : ""],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="break-words text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">
              Os dados serão utilizados para analisar sua solicitação e permitir o atendimento. A
              confirmação do exame depende da equipe e do laboratório. Consulte o{" "}
              <AppLink
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                aviso de privacidade
              </AppLink>
              .
            </p>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={draft.privacyAcknowledged}
                onChange={(e) => update("privacyAcknowledged", e.target.checked)}
                aria-invalid={Boolean(errors["privacyAcknowledged"])}
              />
              Li as informações sobre o tratamento dos meus dados pessoais.
            </label>
            {errors["privacyAcknowledged"] && (
              <Notice error>{errors["privacyAcknowledged"]}</Notice>
            )}
            {config?.bookingEnabled && config.turnstileSiteKey ? (
              <Turnstile siteKey={config.turnstileSiteKey} onToken={setToken} attempt={attempt} />
            ) : (
              <Notice>
                O agendamento online está aguardando configuração. Nenhuma solicitação será enviada
                neste momento.
              </Notice>
            )}
          </>
        )}
      </fieldset>
      <div aria-hidden="true" className="absolute -left-[10000px]">
        <label htmlFor="website">Deixe em branco</label>
        <input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          value={draft.website}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>
      {message && <Notice error>{message}</Notice>}
      {uncertain && (
        <div className="space-y-3">
          <Notice>
            O recebimento ainda não pôde ser confirmado. Seus dados foram preservados. Verifique
            antes de tentar enviar novamente.
          </Notice>
          <Action
            type="button"
            secondary
            disabled={busy}
            onClick={() => {
              if (submitting.current) return;
              submitting.current = true;
              setBusy(true);
              void reconcile()
                .catch(() =>
                  setMessage("A confirmação continua indisponível. Aguarde e verifique novamente."),
                )
                .finally(() => {
                  submitting.current = false;
                  setBusy(false);
                });
            }}
          >
            Verificar recebimento
          </Action>
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-6">
        <Action
          type="button"
          secondary
          disabled={step === 0 || busy || uncertain}
          onClick={() => changeStep(step - 1)}
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Action>
        <Action type="submit" disabled={busy || uncertain || (step === 3 && !canSubmit)}>
          {busy ? "Enviando…" : step === 3 ? "Solicitar Agendamento" : "Continuar"}
          {step < 3 && <ChevronRight className="size-4" />}
        </Action>
      </div>
    </form>
  );
}
