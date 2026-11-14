import { build } from "esbuild";
import { rm, mkdir, cp, readFile, writeFile } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
const result = await build({
  entryPoints: { app: "src/reviewer/main.jsx" },
  entryNames: "[name]-[hash]",
  metafile: true,
  format: "esm",
  bundle: true,
  minify: true,
  sourcemap: true,
  outdir: "dist",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".png": "file", ".svg": "file" },
  target: ["es2022"],
  legalComments: "linked",
});
const outputs = Object.keys(result.metafile.outputs);
const js = outputs.find(
  (path) => path.endsWith(".js") && result.metafile.outputs[path].entryPoint,
);
const css = result.metafile.outputs[js].cssBundle;
const html = (await readFile("public/index.html", "utf8"))
  .replace("./app.js", "./" + js.slice(5))
  .replace("./app.css", "./" + css.slice(5));
await writeFile("dist/index.html", html);
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
