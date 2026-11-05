import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const callbacks = vi.hoisted(() => ({ complete: undefined as undefined | (() => void) }));
vi.mock("@/components/ui/liquid-glass-logo-reveal", () => ({
  LiquidGlassLogoReveal: ({ onComplete }: { onComplete?: () => void }) => {
    callbacks.complete = onComplete;
    return <img src="/logomg.png" alt="MUGUI" />;
  },
}));
import { InitialLoading } from "@/components/ui/MuguiLoading";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  callbacks.complete = undefined;
});
describe("Ciclo de vida do loading inicial", () => {
  it("aguarda o callback real e mantém apenas rótulo invisível", async () => {
    vi.useFakeTimers();
    const { container } = render(<InitialLoading />);
    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(container.querySelector(".initial-loading")).not.toBeNull();
    expect(screen.getByText("Carregamento da aplicação")).toHaveClass("sr-only");
    expect(screen.queryByText(/Preparando seu atendimento/)).not.toBeInTheDocument();
    await act(async () => {
      callbacks.complete?.();
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector(".initial-loading")).toBeNull();
  });
  it("tem proteção de falha e não fica preso se o motor não responder", async () => {
    vi.useFakeTimers();
    const { container } = render(<InitialLoading />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector(".initial-loading")).toBeNull();
  });
});
