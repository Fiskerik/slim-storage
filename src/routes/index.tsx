import { createFileRoute } from "@tanstack/react-router";
import { SwipeDeck } from "@/components/SwipeDeck";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Slim — Swipe to clean your camera roll" },
      {
        name: "description",
        content: "Swipe left to keep, up to trim, right to delete. Slim your photo library on-device.",
      },
    ],
  }),
});

function Index() {
  return (
    <div className="flex flex-col">
      <SwipeDeck />
    </div>
  );
}
