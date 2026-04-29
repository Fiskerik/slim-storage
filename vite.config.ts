// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Prerender all known routes at build time so the resulting `dist/client` works as a
// pure static SPA inside the iOS Capacitor webview.
export default defineConfig({
  tanstackStart: {
    prerender: {
      enabled: true,
      crawlLinks: true,
      // Routes that should exist as static HTML files in dist/client.
      // Capacitor will load index.html on launch; in-app navigation uses TanStack Router.
      routes: [
        "/",
        "/games",
        "/memory",
        "/stats",
        "/profile",
        "/privacy",
        "/games/speed-round",
        "/games/storage-budget",
        "/games/this-or-that",
      ],
    },
  },
});
