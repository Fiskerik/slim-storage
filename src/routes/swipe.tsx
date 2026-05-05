import { createFileRoute } from "@tanstack/react-router";
import { SwipeDeck } from "@/components/SwipeDeck";

export const Route = createFileRoute("/swipe")({
  component: SwipeRoute,
  head: () => ({
    meta: [
      { title: "Swipe — Clean your camera roll" },
      {
        name: "description",
        content: "Swipe left to keep, up to trim, right to delete.",
      },
    ],
  }),
});

function SwipeRoute() {
  return (
    <div className="flex flex-col">
      <SwipeDeck />
    </div>
  );
}
