/// <reference lib="webworker" />

export {};

type PrecacheEntry = string | {
  url: string;
  revision?: string;
};

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: PrecacheEntry[];
};

const CACHE_NAME = "acoes-controle-app-shell";
const COOP_HEADER = "Cross-Origin-Opener-Policy";
const COOP_VALUE = "same-origin-allow-popups";
const precacheUrls = [...new Set(self.__WB_MANIFEST.map((entry) =>
  new URL(typeof entry === "string" ? entry : entry.url, self.registration.scope).href
))];
const precacheUrlSet = new Set(precacheUrls);
const appShellUrl = new URL("index.html", self.registration.scope).href;

async function addCoopHeader(response: Response) {
  const headers = new Headers(response.headers);
  headers.set(COOP_HEADER, COOP_VALUE);
  headers.delete("content-encoding");
  headers.delete("content-length");

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function loadNavigation(request: Request) {
  try {
    return await addCoopHeader(await fetch(request));
  } catch {
    const cachedAppShell = await caches.match(appShellUrl, { cacheName: CACHE_NAME });
    if (!cachedAppShell) {
      return new Response("Aplicativo indisponível sem conexão.", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          [COOP_HEADER]: COOP_VALUE,
        },
      });
    }
    return addCoopHeader(cachedAppShell);
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(precacheUrls);
    const cachedRequests = await cache.keys();
    await Promise.all(cachedRequests
      .filter((request) => !precacheUrlSet.has(request.url))
      .map((request) => cache.delete(request)));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isAppNavigation = event.request.mode === "navigate"
    && requestUrl.href.startsWith(self.registration.scope);
  if (isAppNavigation) {
    event.respondWith(loadNavigation(event.request));
    return;
  }

  if (precacheUrlSet.has(requestUrl.href)) {
    event.respondWith(
      caches.match(event.request, { cacheName: CACHE_NAME })
        .then((cached) => cached ?? fetch(event.request)),
    );
  }
});
