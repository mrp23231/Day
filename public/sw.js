const CACHE = "day-shell-v4";
const SHELL = ["/offline.html", "/icon-192.png", "/icon-512.png"];
const MAX_ASSETS = 80;

function directives(response) {
  return (response.headers.get("Cache-Control") || "").toLowerCase().split(",").map(value => value.trim());
}

function safeResponse(response) {
  return response && response.ok && response.type === "basic" && !response.redirected &&
    !directives(response).some(value => /^(no-store|private|no-cache)(?:\s*=|$)/.test(value)) &&
    !(response.headers.get("Vary") || "").split(",").some(value => /^(\*|cookie|authorization)$/i.test(value.trim()));
}

function cacheable(response, url, shell) {
  if (!safeResponse(response)) return false;
  const type = (response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (shell) return type === (url.pathname === "/offline.html" ? "text/html" : "image/png");
  if (!/^(text\/(css|javascript)|application\/(javascript|x-javascript|wasm|octet-stream|vnd\.ms-fontobject)|image\/[^\s]+|font\/[^\s]+)$/.test(type)) return false;
  const control = directives(response);
  const maxAge = control.map(value => /^max-age\s*=\s*"?(\d+)"?$/.exec(value)).filter(Boolean);
  if (!control.includes("public") || !control.includes("immutable") || maxAge.length !== 1) return false;
  const lifetime = Number(maxAge[0][1]) * 1000;
  const date = Date.parse(response.headers.get("Date") || "");
  const age = Number(response.headers.get("Age") || 0) * 1000;
  // CacheStorage does not implement HTTP freshness rules. Check them explicitly,
  // including on reads, so mutable/expired responses can never become permanent.
  return lifetime > 0 && Number.isFinite(date) && Number.isFinite(age) && age >= 0 &&
    Math.max(0, Date.now() - date) + age < lifetime;
}

async function readCached(request, shell) {
  try {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cacheable(cached, new URL(request.url), shell)) return cached;
    if (cached) await cache.delete(request);
  } catch {
    // Storage can be unavailable in private browsing or after quota eviction.
  }
}

async function store(request, response, shell) {
  if (!cacheable(response, new URL(request.url), shell)) return;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
    if (!shell) {
      const assets = (await cache.keys()).filter(key => !SHELL.includes(new URL(key.url).pathname));
      await Promise.all(assets.slice(0, Math.max(0, assets.length - MAX_ASSETS)).map(key => cache.delete(key)));
    }
  } catch {
    // A failed cache write must not turn a successful network fetch into an error.
  }
}

function unavailable() {
  return new Response("Нет подключения", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

self.addEventListener("install", event => {
  event.waitUntil(Promise.all(SHELL.map(async path => {
    const request = new Request(new URL(path, self.location.origin), { cache: "reload", credentials: "omit" });
    try {
      await store(request, await fetch(request), true);
    } catch {
      // The worker can still serve a deterministic fallback if precaching fails.
    }
  })).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("day-shell-") && key !== CACHE).map(key => caches.delete(key)));
    } catch {
      // Claim clients even when browser storage is disabled.
    }
    await self.clients.claim();
  })());
});

async function navigate(request) {
  try {
    // Never store account pages, redirects, server errors, or navigation HTML.
    return await fetch(request);
  } catch {
    return await readCached(new Request(new URL("/offline.html", self.location.origin)), true) || unavailable();
  }
}

async function asset(request, shell) {
  // Public icons/offline.html can change at the same URL; refresh them online.
  if (!shell && request.cache !== "reload" && request.cache !== "no-cache") {
    const cached = await readCached(request, false);
    if (cached) return cached;
  }
  try {
    const response = await fetch(request);
    await store(request, response, shell);
    return response;
  } catch {
    return (shell && await readCached(request, true)) || unavailable();
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
    /^\/(api|auth)(\/|$)/.test(url.pathname) ||
    ["recovery", "code", "token", "token_hash", "access_token", "refresh_token"].some(key => url.searchParams.has(key)) ||
    request.cache === "no-store" || request.headers.has("Authorization") ||
    request.headers.has("RSC") || request.headers.has("Next-Router-State-Tree") || request.headers.has("Range")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }
  const shell = SHELL.includes(url.pathname) && !url.search;
  const staticAsset = url.pathname.startsWith("/_next/static/") && !url.search &&
    !/^\/_next\/static\/(development|webpack)\//.test(url.pathname) && !url.pathname.includes(".hot-update.");
  if (shell || staticAsset) event.respondWith(asset(request, shell));
});
