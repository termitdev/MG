import { createFileRoute } from "@tanstack/react-router";
import { Access } from "@/components/auth/Access";
export const Route = createFileRoute("/acesso")({
  head: () => ({
    meta: [{ title: "Acesso da equipe — MUGUI" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Access,
});
