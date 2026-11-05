import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { BookingForm } from "@/components/booking/BookingForm";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Solicitar agendamento — MUGUI" },
      { name: "description", content: "Solicite seu exame toxicológico com a MUGUI." },
    ],
  }),
  component: () => (
    <div className="platform">
      <Navbar sectionPrefix="/" />
      <main className="px-5 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Agendamento
            </p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
              Seu atendimento começa aqui.
            </h1>
            <p className="mt-5 max-w-sm text-muted-foreground">
              Solicite seu exame em poucos passos. Nossa equipe analisará os dados e acompanhará a
              confirmação.
            </p>
            <p className="mt-6 max-w-sm text-sm text-muted-foreground">
              Seus dados permanecem nesta página durante o preenchimento. Ao sair ou atualizar, será
              necessário recomeçar.
            </p>
          </div>
          <div className="relative min-w-0 rounded-[2rem] border border-border bg-surface p-5 sm:p-8">
            <BookingForm />
          </div>
        </div>
      </main>
      <Footer sectionPrefix="/" />
    </div>
  ),
});
