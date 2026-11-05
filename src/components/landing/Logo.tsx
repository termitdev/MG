import { cn } from "@/lib/utils";

// The official image is shared by the header and footer.
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-block h-7 w-24 shrink-0 align-middle sm:h-8 sm:w-28",
        className,
      )}
    >
      <img
        src="/logomg.png"
        alt="MUGUI"
        className="pointer-events-none absolute left-0 top-1/2 h-auto w-full -translate-y-1/2"
      />
    </span>
  );
}
