import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { GamesHub } from "@/components/GamesHub";

export const Route = createFileRoute("/games")({
  component: GamesRoute,
  head: () => ({
    meta: [
      { title: "Games — Slim" },
      {
        name: "description",
        content:
          "Pick a way to clean your camera roll: Memory Lane, This or That, Speed Round, or Storage Budget.",
      },
    ],
  }),
});

function GamesRoute() {
  const { location } = useRouterState();
  // At /games exactly → show the hub. At /games/* → render the child game.
  if (location.pathname === "/games") return <GamesHub />;
  return <Outlet />;
}
