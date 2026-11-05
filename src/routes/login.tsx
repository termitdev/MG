import { createFileRoute } from "@tanstack/react-router";
import { Access } from "@/components/auth/Access";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Acesso — MUGUI" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Access,
});
