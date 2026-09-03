import { useEffect } from "react";
import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { MarketingLayout } from "@/components/marketing/MarketingShell";
import { Toaster } from "@/components/ui/sonner";
import { initNativeShell } from "@/lib/native-shell";
import { initPhotoSource } from "@/lib/photo-source";
import appIcon from "../../mobile/mobile/assets/images/icon.png";

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
      { title: "TrimSwipe — Photo Cleaner for iPhone" },
      {
        name: "description",
        content:
          "Clean up your iPhone camera roll, review similar photos, trim large files, and reclaim storage with TrimSwipe.",
      },
      { name: "theme-color", content: "#fbf7f1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: appIcon },
      { rel: "apple-touch-icon", href: appIcon },
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
  const { pathname } = useLocation();
  const isNativeShell = typeof window !== "undefined" && window.__SLIM_NATIVE__ === true;
  const isMarketingRoute =
    !isNativeShell && (pathname === "/" || pathname === "/terms" || pathname === "/privacy");

  useEffect(() => {
    initNativeShell();
    initPhotoSource();
  }, []);

  if (isMarketingRoute) {
    return (
      <MarketingLayout>
        <Outlet />
      </MarketingLayout>
    );
  }

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
