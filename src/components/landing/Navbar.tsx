import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "#inicio", label: "Início" },
  { href: "#exame", label: "O Exame" },
  { href: "#processo", label: "Como funciona" },
  { href: "#duvidas", label: "Dúvidas" },
  { href: "#contato", label: "Contato" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6">
      <nav
        aria-label="Principal"
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-full border border-border/60 bg-surface/90 px-5 backdrop-blur-md transition-all duration-300 sm:px-7",
          scrolled ? "h-14 shadow-float" : "h-16",
        )}
      >
        <a href="#inicio"><Logo /></a>
        <ul className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="transition-colors hover:text-primary">{l.label}</a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <a href="#contato" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-dark sm:px-5">
            Agendar exame
          </a>
          <button aria-label="Abrir menu" onClick={() => setOpen(!open)} className="grid size-9 place-items-center rounded-full bg-muted md:hidden">
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="mx-auto mt-2 max-w-6xl rounded-3xl border border-border bg-surface p-4 shadow-float md:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-foreground hover:bg-muted">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
