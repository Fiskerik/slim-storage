import { createFileRoute } from "@tanstack/react-router";
import { StorageBudget } from "@/components/StorageBudget";

export const Route = createFileRoute("/games/storage-budget")({
  component: StorageBudgetRoute,
  head: () => ({
    meta: [{ title: "Storage Budget — Slim" }],
  }),
});

function StorageBudgetRoute() {
  return <StorageBudget />;
}
