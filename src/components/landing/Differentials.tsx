import careImg from "@/assets/care.jpg";
import { Check } from "lucide-react";
import { Reveal } from "./Reveal";

const items = [
  "Atendimento humano e acolhedor",
  "Processo ágil e organizado",
  "Rigor e rastreabilidade laboratorial",
  "Ambiente moderno e seguro",
];

export function Differentials() {
  return (
    <section id="diferenciais" className="px-3 pt-16 sm:px-6 lg:pt-28">
      <div className="relative mx-auto max-w-6xl rounded-[2.5rem] bg-primary text-primary-foreground">
        <div className="dot-grid absolute inset-0 rounded-[2.5rem] opacity-50" aria-hidden />
        <div className="relative grid gap-10 px-6 py-16 sm:px-12 lg:grid-cols-2 lg:py-20">
          <div className="relative order-2 lg:order-1">
            <img
              src={careImg}
              alt="Profissional recebendo paciente na clínica"
              loading="lazy"
              width={1024}
              height={1152}
              className="w-full rounded-[2rem] object-cover shadow-soft lg:absolute lg:-top-40 lg:bottom-0 lg:h-[calc(100%+10rem)]"
            />
            <span className="animate-floaty absolute -right-3 bottom-10 rounded-full bg-surface px-4 py-2 text-xs font-medium text-foreground shadow-float">
              Atendimento humano
            </span>
          </div>
          <Reveal className="order-1 lg:order-2 lg:pl-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
              Diferenciais
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              Por que escolher a MUGUI.
            </h2>
            <ul className="mt-8 space-y-3">
              {items.map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="grid size-6 place-items-center rounded-full bg-primary-foreground/15">
                    <Check className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
