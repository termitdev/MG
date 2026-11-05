import { AppLink } from "@/components/platform/AppLink";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
const links = [
  { href: "#inicio", label: "Início" },
  { href: "#exame", label: "O Exame" },
  { href: "#processo", label: "Como funciona" },
  { href: "#duvidas", label: "Dúvidas" },
  { href: "#contato", label: "Contato" },
];
export function Navbar({ sectionPrefix = "" }: { sectionPrefix?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  return (
    <header className="mugui-header sticky top-0 z-50 px-3 pt-3 sm:px-6">
      <nav
        aria-label="Principal"
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-border bg-white/95 px-3 text-foreground backdrop-blur-md transition-all duration-300 sm:px-7",
          scrolled ? "h-14 shadow-float" : "h-16",
        )}
      >
        <AppLink
          href={`${sectionPrefix}#inicio`}
          className="flex shrink-0 items-center px-2 py-1.5 sm:px-3"
          aria-label="MUGUI — início"
        >
          <Logo className="w-20 sm:w-28" />
        </AppLink>
        <ul className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <AppLink
                href={`${sectionPrefix}${link.href}`}
                className="inline-flex min-h-11 items-center transition-colors hover:text-primary"
              >
                {link.label}
              </AppLink>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center gap-1.5">
          <AppLink
            href="/login"
            className="hidden min-h-11 items-center px-3 text-sm text-muted-foreground transition hover:text-primary lg:inline-flex"
          >
            Acesso
          </AppLink>
          <AppLink
            href="/agendar"
            className="header-cta inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-semibold transition sm:px-5 sm:text-sm"
          >
            Agendar exame
          </AppLink>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Abrir menu"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-muted lg:hidden"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent className="max-h-dvh w-[min(22rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain">
              <SheetTitle className="mt-8 text-2xl">Navegação</SheetTitle>
              <SheetDescription>Conheça a MUGUI e solicite seu exame.</SheetDescription>
              <div className="mt-6 space-y-1">
                {links.map((link) => (
                  <AppLink
                    key={link.href}
                    href={`${sectionPrefix}${link.href}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3 text-foreground hover:bg-muted"
                  >
                    {link.label}
                  </AppLink>
                ))}
              </div>
              <AppLink
                href="/login"
                onClick={() => setOpen(false)}
                className="mt-3 flex min-h-11 items-center px-4 py-3 text-sm text-muted-foreground hover:text-primary"
              >
                Acesso
              </AppLink>
              <AppLink
                href="/agendar"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
              >
                Agendar exame
              </AppLink>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
