import { AppLink } from "@/components/platform/AppLink";
import { ArrowRight, ShieldCheck, Crosshair, HeartHandshake, Cpu } from "lucide-react";
import heroImg from "@/assets/hero-tech.jpg";

const badges = [
  { icon: ShieldCheck, label: "Segurança", pos: "left-[-1rem] top-16" },
  { icon: Crosshair, label: "Precisão", pos: "right-[-0.5rem] top-1/3" },
  { icon: HeartHandshake, label: "Atendimento", pos: "left-6 bottom-28" },
  { icon: Cpu, label: "Tecnologia", pos: "right-8 bottom-10" },
];

export function Hero() {
  return (
    <section id="inicio" className="px-3 pt-4 sm:px-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-primary text-primary-foreground">
        <div className="dot-grid absolute inset-0 opacity-60" aria-hidden />
        <div
          className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-primary-dark/40 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-10 px-6 pb-8 pt-14 sm:px-12 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div className="flex flex-col justify-center">
            <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs tracking-wide">
              <span className="size-1.5 rounded-full bg-primary-foreground" /> Exame toxicológico
            </span>
            <h1 className="text-5xl font-semibold leading-[0.95] sm:text-6xl lg:text-7xl">
              Precisão que você pode{" "}
              <span className="text-[var(--mugui-blue-primary)]">confiar.</span>
            </h1>
            <p className="mt-6 max-w-md text-base text-primary-foreground/80 sm:text-lg">
              Exame toxicológico com atendimento humano, processo ágil e rigor laboratorial do
              início ao resultado.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <AppLink
                href="/agendar"
                className="group inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 font-medium text-primary transition hover:shadow-soft"
              >
                Agendar exame{" "}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </AppLink>
              <AppLink
                href="#processo"
                className="rounded-full border border-primary-foreground/30 px-6 py-3 font-medium transition hover:bg-primary-foreground/10"
              >
                Como funciona
              </AppLink>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div
              className="absolute inset-x-6 bottom-0 top-10 rounded-t-[12rem] bg-primary-foreground/15"
              aria-hidden
            />
            <img
              src={heroImg}
              alt="Profissional da MUGUI segurando tubo de coleta"
              width={896}
              height={1152}
              className="relative aspect-[4/5] w-full rounded-t-[12rem] rounded-b-[2rem] object-cover"
            />
            {badges.map(({ icon: Icon, label, pos }, i) => (
              <span
                key={label}
                className={`animate-floaty absolute ${pos} hidden items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-float sm:inline-flex`}
                style={{ animationDelay: `${i * 0.8}s` }}
              >
                <Icon className="size-3.5 text-primary" /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
