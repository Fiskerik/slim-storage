import { createFileRoute } from "@tanstack/react-router";
import { SpeedRound } from "@/components/SpeedRound";

export const Route = createFileRoute("/games/speed-round")({
  component: SpeedRoundRoute,
  head: () => ({
    meta: [{ title: "Speed Round — Slim" }],
  }),
});

function SpeedRoundRoute() {
  return <SpeedRound />;
}
