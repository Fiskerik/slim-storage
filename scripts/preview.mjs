import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import serverBuild from "../dist/server/index.js";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";
const clientDir = resolve("dist/client");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function toAssetPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const safePath = normalize(decodedPath).replace(/^([/\\])+/, "");
  const filePath = resolve(join(clientDir, safePath));

  if (filePath !== clientDir && !filePath.startsWith(`${clientDir}${sep}`)) {
    return null;
  }

  return filePath;
}

async function sendStaticAsset(requestUrl, response) {
  const filePath = toAssetPath(requestUrl);

  if (!filePath || !existsSync(filePath)) {
    return false;
  }

  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) {
    return false;
  }

  response.writeHead(200, {
    "content-length": fileStats.size,
    "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
  return true;
}

async function sendSsrResponse(request, response) {
  const webRequest = new Request(`http://${request.headers.host}${request.url}`, {
    body:
      request.method === "GET" || request.method === "HEAD" ? undefined : Readable.toWeb(request),
    headers: request.headers,
    method: request.method,
  });
  const webResponse = await serverBuild.fetch(webRequest);

  response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
  if (webResponse.body) {
    Readable.fromWeb(webResponse.body).pipe(response);
    return;
  }

  response.end();
}

const server = createServer(async (request, response) => {
  console.log(`[preview] ${request.method} ${request.url}`);

  try {
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      (await sendStaticAsset(request.url ?? "/", response))
    ) {
      return;
    }

    await sendSsrResponse(request, response);
  } catch (error) {
    console.error("[preview] Request failed:", error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("500 Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`[preview] Slim preview running at http://${host}:${port}/`);
});
