import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/admin/Overview";
export const Route = createFileRoute("/interno/")({ component: Overview });
