import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
export const Route = createFileRoute("/interno")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gestão do atendimento — MUGUI" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminShell,
});
