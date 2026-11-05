import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Turnstile } from "@/components/booking/Turnstile";
type Options = Parameters<NonNullable<Window["turnstile"]>["render"]>[1];
let options: Options;
let resize: () => void;
let width = 240;
const widget = () => ({
  ready: (cb: () => void) => cb(),
  render: vi.fn((_el: HTMLElement, value: Options) => {
    options = value;
    return "widget-id";
  }),
  remove: vi.fn(),
});
beforeEach(() => {
  width = 240;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  document.querySelectorAll("script[data-mugui-turnstile]").forEach((e) => e.remove());
  delete window.turnstile;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.turnstile;
});
describe("Turnstile React lifecycle", () => {
  it("stops waiting when the script never loads and offers manual recovery", async () => {
    vi.useFakeTimers();
    render(<Turnstile siteKey="synthetic" attempt={0} onToken={vi.fn()} />);
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("carregar");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
    expect(document.querySelectorAll("script[data-mugui-turnstile]")).toHaveLength(0);
  });
  it("renders once under StrictMode and does not remount when only the callback changes", async () => {
    const api = widget();
    window.turnstile = api;
    const first = vi.fn(),
      next = vi.fn();
    const view = render(
      <StrictMode>
        <Turnstile siteKey="synthetic" attempt={0} onToken={first} />
      </StrictMode>,
    );
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    view.rerender(
      <StrictMode>
        <Turnstile siteKey="synthetic" attempt={0} onToken={next} />
      </StrictMode>,
    );
    act(() => options.callback("synthetic-token"));
    expect(next).toHaveBeenLastCalledWith("synthetic-token");
    expect(api.render).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-id");
    expect(next).toHaveBeenLastCalledWith("");
  });
  it("invalidates expired tokens and retries only when requested", async () => {
    const api = widget();
    window.turnstile = api;
    const token = vi.fn();
    render(<Turnstile siteKey="synthetic" attempt={0} onToken={token} />);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    act(() => options.callback("synthetic-token"));
    act(() => options["expired-callback"]());
    expect(token).toHaveBeenLastCalledWith("");
    expect(await screen.findByRole("alert")).toHaveTextContent("expirou");
    expect(api.render).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
    expect(options.retry).toBe("never");
    expect(options["refresh-expired"]).toBe("manual");
  });
  it("recovers after script failure with one new script and initializes only after readiness", async () => {
    const meta = document.createElement("meta");
    meta.name = "csp-nonce";
    meta.content = "synthetic-nonce";
    document.head.append(meta);
    render(<Turnstile siteKey="synthetic" attempt={0} onToken={vi.fn()} />);
    const script = document.querySelector("script[data-mugui-turnstile]")!;
    expect(script.getAttribute("src")).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    expect((script as HTMLScriptElement).nonce).toBe("synthetic-nonce");
    meta.remove();
    act(() => script.dispatchEvent(new Event("error")));
    expect(await screen.findByRole("alert")).toHaveTextContent("carregar");
    expect(document.querySelectorAll("script[data-mugui-turnstile]")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    const replacement = document.querySelector("script[data-mugui-turnstile]")!;
    expect(replacement).not.toBe(script);
    expect(document.querySelectorAll("script[data-mugui-turnstile]")).toHaveLength(1);
    const api = widget();
    window.turnstile = api;
    act(() => replacement.dispatchEvent(new Event("load")));
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
  });
  it("reuses the loaded SDK across navigation and ignores callbacks after unmount", async () => {
    const first = vi.fn();
    const view = render(<Turnstile siteKey="synthetic" attempt={0} onToken={first} />);
    const script = document.querySelector("script[data-mugui-turnstile]")!;
    const api = widget();
    window.turnstile = api;
    act(() => script.dispatchEvent(new Event("load")));
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    const previous = options;
    view.unmount();
    first.mockClear();
    act(() => previous.callback("stale-token"));
    expect(first).not.toHaveBeenCalled();
    render(<Turnstile siteKey="synthetic" attempt={0} onToken={vi.fn()} />);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
    expect(document.querySelectorAll("script[data-mugui-turnstile]")).toHaveLength(1);
    expect(document.querySelector("script[data-mugui-turnstile]")).toBe(script);
    expect("muguiTurnstileReady" in window).toBe(false);
  });
  it("uses official sizes and changes widgets only when the available width crosses 300px", async () => {
    const api = widget();
    window.turnstile = api;
    const token = vi.fn();
    render(<Turnstile siteKey="synthetic" attempt={0} onToken={token} />);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    expect(options.size).toBe("compact");
    act(() => {
      width = 280;
      resize();
    });
    expect(api.render).toHaveBeenCalledTimes(1);
    act(() => options.callback("previous-size-token"));
    act(() => {
      width = 360;
      resize();
    });
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
    expect(options.size).toBe("flexible");
    expect(token).toHaveBeenLastCalledWith("");
    act(() => {
      width = 240;
      resize();
    });
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(3));
    expect(options.size).toBe("compact");
  });
  it("shows safe provider error codes and leaves the token empty", async () => {
    const api = widget();
    window.turnstile = api;
    const token = vi.fn();
    render(<Turnstile siteKey="synthetic" attempt={0} onToken={token} />);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    act(() => {
      options["error-callback"]("110200");
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("110200");
    expect(token).toHaveBeenLastCalledWith("");
  });
});
