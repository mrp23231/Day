import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const ORIGIN = "https://day.example";
const immutableHeaders = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "Content-Type": "application/javascript",
  Date: new Date().toUTCString(),
};

// Node has no ServiceWorkerGlobalScope or CacheStorage. Run the actual public
// worker with in-memory browser storage and real Request/Response bodies.
function basicResponse(body: string, init: ResponseInit = {}): Response {
  const decorate = (response: Response): Response => {
    Object.defineProperty(response, "type", { value: "basic" });
    const clone = response.clone.bind(response);
    response.clone = () => decorate(clone());
    return response;
  };
  return decorate(new Response(body, init));
}

function request(path: string, init: RequestInit = {}, navigate = false) {
  const value = new Request(new URL(path, ORIGIN), init);
  if (navigate) Object.defineProperty(value, "mode", { value: "navigate" });
  return value;
}

function worker(network: (request: Request) => Promise<Response>) {
  const listeners = new Map<string, (event: unknown) => void>();
  const storage = new Map<string, Map<string, Response>>();
  let cacheUnavailable = false;
  const key = (value: RequestInfo | URL) =>
    new URL(value instanceof Request ? value.url : String(value), ORIGIN).href;
  const fetch = (value: RequestInfo | URL, init?: RequestInit) =>
    network(value instanceof Request ? value : new Request(new URL(String(value), ORIGIN), init));
  const caches = {
    async open(name: string) {
      if (cacheUnavailable) throw new Error("storage unavailable");
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name)!;
      return {
        async match(value: RequestInfo | URL) { return entries.get(key(value))?.clone(); },
        async put(value: RequestInfo | URL, response: Response) { entries.set(key(value), response.clone()); },
        async delete(value: RequestInfo | URL) { return entries.delete(key(value)); },
        async keys() { return [...entries.keys()].map(url => new Request(url)); },
        async addAll(paths: string[]) {
          for (const path of paths) {
            const response = await fetch(path);
            if (!response.ok) throw new Error("precache failed");
            entries.set(key(path), response.clone());
          }
        },
      };
    },
    async keys() { return [...storage.keys()]; },
    async delete(name: string) { return storage.delete(name); },
    async match(value: RequestInfo | URL) {
      if (cacheUnavailable) throw new Error("storage unavailable");
      for (const entries of storage.values()) {
        const response = entries.get(key(value));
        if (response) return response.clone();
      }
    },
  };
  vm.runInNewContext(readFileSync(resolve("public/sw.js"), "utf8"), {
    self: {
      location: new URL(ORIGIN),
      addEventListener: (type: string, handler: (event: unknown) => void) => listeners.set(type, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches, fetch, URL, Request, Response, Headers,
  });
  return {
    storage,
    disableCache() { cacheUnavailable = true; },
    async lifecycle(type: "install" | "activate") {
      const pending: Promise<unknown>[] = [];
      listeners.get(type)!({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
      await Promise.all(pending);
    },
    async fetch(value: Request) {
      let result: Promise<Response> | undefined;
      const pending: Promise<unknown>[] = [];
      listeners.get("fetch")!({
        request: value,
        respondWith: (promise: Promise<Response>) => { result = promise; },
        waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      });
      const response = result ? await result : undefined;
      if (result && !(response instanceof Response)) throw new Error("respondWith must resolve to a Response");
      await Promise.all(pending);
      return response;
    },
  };
}

function cachedBodies(scope: ReturnType<typeof worker>) {
  return [...scope.storage.values()].flatMap(cache => [...cache.keys()]);
}

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

describe("production service worker", () => {
  it("does not retain mutable development chunks after the server changes", async () => {
    let version = "first dev bundle";
    const scope = worker(async () => basicResponse(version, {
      headers: { "Cache-Control": "no-store, must-revalidate", "Content-Type": "application/javascript" },
    }));
    const asset = request("/_next/static/chunks/app/layout.js");
    expect(await (await scope.fetch(asset))!.text()).toBe("first dev bundle");
    version = "updated dev bundle";
    expect(await (await scope.fetch(asset))!.text()).toBe("updated dev bundle");
    expect(cachedBodies(scope)).toEqual([]);
  });

  it("does not resurrect chunks stored by the previous worker", async () => {
    const scope = worker(async () => basicResponse("current", { headers: immutableHeaders }));
    scope.storage.set("day-shell-v3", new Map([
      [`${ORIGIN}/_next/static/chunks/app/layout.js`, basicResponse("old dev bundle")],
    ]));
    expect(await (await scope.fetch(request("/_next/static/chunks/app/layout.js")))!.text()).toBe("current");
  });

  it("removes obsolete Day caches without deleting unrelated application storage", async () => {
    const scope = worker(offline);
    scope.storage.set("day-shell-v3", new Map());
    scope.storage.set("other-app", new Map());
    await scope.lifecycle("activate");
    expect(scope.storage.has("day-shell-v3")).toBe(false);
    expect(scope.storage.has("other-app")).toBe(true);
  });

  it("serves previously fetched public immutable assets offline", async () => {
    let connected = true;
    const scope = worker(async () => connected
      ? basicResponse("hashed bundle", { headers: immutableHeaders }) : offline());
    const asset = request("/_next/static/chunks/abc123.js");
    expect(await (await scope.fetch(asset))!.text()).toBe("hashed bundle");
    connected = false;
    expect(await (await scope.fetch(asset))!.text()).toBe("hashed bundle");
  });

  it.each([
    "no-store", "private, max-age=3600, immutable", "public, no-cache, immutable, max-age=3600",
    "public, max-age=0, immutable", "public, max-age=31536000", "max-age=31536000, immutable",
  ])("does not cache assets with unsafe Cache-Control: %s", async cacheControl => {
    const scope = worker(async () => basicResponse("asset", {
      headers: { ...immutableHeaders, "Cache-Control": cacheControl },
    }));
    await scope.fetch(request("/_next/static/chunks/abc123.js"));
    expect(cachedBodies(scope)).toEqual([]);
  });

  it("ignores an expired cached asset and fetches its current response", async () => {
    let version = "old";
    const scope = worker(async () => basicResponse(version, { headers: immutableHeaders }));
    const asset = request("/_next/static/chunks/abc123.js");
    await scope.fetch(asset);
    for (const cache of scope.storage.values()) {
      cache.set(asset.url, basicResponse("old", {
        headers: { ...immutableHeaders, Date: "Mon, 01 Jan 2001 00:00:00 GMT" },
      }));
    }
    version = "current";
    expect(await (await scope.fetch(asset))!.text()).toBe("current");
  });

  it.each([
    "/api/state", "/api", "/auth/callback?code=secret", "/auth",
    "/settings?recovery", "/?code=secret", "https://other.example/_next/static/chunks/a.js",
  ])("leaves sensitive or cross-origin requests to the browser: %s", async path => {
    const scope = worker(async () => { throw new Error("worker must not handle this request"); });
    expect(await scope.fetch(request(path, {}, true))).toBeUndefined();
    expect(cachedBodies(scope)).toEqual([]);
  });

  it.each([
    request("/_next/static/chunks/a.js", { headers: { RSC: "1" } }),
    request("/_next/static/chunks/a.js", { headers: { Authorization: "Bearer secret" } }),
    request("/_next/static/chunks/a.js", { cache: "no-store" }),
    request("/_next/static/chunks/a.js", { method: "POST" }),
  ])("does not intercept RSC, authenticated, no-store or mutating requests", async value => {
    const scope = worker(async () => { throw new Error("worker must not handle this request"); });
    expect(await scope.fetch(value)).toBeUndefined();
  });

  it("never caches personal page HTML or RSC bodies", async () => {
    const scope = worker(async () => basicResponse("personal data", {
      headers: { "Cache-Control": "public, max-age=31536000, immutable", "Content-Type": "text/html" },
    }));
    await scope.fetch(request("/settings", {}, true));
    expect(await scope.fetch(request("/planner?_rsc=abc"))).toBeUndefined();
    await scope.fetch(request("/_next/static/chunks/broken.js"));
    expect(cachedBodies(scope)).toEqual([]);
  });

  it("returns the public offline document only when navigation fails on the network", async () => {
    let connected = true;
    const scope = worker(async value => {
      if (!connected) return offline();
      return basicResponse(value.url.endsWith(".html") ? "public offline page" : "public icon", {
        headers: { "Cache-Control": "public, max-age=0", "Content-Type": value.url.endsWith(".html") ? "text/html" : "image/png" },
      });
    });
    await scope.lifecycle("install");
    expect(cachedBodies(scope).map(url => new URL(url).pathname).sort()).toEqual([
      "/icon-192.png", "/icon-512.png", "/offline.html",
    ]);
    connected = false;
    expect(await (await scope.fetch(request("/planner", {}, true)))!.text()).toBe("public offline page");
  });

  it("preserves server error responses instead of displaying the offline fallback", async () => {
    const scope = worker(async () => basicResponse("server unavailable", { status: 503 }));
    const result = await scope.fetch(request("/planner", {}, true));
    expect(result!.status).toBe(503);
    expect(await result!.text()).toBe("server unavailable");
    expect(cachedBodies(scope)).toEqual([]);
  });

  it.each(["/_next/static/development/_buildManifest.js", "/_next/static/webpack/a.hot-update.js"])("bypasses known mutable development URLs: %s", async path => {
    const scope = worker(async () => basicResponse("dev", { headers: immutableHeaders }));
    expect(await scope.fetch(request(path))).toBeUndefined();
    expect(cachedBodies(scope)).toEqual([]);
  });

  it.each([
    { status: 404, headers: immutableHeaders },
    { headers: { ...immutableHeaders, "Content-Type": "text/x-component" } },
    { headers: { ...immutableHeaders, Vary: "*" } },
  ])("does not save failed or non-public asset responses", async init => {
    const scope = worker(async () => basicResponse("not a public asset", init));
    await scope.fetch(request("/_next/static/chunks/broken.js"));
    expect(cachedBodies(scope)).toEqual([]);
  });

  it("does not cache redirects masquerading as an asset", async () => {
    const scope = worker(async () => {
      const response = basicResponse("login", { headers: immutableHeaders });
      Object.defineProperty(response, "redirected", { value: true });
      return response;
    });
    await scope.fetch(request("/_next/static/chunks/redirect.js"));
    expect(cachedBodies(scope)).toEqual([]);
  });

  it("keeps public shell resources fresh while online", async () => {
    let body = "old icon";
    const scope = worker(async () => basicResponse(body, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=0" },
    }));
    await scope.fetch(request("/icon-192.png"));
    body = "new icon";
    expect(await (await scope.fetch(request("/icon-192.png")))!.text()).toBe("new icon");
  });

  it("does not precache shell resources with private or no-store responses", async () => {
    const scope = worker(async () => basicResponse("private response", {
      headers: { "Cache-Control": "no-store, private", "Content-Type": "text/html" },
    }));
    await scope.lifecycle("install");
    expect(cachedBodies(scope)).toEqual([]);
  });

  it("bounds cached assets without evicting the public offline document", async () => {
    const scope = worker(async value => basicResponse(value.url, {
      headers: value.url.includes("/_next/") ? immutableHeaders : {
        "Cache-Control": "public, max-age=0", "Content-Type": value.url.endsWith(".html") ? "text/html" : "image/png",
      },
    }));
    await scope.lifecycle("install");
    for (let index = 0; index < 100; index++) {
      await scope.fetch(request(`/_next/static/chunks/${index}.js`));
    }
    const urls = cachedBodies(scope);
    expect(urls).toContain(`${ORIGIN}/offline.html`);
    expect(urls.length).toBeLessThan(100);
    expect(urls).toContain(`${ORIGIN}/_next/static/chunks/99.js`);
  });

  it("returns a deterministic unavailable response when a failed asset has no cached copy", async () => {
    const scope = worker(offline);
    const result = await scope.fetch(request("/_next/static/chunks/missing.js"));
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(503);
    expect(result!.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns an unavailable response when the offline document is missing", async () => {
    const scope = worker(offline);
    const result = await scope.fetch(request("/planner", {}, true));
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(503);
  });

  it("still returns a successful network response when browser cache storage is unavailable", async () => {
    const scope = worker(async () => basicResponse("network asset", { headers: immutableHeaders }));
    scope.disableCache();
    const result = await scope.fetch(request("/_next/static/chunks/abc123.js"));
    expect(await result!.text()).toBe("network asset");
  });
});
