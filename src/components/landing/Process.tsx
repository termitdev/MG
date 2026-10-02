import { CalendarCheck, UserRound, TestTube, Microscope, FileCheck2 } from "lucide-react";
import { Reveal } from "./Reveal";

const steps = [
  { icon: CalendarCheck, title: "Agendamento", text: "Escolha o melhor horário." },
  { icon: UserRound, title: "Atendimento", text: "Recepção e conferência de dados." },
  { icon: TestTube, title: "Coleta", text: "Rápida, segura e identificada." },
  { icon: Microscope, title: "Análise", text: "Processamento em laboratório." },
  { icon: FileCheck2, title: "Resultado", text: "Liberado com segurança." },
];

export function Process() {
  return (
    <section id="processo" className="px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-16 max-w-xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Como funciona</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">Cinco etapas. Nenhuma complicação.</h2>
        </Reveal>
        <ol className="relative grid gap-12 lg:grid-cols-5 lg:gap-6">
          <div className="absolute left-5 top-0 h-full w-px bg-border lg:left-0 lg:top-5 lg:h-px lg:w-full" aria-hidden />
          {steps.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 120} className="relative pl-16 lg:pl-0">
                <span className="absolute left-0 top-0 grid size-10 place-items-center rounded-full border border-primary/30 bg-background text-primary lg:relative">
                  <s.icon className="size-4" />
                </span>
                <div className="font-display text-5xl font-semibold text-primary/20 lg:mt-8">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="mt-2 text-xl font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
