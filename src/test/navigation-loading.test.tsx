import { useEffect } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ pathname: "/", mounts: 0, navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: state.navigate }),
  useLocation: () => state.pathname,
}));
vi.mock("@/components/ui/MuguiLoading", () => ({
  InitialLoading: () => {
    useEffect(() => {
      state.mounts++;
    }, []);
    return <div data-testid="entry-loading" />;
  },
}));
import { EntryLoading } from "@/components/platform/EntryLoading";
import { AppLink } from "@/components/platform/AppLink";
beforeEach(() => {
  state.pathname = "/";
  state.mounts = 0;
  state.navigate.mockReset();
  window.history.replaceState(null, "", "/");
});
afterEach(() => cleanup());
describe("Liquid Glass navigation policy", () => {
  it("runs on document mount and public entry to authentication, never on routine routes or account/logout", () => {
    const view = render(<EntryLoading />);
    expect(state.mounts).toBe(1);
    for (const path of ["/agendar", "/privacidade", "/"]) {
      state.pathname = path;
      view.rerender(<EntryLoading />);
      expect(state.mounts).toBe(1);
    }
    state.pathname = "/login";
    view.rerender(<EntryLoading />);
    expect(state.mounts).toBe(2);
    for (const path of [
      "/acesso",
      "/interno",
      "/interno/solicitacoes",
      "/interno/pacientes",
      "/login",
    ]) {
      state.pathname = path;
      view.rerender(<EntryLoading />);
      expect(state.mounts).toBe(2);
    }
    view.unmount();
    render(<EntryLoading />);
    expect(state.mounts).toBe(3);
  });
  it("keeps local navigation in the router and preserves caller handlers", () => {
    const clicked = vi.fn();
    render(
      <AppLink href="/agendar" onClick={clicked}>
        Agendar
      </AppLink>,
    );
    fireEvent.click(screen.getByText("Agendar"));
    expect(state.navigate).toHaveBeenCalledWith({ href: "/agendar" });
    expect(clicked).toHaveBeenCalledTimes(1);
  });
  it("preserves hash, external, download and modified-click navigation", () => {
    const prevented: boolean[] = [];
    render(
      <div
        onClick={(event) => {
          prevented.push(event.defaultPrevented);
          event.preventDefault();
        }}
      >
        <AppLink href="#processo">Seção</AppLink>
        <AppLink href="https://example.invalid" target="_blank">
          Externo
        </AppLink>
        <AppLink href="/arquivo.pdf" download>
          Arquivo
        </AppLink>
        <AppLink href="/login">Acesso</AppLink>
      </div>,
    );
    fireEvent.click(screen.getByText("Seção"));
    fireEvent.click(screen.getByText("Externo"));
    fireEvent.click(screen.getByText("Arquivo"));
    fireEvent.click(screen.getByText("Acesso"), { ctrlKey: true });
    expect(state.navigate).not.toHaveBeenCalled();
    expect(prevented).toEqual([false, false, false, false]);
  });
});
