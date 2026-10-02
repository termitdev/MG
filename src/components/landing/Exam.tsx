import { ArrowUpRight, FileSearch, FlaskConical, Scissors, Clock, FileText, Info } from "lucide-react";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

// Content marked [a definir] should be confirmed by MUGUI before publishing.
const cards = [
  { icon: FileSearch, title: "O que é o exame", text: "Análise laboratorial que identifica o uso de substâncias em uma janela de tempo ampla.", span: "lg:col-span-2", featured: true },
  { icon: FlaskConical, title: "Como funciona", text: "Atendimento, coleta e análise em laboratório, com rastreabilidade em cada etapa." },
  { icon: Scissors, title: "Como é feita a coleta", text: "Coleta rápida e indolor, realizada por profissional capacitado. [Detalhes a definir]" },
  { icon: Clock, title: "Prazo do resultado", text: "Prazo informado no atendimento conforme o laboratório parceiro. [a definir]" },
  { icon: FileText, title: "Documentação", text: "Lista de documentos necessários para o atendimento. [a definir]" },
  { icon: Info, title: "Orientações", text: "Recomendações antes da coleta para garantir um processo tranquilo.", span: "lg:col-span-2" },
];

export function Exam() {
  return (
    <section id="exame" className="px-3 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[2.5rem] bg-primary-light px-6 py-20 sm:px-12">
        <Reveal className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">Tudo sobre o exame toxicológico.</h2>
          <p className="max-w-sm text-muted-foreground">Informação clara para você chegar preparado e sem dúvidas.</p>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 70} className={cn(c.span)}>
              <article
                className={cn(
                  "group flex h-full min-h-64 flex-col rounded-[2rem] p-8 transition hover:-translate-y-1 hover:shadow-soft",
                  c.featured ? "bg-primary text-primary-foreground" : "bg-surface",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn("grid size-10 place-items-center rounded-full", c.featured ? "bg-primary-foreground/15" : "bg-primary-light text-primary")}>
                    <c.icon className="size-4" />
                  </span>
                  <span className={cn("font-display text-3xl font-semibold", c.featured ? "text-primary-foreground/40" : "text-border")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className={cn("mt-auto pt-10 font-semibold", c.featured ? "text-3xl" : "text-xl")}>{c.title}</h3>
                <p className={cn("mt-2 text-sm", c.featured ? "text-primary-foreground/80" : "text-muted-foreground")}>{c.text}</p>
                <a href="#duvidas" className={cn("mt-5 inline-flex items-center gap-1 text-sm font-medium", c.featured ? "" : "text-primary")}>
                  Saiba mais <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
