import test from "node:test";
import assert from "node:assert/strict";
import { adaptPlace, osmRef, loadQueue } from "../src/reviewer/data.js";
test("normalizes OSM types without guessing arbitrary IDs", () => {
  assert.equal(osmRef("n", "123"), "node/123");
  assert.equal(osmRef("way", "7"), "way/7");
  assert.equal(osmRef("relation", "9"), "relation/9");
  assert.equal(osmRef("x", "123"), null);
  assert.equal(osmRef("n", "-1"), null);
});
test("UGP origin remains distinct from GERS presence", () => {
  const p = adaptPlace({
    fid: "place",
    loc: [8, 47],
    created_source: "user",
    overture_id: "gers",
    images: [{ oid: "photo", username: "mapper" }],
  });
  assert.equal(p.origin, "user");
  assert.equal(p.gers, "gers");
  assert.equal(p.photos[0].author, "@mapper");
});
test("unknown photo bearing stays unknown and camera GPS is retained", () => {
  const p = adaptPlace({
    fid: "place",
    geom: { x: 8, y: 47 },
    images: [{ oid: "photo", photo_longitude: 8.1, photo_latitude: 47.1 }],
  });
  assert.equal(p.photos[0].direction, undefined);
  assert.deepEqual(p.photos[0].coordinates, [8.1, 47.1]);
});
test("invalid coordinates are rejected", () =>
  assert.equal(adaptPlace({ fid: "place", loc: [NaN, 47] }), null));

test("overlay queue is bounded, deduplicated and limited to two concurrent requests", async () => {
  const original = globalThis.fetch;
  let active = 0,
    max = 0,
    count = 0;
  globalThis.fetch = async (url) => {
    count++;
    active++;
    max = Math.max(max, active);
    await new Promise((r) => setTimeout(r, 2));
    active--;
    assert.match(url, /^\/api\/fotoshi\/overlay\/tiles\/15\/\d+\/\d+$/);
    return Response.json({
      places: [
        {
          fid: "p",
          loc: [8.55, 47.05],
          osm_type: "n",
          osm_id: "1",
          preview: { oid: "photo" },
        },
      ],
    });
  };
  try {
    const rows = await loadQueue("goldau", "linked");
    assert.equal(rows.length, 1);
    assert.equal(count, 9);
    assert.equal(max, 2);
  } finally {
    globalThis.fetch = original;
  }
});
