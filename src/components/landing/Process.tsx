// Adapted from the timeline.tsx supplied by the user, built using Hyperiux Vault:
// https://vault.hyperiux.com
import { useEffect, useRef } from "react";
import { CalendarCheck, UserRound, TestTube, Microscope, FileCheck2 } from "lucide-react";

const steps = [
  { icon: CalendarCheck, title: "Agendamento", text: "Escolha o melhor horário." },
  { icon: UserRound, title: "Atendimento", text: "Recepção e conferência de dados." },
  { icon: TestTube, title: "Coleta", text: "Rápida, segura e identificada." },
  { icon: Microscope, title: "Análise", text: "Processamento em laboratório." },
  { icon: FileCheck2, title: "Resultado", text: "Liberado com segurança." },
];

export function Process() {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    let disposed = false;
    let media: ReturnType<(typeof import("gsap"))["gsap"]["matchMedia"]> | undefined;
    void Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
      import("gsap/SplitText"),
      document.fonts?.ready,
    ])
      .then(([{ gsap }, { ScrollTrigger }, { SplitText }]) => {
        if (disposed || !section.current) return;
        gsap.registerPlugin(ScrollTrigger, SplitText);
        media = gsap.matchMedia();
        media.add(
          {
            all: "all",
            horizontal: "(min-width: 900px) and (min-height: 600px)",
            reduce: "(prefers-reduced-motion: reduce)",
          },
          (context) => {
            const root = section.current;
            if (!root || context.conditions?.["reduce"]) return;
            const viewport = root.querySelector<HTMLElement>(".timeline-viewport")!;
            const windowElement = root.querySelector<HTMLElement>(".timeline-window")!;
            const track = root.querySelector<HTMLElement>(".timeline-track")!;
            const axis = root.querySelector<HTMLElement>(".timeline-axis")!;
            const progress = root.querySelector<HTMLElement>(".timeline-progress")!;
            const stages = [...root.querySelectorAll<HTMLElement>(".timeline-stage")];
            const nodes = stages.map((stage) =>
              stage.querySelector<HTMLElement>(".timeline-node")!,
            );
            const horizontal = Boolean(context.conditions?.["horizontal"]);
            if (horizontal) root.classList.add("timeline-pinned");
            // Preserve the source's independently masked title/description lines.
            const splits = stages.map((stage) => ({
              title: SplitText.create(stage.querySelector("h3")!, {
                type: "chars, words, lines",
                mask: "lines",
                aria: "auto",
              }),
              description: SplitText.create(stage.querySelector("p")!, {
                type: "chars, words, lines",
                mask: "lines",
                aria: "auto",
              }),
            }));
            const createItemTimeline = (stage: HTMLElement, index: number) => {
              const stem = stage.querySelector(".timeline-stem");
              const dot = stage.querySelector(".timeline-tip");
              const isTop = index % 2 === 0;
              // Source sequence: branch and dot grow together, then masked lines reveal.
              return gsap
                .timeline()
                .fromTo(
                  stem,
                  { scaleY: 0, transformOrigin: isTop ? "bottom center" : "top center" },
                  { scaleY: 1, duration: 0.07 },
                )
                .fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.07 }, "<")
                .fromTo(
                  nodes[index]!,
                  { scale: 0.7, opacity: 0.45 },
                  { scale: 1, opacity: 1, duration: 0.07 },
                  "<",
                )
                .fromTo(
                  splits[index]!.title.lines,
                  { y: 100 },
                  { y: 0, duration: 0.13, stagger: 0.02, ease: "power2.out" },
                  0.04,
                )
                .fromTo(
                  splits[index]!.description.lines,
                  { y: 100 },
                  { y: 0, duration: 0.13, stagger: 0.02, ease: "power2.out" },
                  "<",
                );
            };
            const measureAxis = () => {
              const bounds = track.getBoundingClientRect(),
                first = nodes[0]!.getBoundingClientRect(),
                last = nodes.at(-1)!.getBoundingClientRect();
              axis.style.left = `${first.left + first.width / 2 - bounds.left}px`;
              axis.style.top = `${first.top + first.height / 2 - bounds.top}px`;
              axis.style.width = horizontal ? `${last.left - first.left}px` : "1px";
              axis.style.height = horizontal ? "2px" : `${last.top - first.top}px`;
            };
            measureAxis();
            const distance = () => Math.max(0, track.scrollWidth - windowElement.clientWidth);
            if (horizontal) {
              const timeline = gsap.timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                  id: "mugui-process",
                  trigger: viewport,
                  start: "top 104px",
                  end: () => `+=${Math.max(distance() * 1.5, window.innerHeight * 1.5)}`,
                  pin: viewport,
                  scrub: 0.5,
                  anticipatePin: 1,
                  invalidateOnRefresh: true,
                  onRefresh: measureAxis,
                },
              });
              timeline.to(track, { x: () => -distance(), duration: 1 }, 0);
              timeline.fromTo(
                progress,
                { scaleX: 0, transformOrigin: "left center" },
                { scaleX: 1, duration: 1 },
                0,
              );
              stages.forEach((stage, index) => {
                timeline.add(
                  createItemTimeline(stage, index),
                  (index / (stages.length - 1)) * 0.78,
                );
              });
            } else {
              gsap.fromTo(
                progress,
                { scaleY: 0, transformOrigin: "center top" },
                {
                  scaleY: 1,
                  ease: "none",
                  scrollTrigger: {
                    trigger: track,
                    start: "top 70%",
                    end: "bottom 65%",
                    scrub: true,
                    onRefresh: measureAxis,
                  },
                },
              );
              stages.forEach((stage, index) => {
                gsap.fromTo(
                  [...splits[index]!.title.lines, ...splits[index]!.description.lines],
                  { y: 100 },
                  {
                    y: 0,
                    stagger: 0.02,
                    duration: 0.45,
                    scrollTrigger: {
                      trigger: stage,
                      start: "top 90%",
                      toggleActions: "play none none reverse",
                    },
                  },
                );
                gsap.fromTo(
                  nodes[index]!,
                  { scale: 0.8 },
                  {
                    scale: 1,
                    duration: 0.4,
                    scrollTrigger: {
                      trigger: stage,
                      start: "top 90%",
                      toggleActions: "play none none reverse",
                    },
                  },
                );
              });
            }
            ScrollTrigger.refresh();
            return () => {
              splits.forEach(({ title, description }) => {
                title.revert();
                description.revert();
              });
              root.classList.remove("timeline-pinned");
              axis.removeAttribute("style");
            };
          },
          section,
        );
      })
      .catch(() => {
        media?.revert();
        section.current?.classList.remove("timeline-pinned");
      });
    return () => {
      disposed = true;
      media?.revert();
    };
  }, []);
  return (
    <section id="processo" ref={section} className="process-section section-space px-5 sm:px-6">
      <div className="timeline-viewport mx-auto max-w-6xl">
        <header className="mb-8">
          <h2 className="section-title">Como funciona</h2>
          <p className="mt-4 text-xl text-muted-foreground">Cinco etapas. Nenhuma complicação.</p>
        </header>
        <div className="timeline-window">
          <div className="timeline-track">
            <div className="timeline-axis" aria-hidden>
              <span className="timeline-progress" />
            </div>
            <ol className="timeline-list">
              {steps.map(({ icon: Icon, title, text }, index) => (
                <li className="timeline-stage" key={title}>
                  <span className="timeline-stem" aria-hidden>
                    <span className="timeline-tip" />
                  </span>
                  <div className="timeline-copy">
                    <span className="mb-3 block text-xs font-semibold tracking-widest text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 data-split className="text-2xl font-semibold">
                      {title}
                    </h3>
                    <p data-split className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {text}
                    </p>
                  </div>
                  <span className="timeline-node" aria-hidden>
                    <Icon className="size-4" />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
