import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Engine = typeof import("./glass/engine.js");
let assets: Promise<{ canvas: HTMLCanvasElement; sdf: Float32Array }> | undefined;
function logoAssets(engine: Engine) {
  if (!assets)
    assets = engine
      .loadImage("/logomg.png")
      .then((image) => {
        const canvas = engine.fitToTexture(image, image.naturalWidth, image.naturalHeight);
        return { canvas, sdf: engine.buildSdf(canvas) };
      })
      .catch((error) => {
        assets = undefined;
        throw error;
      });
  return assets;
}
export type LiquidGlassProps = {
  className?: string;
  loop?: boolean;
  originalColors?: true;
  iconPlate?: false;
  keepPlate?: false;
  onReady?: () => void;
  onComplete?: () => void;
};
// React adapter for the original MIT shader/timeline used as the 21st component's public base.
export function LiquidGlassLogoReveal({
  className,
  loop = false,
  onReady,
  onComplete,
}: LiquidGlassProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [animated, setAnimated] = useState(false);
  const callbacks = useRef({ onReady, onComplete });
  useEffect(() => {
    callbacks.current = { onReady, onComplete };
  }, [onReady, onComplete]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false,
      raf = 0,
      completed = false;
    let renderer: ReturnType<Engine["createRenderer"]> = null;
    let observer: ResizeObserver | undefined;
    const finish = () => {
      if (!completed) {
        completed = true;
        callbacks.current.onComplete?.();
      }
    };
    const fallback = () => {
      setAnimated(false);
      callbacks.current.onReady?.();
      finish();
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      renderer?.dispose();
      renderer = null;
    };
    const onMotion = () => {
      if (motion.matches) {
        stop();
        fallback();
      }
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      fallback();
    };
    element.addEventListener("webglcontextlost", contextLost);
    motion.addEventListener("change", onMotion);
    if (motion.matches) {
      fallback();
    } else
      void import("./glass/engine.js")
        .then(async (engine) => {
          if (disposed) return;
          renderer = engine.createRenderer(element);
          if (!renderer) {
            fallback();
            return;
          }
          const logo = await logoAssets(engine);
          if (disposed || !renderer) return;
          renderer.setLogo(logo);
          const resize = () => {
            const size = Math.max(1, element.clientWidth);
            const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
            element.width = Math.round(size * ratio);
            element.height = element.width;
          };
          resize();
          observer = new ResizeObserver(resize);
          observer.observe(element);
          const params = {
            ...engine.BASE,
            logo: "mugui",
            originalColors: true,
            iconPlate: false,
            background: "#ffffff",
            logoScale: 0.85,
            finalScale: 1,
            logoColor: "#002040",
            opticalDepth: 1.35,
            dispersion: 1.85,
            glow: 1.3,
            specular: 1.25,
            bevelWidth: 0.16,
            shadow: 1.8,
          };
          const duration = engine.endOf(params);
          const started = performance.now();
          let lastFrame = -Infinity;
          let ready = false;
          const tick = (now: number) => {
            if (disposed || !renderer) return;
            const elapsed = (now - started) / 1000;
            if (document.visibilityState !== "hidden" && now - lastFrame >= 1000 / 30) {
              const phase = loop ? elapsed % (duration + 0.8 + 0.35) : Math.min(elapsed, duration);
              const time = Math.min(phase, duration);
              const outro = loop ? Math.max(0, Math.min(1, (phase - duration - 0.8) / 0.35)) : 0;
              renderer.render(
                engine.frameAt(time, params, outro),
                element.width,
                element.height,
                element.width * 0.72,
              );
              lastFrame = now;
              if (!ready) {
                ready = true;
                setAnimated(true);
                callbacks.current.onReady?.();
              }
            }
            if (elapsed >= duration) finish();
            if (loop || elapsed < duration) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        })
        .catch(() => {
          if (!disposed) {
            stop();
            fallback();
          }
        });
    return () => {
      disposed = true;
      element.removeEventListener("webglcontextlost", contextLost);
      motion.removeEventListener("change", onMotion);
      stop();
    };
  }, [loop]);
  return (
    <div className={cn("liquid-logo relative aspect-square w-[min(75vw,22rem)]", className)}>
      <img
        src="/logomg.png"
        alt="MUGUI"
        className={cn(
          "absolute inset-0 m-auto h-auto w-4/5 object-contain",
          animated && "opacity-0",
        )}
      />
      <canvas
        ref={canvas}
        aria-hidden
        className={cn("absolute inset-0 h-full w-full", !animated && "opacity-0")}
      />
    </div>
  );
}
