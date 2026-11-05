import { CarFront, BriefcaseBusiness, Plane } from "lucide-react";
import { Reveal } from "./Reveal";

const requirements = [
  {
    icon: CarFront,
    title: "Para fins de CNH",
    text: "Para as categorias C, D e E, há exigências na habilitação, renovação e mudança de categoria. Condutores com menos de 70 anos também realizam o periódico, conforme o CTB e a regulamentação do Contran.",
    highlight: "Periódico a cada 2 anos e 6 meses, quando aplicável.",
    source:
      "https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/novas-regras-do-ctb",
    label: "Consultar regras de CNH",
  },
  {
    icon: BriefcaseBusiness,
    title: "Para fins de CLT",
    text: "Para motoristas profissionais empregados no transporte rodoviário de cargas ou coletivo de passageiros, a regulamentação trabalhista prevê exames na admissão, no desligamento e periodicamente, inclusive por seleção randômica.",
    highlight: "As regras trabalhistas têm finalidade própria.",
    source:
      "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/sst-portarias/2024/portaria-mte-no-612-exame-toxicologico-altera-portaria-mtp-no-672_21.pdf/view",
    label: "Consultar regulamentação do MTE",
  },
  {
    icon: Plane,
    title: "RBAC nº 120",
    text: "Na aviação civil, o programa de prevenção do uso indevido de substâncias psicoativas abrange empresas e profissionais em atividades de risco à segurança operacional, nos limites definidos pela ANAC.",
    highlight: "Requisitos específicos da aviação civil.",
    source: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/rbha-e-rbac/rbac/rbac-120",
    label: "Consultar RBAC nº 120",
  },
];
export function ExamRequirements() {
  return (
    <section id="obrigatoriedade" className="section-space px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <p className="section-eyebrow">Informação para cada finalidade</p>
          <h2 className="section-title mt-4">Obrigatoriedade do exame toxicológico</h2>
          <p className="mt-5 text-muted-foreground">
            O exame toxicológico é obrigatório nas hipóteses previstas para condutores das
            categorias C, D e E e para motoristas profissionais, conforme a Lei nº 13.103/2015 e as
            regras aplicáveis a cada situação.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {requirements.map(({ icon: Icon, title, text, highlight, source, label }, index) => (
            <Reveal key={title} delay={index * 70} className="h-full">
              <article className="requirement-card flex h-full min-w-0 flex-col rounded-[2rem] border border-border p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <span className="text-xs text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-7 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
                <p className="mb-5 mt-5 text-sm font-medium text-foreground">{highlight}</p>
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
                >
                  {label}
                </a>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Informações gerais: as exigências não são iguais para todas as pessoas ou finalidades.
          Confirme o enquadramento e a regulamentação vigente com o órgão responsável.
        </p>
      </div>
    </section>
  );
}
