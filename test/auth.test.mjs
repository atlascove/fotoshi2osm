import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { login, getToken, logout } from "../src/reviewer/auth.js";
test("PKCE popup validates callback state and keeps tokens separate from iD", async () => {
  const dom = new JSDOM("", { url: "https://osm.fotoshi.com/fotoshi2osm/" });
  const originals = {
    window: globalThis.window,
    location: globalThis.location,
    sessionStorage: globalThis.sessionStorage,
    BroadcastChannel: globalThis.BroadcastChannel,
    fetch: globalThis.fetch,
  };
  let channel,
    authorize,
    tokenCalls = 0,
    verifier;
  const popup = {
    closed: false,
    close() {
      this.closed = true;
    },
    location: {},
  };
  Object.defineProperty(popup.location, "href", {
    set(value) {
      authorize = new URL(value);
      queueMicrotask(() => {
        channel.onmessage({
          data:
            "https://evil.example/land.html?code=bad&state=" +
            authorize.searchParams.get("state"),
        });
        channel.onmessage({
          data: "https://osm.fotoshi.com/land.html?code=bad&state=wrong",
        });
        channel.onmessage({
          data:
            "https://osm.fotoshi.com/land.html?code=valid&state=" +
            authorize.searchParams.get("state"),
        });
      });
    },
  });
  globalThis.window = { open: () => popup };
  globalThis.location = dom.window.location;
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.BroadcastChannel = class {
    constructor() {
      channel = this;
    }
    close() {}
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/oauth2/token")) {
      tokenCalls++;
      assert.equal(options.body.get("code"), "valid");
      verifier = options.body.get("code_verifier");
      assert.equal(
        options.body.get("redirect_uri"),
        "https://osm.fotoshi.com/land.html",
      );
      return Response.json({ access_token: "reviewer-fixture" });
    }
    return Response.json({ user: { id: 1, display_name: "Fixture mapper" } });
  };
  try {
    const user = await login();
    assert.equal(user.display_name, "Fixture mapper");
    assert.equal(tokenCalls, 1);
    assert.equal(authorize.searchParams.get("scope"), "read_prefs write_api");
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    const hash = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ).toString("base64url");
    assert.equal(hash, authorize.searchParams.get("code_challenge"));
    assert.equal(getToken(), "reviewer-fixture");
    assert.equal(
      sessionStorage.getItem(
        "https://www.openstreetmap.orgoauth2_access_token",
      ),
      null,
    );
    logout();
    assert.equal(getToken(), "");
    assert.equal(popup.closed, true);
  } finally {
    Object.assign(globalThis, originals);
    dom.window.close();
  }
});
