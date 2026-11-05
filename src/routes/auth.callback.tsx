import { createFileRoute } from "@tanstack/react-router";
import { Access } from "@/components/auth/Access";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Convite — MUGUI" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Access,
});
