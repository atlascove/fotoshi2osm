// Fotoshi is the only photo provider. Source origin and GERS identity are separate.
export const areas = {
  goldau: { name: "Goldau, Switzerland", center: [8.55, 47.05], delta: 0.025 },
  angra: {
    name: "Angra do Heroísmo, Portugal",
    center: [-27.219, 38.655],
    delta: 0.025,
  },
  songdo: {
    name: "Songdo, South Korea",
    center: [126.724, 37.494],
    delta: 0.025,
  },
};
export const missions = {
  linked: "Review existing OSM places",
  unlinked: "Explore unlinked places",
  all: "All photographed places",
};
export function osmRef(type, id) {
  const types = {
    n: "node",
    w: "way",
    r: "relation",
    node: "node",
    way: "way",
    relation: "relation",
  };
  return types[type] && /^[1-9]\d{0,15}$/.test(String(id))
    ? `${types[type]}/${id}`
    : null;
}
export function adaptPlace(row) {
  const images = row.images || (row.preview ? [row.preview] : []);
  const first = images[0] || {};
  const loc = row.loc || (row.geom && [row.geom.x, row.geom.y]);
  if (!row.fid || !loc?.every(Number.isFinite)) return null;
  const photos = images
    .map((p) => ({
      id: p.oid,
      pictureUrl:
        p.display_url?.replace("-2560.", "-1280.") ||
        `https://cdn.fotoshi.com/images/${p.oid}-1280.jpeg`,
      thumbUrl:
        p.thumbnail_url || `https://cdn.fotoshi.com/thumbnails/${p.oid}.jpeg`,
      detailsUrl: `https://fotoshi.com/photo/${p.oid}`,
      date: p.captured_at || p.capture_time || p.source_capture_time,
      author: p.username
        ? "@" + p.username
        : p.creator_name || "Fotoshi contributor",
      license: p.license || "",
      coordinates:
        p.loc ||
        (Number.isFinite(p.photo_longitude) && Number.isFinite(p.photo_latitude)
          ? [p.photo_longitude, p.photo_latitude]
          : loc),
      direction: p.compass_angle,
    }))
    .filter((p) => /^[\w-]{1,128}$/.test(p.id || ""));
  return {
    fid: row.fid,
    loc,
    name: row.name || row.category || "Photographed place",
    category: row.category || "",
    ref: osmRef(row.osm_type || first.osm_type, row.osm_id || first.osm_id),
    origin: row.created_source || "unknown",
    gers: row.overture_id || null,
    photos,
    overture: row.overture || null,
  };
}
async function get(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw Error(`Photo service unavailable (${r.status})`);
  return r.json();
}
export async function loadQueue(area, mission, signal) {
  const [lon, lat] = (areas[area] || areas.goldau).center;
  const z = 15,
    n = 2 ** z,
    rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n),
    y = Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n);
  // A bounded 3×3 neighbourhood; share iD's cache and two-request budget.
  const tiles = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) tiles.push([x + dx, y + dy]);
  const rows = new Map();
  let cursor = 0;
  const worker = async () => {
    while (cursor < tiles.length) {
      const [tx, ty] = tiles[cursor++];
      const data = await get(
        `/api/fotoshi/overlay/tiles/${z}/${tx}/${ty}`,
        signal,
      );
      if (!Array.isArray(data.places)) throw Error("Unexpected photo response");
      for (const row of data.places) rows.set(row.fid, row);
    }
  };
  await Promise.all([worker(), worker()]);
  const distance = (p) =>
    (p.loc[0] - lon) ** 2 * Math.cos(rad) ** 2 + (p.loc[1] - lat) ** 2;
  return [...rows.values()]
    .map(adaptPlace)
    .filter((p) => p && p.photos.length)
    .filter((p) => mission === "all" || (mission === "linked" ? p.ref : !p.ref))
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, 36);
}
export async function loadDetails(fid, signal) {
  if (!/^[\w-]{1,128}$/.test(fid)) throw Error("Invalid place ID");
  const data = await get(
    `/api/fotoshi/overlay/places/${fid}?include=overture_tags`,
    signal,
  );
  return adaptPlace(data.place);
}
