import { createFileRoute } from "@tanstack/react-router";
import { StatsPage } from "@/components/StatsPage";

export const Route = createFileRoute("/stats")({
  component: StatsRoute,
  head: () => ({
    meta: [
      { title: "Stats — Your slim & private cleanup progress" },
      { name: "description", content: "Track photos cleaned, MB freed, streak and memory accuracy." },
    ],
  }),
});

function StatsRoute() {
  return <StatsPage />;
}
