import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, type PluginOption } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeIndexHtmlPlugin(): PluginOption {
  return {
    name: "slim-normalize-index-html",
    writeBundle(options) {
      const outDir = String(options.dir || "");
      if (!outDir) return;
      const mobileIndex = path.join(outDir, "index.mobile.html");
      const index = path.join(outDir, "index.html");
      if (fs.existsSync(mobileIndex)) {
        fs.renameSync(mobileIndex, index);
      }
    },
  };
}

function slimNativeHeadPlugin(): PluginOption {
  const nativeBootstrap = [
    "window.__SLIM_NATIVE__ = true;",
    "window.__SLIM_BUNDLED_NATIVE__ = true;",
    "window.__SLIM_BRIDGE_VERSION__ = 2;",
  ].join(" ");

  return {
    name: "slim-native-head-bootstrap",
    transformIndexHtml(html) {
      if (html.includes("window.__SLIM_NATIVE__ = true")) {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            children: nativeBootstrap,
            injectTo: "head-prepend",
          },
        ],
      };
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    slimNativeHeadPlugin(),
    normalizeIndexHtmlPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["@tanstack/react-router", "@tanstack/react-start", "react", "react-dom"],
  },
  build: {
    outDir: "mobile/mobile/assets/www",
    emptyOutDir: true,
    copyPublicDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 1024 * 1024 * 32,
    manifest: false,
    ssrManifest: false,
    rollupOptions: {
      input: { index: path.resolve(__dirname, "index.mobile.html") },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
