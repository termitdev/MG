import { Reveal } from "./Reveal";

export function About() {
  return (
    <section id="sobre" className="relative px-6 py-28 text-center sm:py-36">
      <div className="absolute left-[12%] top-20 size-3 rounded-full bg-primary" aria-hidden />
      <div className="absolute right-[15%] top-40 size-16 rounded-full border border-primary/30" aria-hidden />
      <div className="absolute bottom-24 left-[20%] h-px w-24 bg-primary/40" aria-hidden />
      <Reveal className="mx-auto max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">MUGUI</p>
        <h2 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
          Tecnologia no laboratório. <span className="text-muted-foreground">Cuidado em cada atendimento.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-muted-foreground">
          Um processo claro, seguro e acompanhado de perto — para você resolver o seu exame sem complicação.
        </p>
        <a href="#exame" className="mt-10 inline-flex rounded-full bg-foreground px-6 py-3 font-medium text-background transition hover:bg-primary">
          Conheça o exame
        </a>
      </Reveal>
    </section>
  );
}
