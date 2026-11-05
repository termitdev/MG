import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LiquidGlassLogoReveal } from "./liquid-glass-logo-reveal";

export function MuguiLoading({
  fullscreen = false,
  message = "Carregando…",
  loop = false,
  onReady,
  onComplete,
}: {
  fullscreen?: boolean;
  message?: string;
  loop?: boolean;
  onReady?: () => void;
  onComplete?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "mugui-loading flex flex-col items-center justify-center bg-white px-5 text-[var(--mugui-navy)]",
        fullscreen ? "pointer-events-none fixed inset-0 z-[100] min-h-dvh" : "w-full py-8",
      )}
    >
      <LiquidGlassLogoReveal
        originalColors={true}
        iconPlate={false}
        keepPlate={false}
        loop={loop}
        {...(onReady ? { onReady } : {})}
        {...(onComplete ? { onComplete } : {})}
      />
      <p className={message ? "max-w-sm text-center text-sm leading-relaxed" : "sr-only"}>
        {message || "Carregamento da aplicação"}
      </p>
    </div>
  );
}
export function InitialLoading() {
  const [appReady, setAppReady] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);
  const complete = useCallback(() => setAnimationComplete(true), []);
  useEffect(() => {
    // Mount means the essential React shell is ready. Animation completion is an independent signal.
    setAppReady(true);
    const deadline = setTimeout(() => {
      setAppReady(true);
      setAnimationComplete(true);
    }, 6000);
    return () => {
      clearTimeout(deadline);
    };
  }, []);
  useEffect(() => {
    if (!appReady || !animationComplete) return;
    const frame = requestAnimationFrame(() => setExiting(true));
    const timer = setTimeout(
      () => setVisible(false),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260,
    );
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [appReady, animationComplete]);
  return visible ? (
    <div
      className={cn(
        "initial-loading transition-opacity duration-200 motion-reduce:transition-none",
        exiting ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <MuguiLoading fullscreen onComplete={complete} message="" />
    </div>
  ) : null;
}
