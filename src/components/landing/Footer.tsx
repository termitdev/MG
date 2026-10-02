import { Logo } from "./Logo";

const cols = [
  { title: "Clínica", links: [["Sobre", "#sobre"], ["Exame", "#exame"], ["Como funciona", "#processo"]] },
  { title: "Atendimento", links: [["Dúvidas", "#duvidas"], ["Contato", "#contato"], ["Localização", "#contato"]] },
  { title: "Contato", links: [["(00) 0000-0000", "#"], ["contato@mugui.com.br", "#"], ["Endereço a definir", "#"]] },
];

export function Footer() {
  return (
    <footer className="px-6 pb-10 pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">Exame toxicológico com precisão, segurança e atendimento humano.</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-semibold">{c.title}</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                {c.links.map(([l, h]) => (
                  <li key={l}><a href={h} className="transition hover:text-primary">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} MUGUI. Todos os direitos reservados.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary">Política de Privacidade</a>
            <a href="#" className="hover:text-primary">Termos de Uso</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
