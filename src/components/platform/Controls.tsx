import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "w-full min-w-0 rounded-2xl border border-border bg-surface px-4 py-3 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
export function Action({
  children,
  secondary,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${secondary ? "border border-border bg-surface text-foreground hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary-dark"} ${className}`}
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  id: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        {...props}
        id={id}
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-destructive/30 text-destructive" : "border-border bg-muted text-muted-foreground"}`}
    >
      {children}
    </p>
  );
}
export function Status({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium">
      {children}
    </span>
  );
}
