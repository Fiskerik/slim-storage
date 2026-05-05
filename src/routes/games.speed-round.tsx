import { createFileRoute } from "@tanstack/react-router";
import { SpeedRound } from "@/components/SpeedRound";

export const Route = createFileRoute("/games/speed-round")({
  component: SpeedRound,
});
