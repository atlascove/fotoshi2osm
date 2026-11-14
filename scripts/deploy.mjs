// Use the same pinned Pages CLI workflow as the Fotoshi iD deployment.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const account = process.env.CLOUDFLARE_ACCOUNT_ID,
  token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token)
  throw Error(
    "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the deployment environment.",
  );
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, COMMIT_SHA: sha },
});
execFileSync(
  "npx",
  [
    "--yes",
    "wrangler@4.147.0",
    "pages",
    "deploy",
    "dist",
    "--project-name",
    "fotoshi2osm",
    "--branch",
    "main",
    "--commit-hash",
    sha,
  ],
  { stdio: "inherit" },
);
const api = async (path, init = {}) => {
  const r = await fetch("https://api.cloudflare.com/client/v4" + path, {
    ...init,
    headers: { Authorization: "Bearer " + token, ...init.headers },
  });
  const data = await r.json();
  if (!r.ok || !data.success)
    throw Error(
      `Cloudflare deployment failed (${r.status}): ${data.errors?.map((x) => x.message).join("; ")}`,
    );
  return data.result;
};
const form = new FormData();
form.append(
  "metadata",
  new Blob(
    [
      JSON.stringify({
        main_module: "worker.mjs",
        compatibility_date: "2026-11-14",
        bindings: [],
      }),
    ],
    { type: "application/json" },
  ),
);
form.append(
  "worker.mjs",
  new Blob([await readFile("worker.mjs", "utf8")], {
    type: "application/javascript+module",
  }),
  "worker.mjs",
);
await api(`/accounts/${account}/workers/scripts/fotoshi2osm-editor`, {
  method: "PUT",
  body: form,
});
const zones = await api("/zones?name=fotoshi.com");
if (zones.length !== 1) throw Error("Expected the Fotoshi zone.");
const path = `/zones/${zones[0].id}/workers/routes`,
  pattern = "osm.fotoshi.com/fotoshi2osm*";
const routes = await api(path),
  existing = routes.find((r) => r.pattern === pattern);
if (existing && existing.script !== "fotoshi2osm-editor")
  throw Error(
    "Reviewer route belongs to another worker; refusing to overwrite.",
  );
if (!existing)
  await api(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pattern, script: "fotoshi2osm-editor" }),
  });
console.log("Deployed: https://osm.fotoshi.com/fotoshi2osm/");
