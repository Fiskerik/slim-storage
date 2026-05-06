import { createFileRoute } from "@tanstack/react-router";
import { ThisOrThat } from "@/components/ThisOrThat";

export const Route = createFileRoute("/games/this-or-that")({
  component: ThisOrThat,
});