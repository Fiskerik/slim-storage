import { createFileRoute } from "@tanstack/react-router";
import { GamesHub } from "@/components/GamesHub";

export const Route = createFileRoute("/games")({
  component: GamesRoute,
  head: () => ({
    meta: [
      { title: "Games — Slim" },
      {
        name: "description",
        content: "Pick a way to clean your camera roll: Memory Lane, This or That, Speed Round, or Storage Budget.",
      },
    ],
  }),
});

function GamesRoute() {
  return <GamesHub />;
}
