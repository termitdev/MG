import { Reveal } from "./Reveal";
const matrices = [
  {
    title: "Em saliva",
    text: "Permite investigar exposição em uma janela geralmente curta. A detecção depende da substância, do método de análise e do padrão de consumo.",
  },
  {
    title: "Em urina",
    text: "Pode indicar exposição relativamente recente a determinadas substâncias. O intervalo varia conforme o que é analisado e as características do consumo.",
  },
  {
    title: "Em cabelos ou pelos",
    text: "Permite investigar exposição ao longo de períodos maiores. O comprimento da amostra, a metodologia e a substância analisada influenciam a janela de detecção.",
  },
];
export function ExamPurpose() {
  return (
    <section id="objetivo" className="px-3 sm:px-6">
      <div className="purpose-panel mx-auto grid max-w-6xl gap-10 rounded-[2.5rem] px-6 py-14 sm:px-12 sm:py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <p className="section-eyebrow">Entenda a análise</p>
          <h2 className="section-title mt-4">Objetivo do exame</h2>
          <p className="mt-5 leading-relaxed">
            O exame toxicológico tem como objetivo identificar a presença de substâncias psicoativas
            no organismo. A finalidade e o tipo de análise determinam quais matrizes biológicas
            podem ser utilizadas e suas janelas de detecção.
          </p>
          <p className="mt-6 text-sm leading-relaxed text-primary-foreground/85">
            As matrizes não são equivalentes para fins legais. Exames de larga janela de detecção
            seguem requisitos próprios para amostras queratínicas, como cabelos ou pelos, conforme a
            regulamentação.
          </p>
          <a
            href="https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-contran/resolucoes/Resolucao9232022.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Conheça os requisitos da larga janela
          </a>
        </Reveal>
        <ol className="relative space-y-8 border-l border-white/25 pl-7 sm:pl-9">
          {matrices.map((matrix, index) => (
            <li key={matrix.title} className="relative">
              <span
                className="absolute -left-[2.125rem] top-1 grid size-3 rounded-full border border-white/80 bg-[var(--mugui-blue-light)] sm:-left-[2.625rem]"
                aria-hidden
              />
              <Reveal delay={index * 90}>
                <span className="text-xs text-primary-foreground/70">0{index + 1}</span>
                <h3 className="mt-2 text-2xl font-semibold">{matrix.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-primary-foreground/85">
                  {matrix.text}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
