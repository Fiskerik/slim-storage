import { createFileRoute } from "@tanstack/react-router";
import { MemoryGame } from "@/components/MemoryGame";

export const Route = createFileRoute("/memory")({
  component: MemoryRoute,
  head: () => ({
    meta: [
      { title: "Memory — Guess the year of forgotten photos" },
      {
        name: "description",
        content: "A memory game for your camera roll. Guess when each photo was taken, then keep or clear.",
      },
    ],
  }),
});

function MemoryRoute() {
  return <MemoryGame />;
}
