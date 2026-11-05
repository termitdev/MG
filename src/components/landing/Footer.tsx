import { AppLink } from "@/components/platform/AppLink";
import { MapPin, Phone, Instagram, MessageCircle } from "lucide-react";
import { Logo } from "./Logo";
import { company, externalWebsite, termitWebsiteUrl, validCnpj } from "@/config/company";

const links = [
  ["Sobre", "#sobre"],
  ["Exame", "#exame"],
  ["Como funciona", "#processo"],
  ["Dúvidas", "#duvidas"],
  ["Contato", "#contato"],
  ["Localização", "#contato"],
];
export function Footer({ sectionPrefix = "" }: { sectionPrefix?: string }) {
  const termitUrl = externalWebsite(termitWebsiteUrl);
  return (
    <footer className="mugui-footer mt-16 px-5 pb-7 pt-12 sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-9 md:grid-cols-2 lg:grid-cols-[0.9fr_1.25fr_0.85fr] lg:gap-12">
          <div className="min-w-0">
            <AppLink
              href={`${sectionPrefix}#inicio`}
              className="inline-flex px-3 py-2"
              aria-label="MUGUI — início"
            >
              <Logo />
            </AppLink>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Exame toxicológico com precisão, segurança e atendimento humano.
            </p>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Contato</h3>
            <address className="mt-4 space-y-4 text-sm not-italic text-muted-foreground">
              <AppLink
                href={company.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-start gap-3 leading-relaxed hover:text-primary"
              >
                <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
                <span>
                  {company.address.street}
                  <br />
                  {company.address.neighborhood}
                  <br />
                  {company.address.city} — {company.address.state}
                  <br />
                  CEP {company.address.postalCode}
                </span>
              </AppLink>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <AppLink
                  href={company.telephoneUrl}
                  className="inline-flex min-h-11 items-center gap-3 hover:text-primary"
                >
                  <Phone className="size-4" aria-hidden />
                  {company.phone}
                </AppLink>
                <AppLink
                  href={company.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 hover:text-primary"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </AppLink>
              </div>
            </address>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Navegação e atendimento</h3>
            <ul className="mt-3 grid grid-cols-2 gap-x-5 text-sm text-muted-foreground">
              {links.map(([label, href]) => (
                <li key={label}>
                  <AppLink
                    href={`${sectionPrefix}${href}`}
                    className="inline-flex min-h-11 items-center hover:text-primary"
                  >
                    {label}
                  </AppLink>
                </li>
              ))}
            </ul>
            <AppLink
              href={company.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center gap-2 break-all text-sm text-muted-foreground hover:text-primary"
            >
              <Instagram className="size-4 shrink-0" aria-hidden />
              {company.instagram}
            </AppLink>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p>© {new Date().getFullYear()} MUGUI. Todos os direitos reservados.</p>
            {validCnpj(company.cnpj) && <p>CNPJ: {company.cnpj}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <AppLink
              href="/privacidade"
              className="inline-flex min-h-11 items-center hover:text-primary"
            >
              Política de Privacidade
            </AppLink>
            <span>Termos de Uso</span>
          </div>
          <p>
            Site desenvolvido por{" "}
            {termitUrl ? (
              <AppLink
                href={termitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Termit
              </AppLink>
            ) : (
              <span className="font-medium text-foreground">Termit</span>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
