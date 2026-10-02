// Placeholders: replace with real MUGUI data when available.
const metrics = [
  { value: "00+", label: "anos de experiência" },
  { value: "00k", label: "exames realizados" },
  { value: "00 dias", label: "prazo médio do resultado" },
];

export function Metrics() {
  return (
    <div className="relative mx-3 mb-3 grid grid-cols-1 divide-y divide-border rounded-[2rem] bg-surface text-foreground sm:mx-4 sm:mb-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {metrics.map((m) => (
        <div key={m.label} className="px-8 py-6">
          <div className="font-display text-4xl font-semibold text-primary">{m.value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{m.label}</div>
        </div>
      ))}
    </div>
  );
}
