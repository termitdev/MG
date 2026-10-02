import { cn } from "@/lib/utils";

/**
 * Slot for the official MUGUI logo.
 * To use the official file: upload it, import it here and set LOGO_SRC.
 * Until then a neutral typographic placeholder is shown (not a designed logo).
 */
const LOGO_SRC: string | null = null;

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  if (LOGO_SRC) {
    return <img src={LOGO_SRC} alt="MUGUI" className={cn("h-8 w-auto", className)} />;
  }
  return (
    <span
      aria-label="MUGUI"
      className={cn(
        "font-display text-xl font-bold tracking-[0.2em]",
        inverted ? "text-primary-foreground" : "text-foreground",
        className,
      )}
    >
      MUGUI
    </span>
  );
}
