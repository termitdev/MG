import { createContext, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useRouter } from "@tanstack/react-router";
import {
  Menu,
  LogOut,
  LayoutDashboard,
  UsersRound,
  ClipboardList,
  FlaskConical,
  History,
  UserCog,
  Settings2,
  ArrowUpRight,
} from "lucide-react";
import { Logo } from "@/components/landing/Logo";
import { Notice } from "@/components/platform/Controls";
import { AppLink } from "@/components/platform/AppLink";
import { api, ApiError } from "@/services/api";
import type { StaffProfile } from "@/lib/scheduling";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const StaffContext = createContext<StaffProfile | null>(null);
export function useStaff() {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error("Staff context missing");
  return staff;
}
const navigation = [
  { label: "Visão geral", url: "/interno", icon: LayoutDashboard },
  { label: "Pacientes", url: "/interno/pacientes", icon: UsersRound },
  { label: "Solicitações", url: "/interno/solicitacoes", icon: ClipboardList },
  { label: "Laboratório", url: "/interno/laboratorio", icon: FlaskConical },
  { label: "Histórico", url: "/interno/historico", icon: History },
  { label: "Gerenciar Usuários", url: "/interno/usuarios", icon: UserCog, admin: true },
  { label: "Configurações", url: "/interno/configuracoes", icon: Settings2 },
];
export function AdminShell() {
  const [profile, setProfile] = useState<StaffProfile>();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  useEffect(() => {
    let active = true;
    const check = () =>
      api<{ profile: StaffProfile; needsMfa: boolean }>("auth/session")
        .then((result) => {
          if (!active) return;
          if (result.needsMfa || result.profile.invitation_pending) {
            void router.navigate({ to: "/login", replace: true });
            return;
          }
          setProfile(result.profile);
        })
        .catch((e) => {
          if (!active) return;
          setProfile(undefined);
          if (e instanceof ApiError && [401, 403].includes(e.status))
            void router.navigate({ to: "/login", replace: true });
          else setError(e.message);
        });
    void check();
    const timer = setInterval(check, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [router]);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  if (!profile)
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        {error ? <Notice error>{error}</Notice> : <p role="status">Verificando acesso seguro…</p>}
        <AppLink className="mt-5 block text-primary underline" href="/login">
          Acessar conta
        </AppLink>
      </main>
    );
  const activePage = (url: string) =>
    pathname === url || (url !== "/interno" && pathname.startsWith(url + "/"));
  const title = navigation.find((item) => activePage(item.url))?.label ?? "Detalhes da solicitação";
  const initials = profile.full_name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  const links = (label: string) => (
    <nav aria-label={label} className="admin-navigation">
      {navigation
        .filter((item) => !item.admin || profile.role === "admin")
        .map(({ label: text, url, icon: Icon }) => (
          <AppLink
            key={url}
            href={url}
            onClick={() => setOpen(false)}
            aria-current={activePage(url) ? "page" : undefined}
          >
            <Icon className="size-[1.125rem] shrink-0" aria-hidden />
            <span>{text}</span>
          </AppLink>
        ))}
    </nav>
  );
  return (
    <StaffContext.Provider value={profile}>
      <div className="platform admin-workspace">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <AppLink href="/" aria-label="MUGUI — início" className="inline-flex px-3 py-4">
              <Logo />
            </AppLink>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  className="admin-icon-button lg:hidden"
                  aria-label={open ? "Fechar navegação" : "Abrir navegação"}
                  aria-expanded={open}
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="admin-mobile-sidebar max-h-dvh w-[min(22rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain"
              >
                <SheetTitle className="mt-8">Área interna</SheetTitle>
                <SheetDescription>Navegação da equipe MUGUI.</SheetDescription>
                <div className="mt-8">{links("Área interna mobile")}</div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="hidden flex-1 flex-col lg:flex">
            <p className="admin-nav-label">Atendimento</p>
            {links("Área interna")}
            <div className="admin-sidebar-footer">
              <span className="text-xs text-muted-foreground">MUGUI · Área interna</span>
              <AppLink
                href="/"
                className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-primary"
              >
                Voltar ao site <ArrowUpRight className="size-4" aria-hidden />
              </AppLink>
            </div>
          </div>
        </aside>
        <div className="admin-main">
          <header className="admin-topbar">
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">
                Área interna{" "}
                <span className="mx-2" aria-hidden>
                  /
                </span>{" "}
                MUGUI
              </p>
              <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
            </div>
            <div className="admin-account">
              <span className="admin-avatar" aria-hidden>
                {initials}
              </span>
              <div className="min-w-0 max-w-[min(15rem,40vw)] break-words text-xs">
                <p className="font-semibold">{profile.full_name}</p>
                <p className="mt-1 text-muted-foreground">
                  {profile.role === "admin" ? "Administrador" : "Funcionário"}
                </p>
              </div>
              <AppLink href="/login" className="admin-account-link">
                Conta
              </AppLink>
              <button
                aria-label="Sair"
                title="Sair da conta"
                disabled={loggingOut}
                className="admin-icon-button"
                onClick={() => {
                  if (loggingOut) return;
                  setLoggingOut(true);
                  void api("auth/logout", {})
                    .then(() => router.navigate({ to: "/login", replace: true }))
                    .catch((e) => setError(e.message))
                    .finally(() => setLoggingOut(false));
                }}
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>
          <main className="admin-content">
            {error && (
              <div className="mb-5">
                <Notice error>{error}</Notice>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </StaffContext.Provider>
  );
}
