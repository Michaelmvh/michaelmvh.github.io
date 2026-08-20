import { execFile } from "node:child_process";
import { watch } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { injectLiveReload, liveReloadPath } from "./live-reload.ts";
import { output, root, source } from "./site.ts";

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

const liveReloadEnabled = process.env.LIVE_RELOAD !== "false";
const reloadClients = new Set<http.ServerResponse>();
let activeBuild: Promise<void> | undefined;

await build();

const server = http.createServer(async (request, response) => {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch (error: unknown) {
    if (!(error instanceof URIError)) throw error;
    response.writeHead(400).end("Bad request");
    return;
  }

  if (liveReloadEnabled && pathname === liveReloadPath) {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    });
    response.write(": connected\n\n");
    reloadClients.add(response);
    response.on("close", () => reloadClients.delete(response));
    return;
  }

  await waitForBuild();
  const requestedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const filePath = path.resolve(output, `.${requestedPath}`);

  if (!filePath.startsWith(`${output}${path.sep}`)) {
    response.writeHead(400).end("Bad request");
    return;
  }

  try {
    const content = await readBuiltFile(filePath);
    const body =
      liveReloadEnabled && path.extname(filePath) === ".html"
        ? injectLiveReload(content.toString("utf8"))
        : content;
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "EISDIR") throw error;
    try {
      const notFound = await readBuiltFile(path.join(output, "404.html"));
      const body = liveReloadEnabled ? injectLiveReload(notFound.toString("utf8")) : notFound;
      response.writeHead(404, { "Content-Type": mimeTypes[".html"] });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (notFoundError: unknown) {
      const notFoundCode = (notFoundError as NodeJS.ErrnoException).code;
      if (notFoundCode !== "ENOENT") throw notFoundError;
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : "Preview rebuild in progress");
    }
  }
});

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview: http://127.0.0.1:${port}`);
});

let rebuildTimer: NodeJS.Timeout | undefined;
let buildQueued = false;

const sourceWatcher = liveReloadEnabled
  ? watch(source, { recursive: true }, (_event, filename) => {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => {
        console.log(`Source changed${filename ? `: ${filename}` : ""}`);
        void rebuild();
      }, 100);
    })
  : undefined;

server.on("close", () => sourceWatcher?.close());

async function rebuild(): Promise<void> {
  if (activeBuild) {
    buildQueued = true;
    return;
  }

  const buildAttempt = build();
  activeBuild = buildAttempt;
  try {
    await buildAttempt;
    for (const client of reloadClients) client.write(`event: reload\ndata: ${Date.now()}\n\n`);
  } catch (error: unknown) {
    const executionError = error as Error & { stderr?: string };
    console.error(executionError.stderr?.trim() || executionError.message);
  } finally {
    if (activeBuild === buildAttempt) activeBuild = undefined;
    if (buildQueued) {
      buildQueued = false;
      void rebuild();
    }
  }
}

async function waitForBuild(): Promise<void> {
  await activeBuild?.catch(() => undefined);
}

async function readBuiltFile(filePath: string): Promise<Buffer> {
  try {
    return await fs.readFile(filePath);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if ((code !== "ENOENT" && code !== "EISDIR") || !activeBuild) throw error;
    await waitForBuild();
    return fs.readFile(filePath);
  }
}

async function build(): Promise<void> {
  const { stdout } = await promisify(execFile)(process.execPath, [path.join(root, "scripts", "build.ts")], {
    cwd: root,
  });
  if (stdout.trim()) console.log(stdout.trim());
}
