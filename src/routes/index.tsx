import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/HomePage";
import { LandingPage } from "@/components/marketing/LandingPage";
import heroVisual from "../../mobile/mobile/assets/images/store/trimswipe-current-ui-banner-copy-v2.png";
import { TRIMSWIPE_SITE_URL } from "@/lib/marketing";

const socialImageUrl = new URL(heroVisual, TRIMSWIPE_SITE_URL).toString();

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "TrimSwipe: iPhone Photo Cleaner to Free Up Storage" },
      {
        name: "description",
        content:
          "Clean up your iPhone camera roll with quick swipes. Find similar photos, trim large files, and free storage privately—nothing changes until you confirm.",
      },
      {
        name: "keywords",
        content:
          "iPhone photo cleaner, camera roll cleaner, clean similar photos, free iPhone storage, photo cleanup app",
      },
      { property: "og:title", content: "TrimSwipe — Clean up your camera roll" },
      {
        property: "og:description",
        content:
          "Find similar photos, trim oversized files, and reclaim iPhone storage with quick, private swipes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${TRIMSWIPE_SITE_URL}/` },
      { property: "og:image", content: socialImageUrl },
      { property: "og:image:width", content: "1680" },
      { property: "og:image:height", content: "934" },
      { property: "og:image:alt", content: "TrimSwipe photo cleaner shown on two iPhones" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TrimSwipe — Clean up your camera roll" },
      {
        name: "twitter:description",
        content:
          "Find similar photos, trim oversized files, and reclaim iPhone storage with quick, private swipes.",
      },
      { name: "twitter:image", content: socialImageUrl },
    ],
    links: [{ rel: "canonical", href: `${TRIMSWIPE_SITE_URL}/` }],
  }),
});

function Index() {
  const isNativeShell = typeof window !== "undefined" && window.__SLIM_NATIVE__ === true;
  return isNativeShell ? <HomePage /> : <LandingPage />;
}
