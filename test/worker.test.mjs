import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.mjs";
test("redirects the root to a slash while retaining deep-link parameters", async () => {
  const r = await worker.fetch(
    new Request("https://osm.fotoshi.com/fotoshi2osm?fid=test"),
  );
  assert.equal(r.status, 302);
  assert.equal(
    r.headers.get("location"),
    "https://osm.fotoshi.com/fotoshi2osm/?fid=test",
  );
});
test("rejects writes and unknown API requests", async () => {
  assert.equal(
    (
      await worker.fetch(
        new Request("https://osm.fotoshi.com/fotoshi2osm/api/places", {
          method: "POST",
        }),
      )
    ).status,
    405,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("https://osm.fotoshi.com/fotoshi2osm/api/places"),
      )
    ).status,
    404,
  );
});
test("cannot turn an asset path into an arbitrary-host proxy", async () => {
  const original = globalThis.fetch;
  let target;
  globalThis.fetch = async (u) => {
    target = new URL(u);
    return new Response("asset");
  };
  try {
    await worker.fetch(
      new Request("https://osm.fotoshi.com/fotoshi2osm//evil.example/x"),
    );
    assert.equal(target.hostname, "fotoshi2osm.pages.dev");
  } finally {
    globalThis.fetch = original;
  }
});
