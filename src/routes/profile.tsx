import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/ProfilePage";

export const Route = createFileRoute("/profile")({
  component: ProfileRoute,
  head: () => ({
    meta: [
      { title: "Profile — TrimSwipe" },
      { name: "description", content: "Your stats, settings, and privacy controls." },
    ],
  }),
});

function ProfileRoute() {
  return <ProfilePage />;
}
