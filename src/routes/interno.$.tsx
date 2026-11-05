import { createFileRoute } from "@tanstack/react-router";
import { AdminView } from "@/components/admin/AdminView";
export const Route = createFileRoute("/interno/$")({ component: AdminView });
