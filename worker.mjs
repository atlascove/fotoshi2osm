// Dedicated path only: the existing iD editor and OAuth callback stay untouched.
const ROOT = "/fotoshi2osm";
export default {
  async fetch(request) {
    const u = new URL(request.url);
    if (u.pathname === ROOT)
      return Response.redirect(u.origin + ROOT + "/" + u.search, 302);
    if (!u.pathname.startsWith(ROOT + "/"))
      return new Response("Not found", { status: 404 });
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Method not allowed", { status: 405 });
    const path = u.pathname.slice(ROOT.length);
    if (path.startsWith("/api/"))
      return new Response("Not found", { status: 404 });
    const target = new URL("https://fotoshi2osm.pages.dev");
    target.pathname = path;
    target.search = u.search;
    const r = await fetch(target, { method: request.method });
    const headers = new Headers(r.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set(
      "cache-control",
      path === "/" || path.endsWith(".html")
        ? "no-store"
        : "public, max-age=300",
    );
    return new Response(request.method === "HEAD" ? null : r.body, {
      status: r.status,
      headers,
    });
  },
};
