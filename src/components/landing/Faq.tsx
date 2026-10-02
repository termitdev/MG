import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Answers are general; confirm specifics with MUGUI.
const faqs = [
  { q: "Quem precisa fazer o exame toxicológico?", a: "A exigência depende da finalidade (habilitação, emprego, entre outras). Nossa equipe orienta você no atendimento." },
  { q: "Preciso agendar?", a: "Recomendamos o agendamento para garantir agilidade. Entre em contato pelos nossos canais." },
  { q: "Quais documentos devo levar?", a: "A lista de documentos será informada pela MUGUI. [a definir]" },
  { q: "Em quanto tempo sai o resultado?", a: "O prazo é informado no atendimento, conforme o laboratório. [a definir]" },
  { q: "A coleta dói?", a: "Não. A coleta é rápida, indolor e feita por profissional capacitado." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="duvidas" className="px-6 py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">Dúvidas frequentes.</h2>
        <div className="border-t border-border">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-border">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-medium transition hover:text-primary"
                >
                  {f.q}
                  <Plus className={cn("size-5 shrink-0 text-primary transition-transform duration-300", isOpen && "rotate-45")} />
                </button>
                <div className={cn("grid transition-all duration-300", isOpen ? "grid-rows-[1fr] pb-6 opacity-100" : "grid-rows-[0fr] opacity-0")}>
                  <p className="overflow-hidden text-muted-foreground">{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
