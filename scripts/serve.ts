import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import "./build.ts";
import { output } from "./site.ts";

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch (error: unknown) {
    if (!(error instanceof URIError)) throw error;
    response.writeHead(400).end("Bad request");
    return;
  }
  const requestedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const filePath = path.resolve(output, `.${requestedPath}`);

  if (!filePath.startsWith(`${output}${path.sep}`)) {
    response.writeHead(400).end("Bad request");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "EISDIR") throw error;
    const notFound = await fs.readFile(path.join(output, "404.html"));
    response.writeHead(404, { "Content-Type": mimeTypes[".html"] });
    response.end(request.method === "HEAD" ? undefined : notFound);
  }
});

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview: http://127.0.0.1:${port}`);
});
