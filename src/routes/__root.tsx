import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import { initNativeShell } from "@/lib/native-shell";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Slim — Tinder for Photos with privacy built-in" },
      {
        name: "description",
        content:
          "Slim your camera roll in minutes. Swipe to keep, trim, or delete — strip metadata and reclaim storage, all on-device.",
      },
      { name: "theme-color", content: "#f5efe6" },
      { property: "og:title", content: "Slim — Tinder for Photos with privacy built-in" },
      { property: "og:description", content: "Slim Storage is a photo cleaner that slims your library by compressing images and stripping metadata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Slim — Tinder for Photos with privacy built-in" },
      { name: "description", content: "Slim Storage is a photo cleaner that slims your library by compressing images and stripping metadata." },
      { name: "twitter:description", content: "Slim Storage is a photo cleaner that slims your library by compressing images and stripping metadata." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/39ed5250-1154-4ccc-8f06-5d277293f64f/id-preview-8df2f7ff--69389407-3876-4baf-89a7-6f7f18b7d613.lovable.app-1777367486424.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/39ed5250-1154-4ccc-8f06-5d277293f64f/id-preview-8df2f7ff--69389407-3876-4baf-89a7-6f7f18b7d613.lovable.app-1777367486424.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    initNativeShell();
  }, []);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <TopBar />
        <main className="flex-1 pb-24">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
