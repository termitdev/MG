import { AppLink } from "@/components/platform/AppLink";
import { ArrowRight } from "lucide-react";
import { company } from "@/config/company";

export function Cta() {
  return (
    <section id="contato" className="px-3 sm:px-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-primary px-6 py-20 text-center text-primary-foreground sm:px-12 sm:py-28">
        <div className="dot-grid absolute inset-0 opacity-50" aria-hidden />
        <div
          className="absolute -bottom-40 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-primary-dark/50 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-4xl font-semibold leading-tight sm:text-6xl">
            Agende seu exame com a MUGUI.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-primary-foreground/80">
            Atendimento ágil, seguro e humano. Escolha o melhor horário para você.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <AppLink
              href="/agendar"
              className="group inline-flex items-center gap-2 rounded-full bg-surface px-7 py-3.5 font-medium text-primary transition hover:shadow-soft"
            >
              Agendar exame <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </AppLink>
            <AppLink
              href={company.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-primary-foreground/30 px-7 py-3.5 font-medium transition hover:bg-primary-foreground/10"
            >
              Entrar em contato
            </AppLink>
          </div>
          <div className="mx-auto mt-8 max-w-xl space-y-3 text-sm text-primary-foreground/90">
            <AppLink
              href={company.telephoneUrl}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {company.phone}
            </AppLink>
            <p>
              <AppLink
                href={company.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="leading-relaxed underline underline-offset-4"
              >
                {company.formattedAddress}
              </AppLink>
            </p>
            <AppLink
              href={company.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {company.instagram}
            </AppLink>
          </div>
        </div>
      </div>
    </section>
  );
}
