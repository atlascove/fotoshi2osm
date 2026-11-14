import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist");
const types = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/fotoshi/overlay/")) {
      const r = await fetch(
        "https://osm.fotoshi.com" + url.pathname + url.search,
      );
      res.writeHead(r.status, {
        "content-type": r.headers.get("content-type") || "application/json",
      });
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const name = decodeURIComponent(url.pathname).replace(
      /^\/fotoshi2osm\/?/,
      "/",
    );
    const file = resolve(root, "." + (name === "/" ? "/index.html" : name));
    if (!file.startsWith(root + "/")) throw Error();
    res.writeHead(200, {
      "content-type": types[extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(Number(process.env.PORT || 8095), "127.0.0.1", () =>
  console.log(
    "Fotoshi2OSM: http://localhost:" +
      (process.env.PORT || 8095) +
      "/fotoshi2osm/",
  ),
);
