#!/usr/bin/env bun
/**
 * Post-build step for the iOS / Capacitor target.
 *
 * After `vite build`, this script:
 *  1. Spins up the prod SSR worker (`dist/server/index.js`) using wrangler.
 *  2. Fetches `/` and a few other routes.
 *  3. Rewrites the returned HTML so all asset paths are RELATIVE
 *     (so they resolve under `capacitor://localhost/` inside the iOS webview).
 *  4. Writes the HTML files into `dist/client/` so Capacitor can use it as webDir.
 *
 * Run with:  bun run scripts/build-ios.ts
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROUTES = [
  "/",
  "/games",
  "/memory",
  "/stats",
  "/profile",
  "/privacy",
  "/games/speed-round",
  "/games/storage-budget",
  "/games/this-or-that",
];

const PORT = 8799;
const HOST = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dir, "..");
const CLIENT_DIR = resolve(ROOT, "dist/client");

if (!existsSync(resolve(ROOT, "dist/server/index.js"))) {
  console.error("✗ dist/server/index.js missing — run `vite build` first.");
  process.exit(1);
}

console.log("→ Starting SSR worker on port", PORT);

const wrangler = spawn(
  "bunx",
  ["wrangler", "dev", "--port", String(PORT), "--local", "--log-level", "warn"],
  { cwd: resolve(ROOT, "dist/server"), stdio: ["ignore", "pipe", "pipe"] },
);

let stderr = "";
wrangler.stderr.on("data", (d) => (stderr += d.toString()));

async function waitReady(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(HOST + "/");
      if (res.ok || res.status === 404) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Worker did not become ready in time. stderr:\n" + stderr);
}

function rewriteHtml(html: string): string {
  // Make absolute asset URLs relative so Capacitor's webview can load them.
  return html
    .replace(/(src|href)="\/assets\//g, '$1="./assets/')
    .replace(/(src|href)="\/(?!\/)/g, '$1="./');
}

try {
  await waitReady();
  console.log("✓ Worker ready, prerendering routes…");

  for (const route of ROUTES) {
    const res = await fetch(HOST + route);
    if (!res.ok) {
      console.warn(`  ✗ ${route} → ${res.status}`);
      continue;
    }
    const html = rewriteHtml(await res.text());
    const target =
      route === "/"
        ? resolve(CLIENT_DIR, "index.html")
        : resolve(CLIENT_DIR, route.replace(/^\//, "") + ".html");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, html);
    console.log(`  ✓ ${route} → ${target.replace(ROOT + "/", "")}`);
  }

  console.log("\n✓ iOS prerender complete. dist/client is ready for Capacitor.");
} finally {
  wrangler.kill("SIGTERM");
}
