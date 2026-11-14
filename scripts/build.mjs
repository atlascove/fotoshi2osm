import { build } from "esbuild";
import { rm, mkdir, cp, readFile, writeFile } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await build({
  entryPoints: ["src/reviewer/main.jsx"],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: "dist/app.js",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".png": "file", ".svg": "file" },
  target: ["es2022"],
  legalComments: "linked",
});
await cp(
  "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  "dist/maplibre-worker.mjs",
);
await cp(
  "node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs",
  "dist/maplibre-gl-shared.mjs",
);
await cp("LICENSE", "dist/LICENSE");
await writeFile(
  "dist/version.json",
  JSON.stringify({
    name: "fotoshi2osm",
    version: JSON.parse(await readFile("package.json", "utf8")).version,
    commit: process.env.COMMIT_SHA || "local",
  }),
);
