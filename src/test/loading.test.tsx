import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MuguiLoading } from "@/components/ui/MuguiLoading";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Loading e fallback", () => {
  it("exibe exclusivamente o PNG original em branco e informa o estado", async () => {
    const ready = vi.fn();
    render(<MuguiLoading fullscreen message="Enviando solicitação…" onReady={ready} />);
    expect(screen.getByRole("status")).toHaveTextContent("Enviando solicitação…");
    expect(screen.getByAltText("MUGUI")).toHaveAttribute("src", "/logomg.png");
    await waitFor(() => expect(ready).toHaveBeenCalled());
    expect(screen.getByAltText("MUGUI")).not.toHaveClass("opacity-0");
  });
  it("não cria WebGL quando o movimento reduzido está ativo", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    const complete = vi.fn();
    render(<MuguiLoading onComplete={complete} />);
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(context).not.toHaveBeenCalled();
  });
});
