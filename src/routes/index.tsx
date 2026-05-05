import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/HomePage";

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
  return <HomePage />;
}
