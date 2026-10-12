// Service worker de Nuestro Lugar: que la app abra y se vea sin conexión.
//
// Qué se guarda (caché controlado, todo con el prefijo "nl-" para borrarlo al cerrar sesión):
//   - La app (index.html + /assets con hash): se abre aunque no haya Internet.
//     index.html: primero la red (siempre la versión nueva) y, sin conexión, la última guardada.
//     /assets/*: el nombre cambia con cada versión, así que una vez guardado no se vuelve a pedir.
//   - Fotos de recuerdos y planes (/api/media/:id): no cambian nunca; máximo MAX_MEDIA fotos.
//   - Tipografías de Google Fonts.
// Qué NO se guarda aquí:
//   - El resto de /api: los datos van a IndexedDB desde la app (se borran al cerrar sesión).
//   - /api/capsules/*: el contenido de una cápsula nunca debe quedar en el dispositivo antes de tiempo.
//   - Nada que no sea una respuesta 200 propia (ni redirecciones al login de Cloudflare Access).

const VERSION = "v1";
const SHELL_CACHE = `nl-shell-${VERSION}`;
const MEDIA_CACHE = "nl-media";
const FONT_CACHE = "nl-fonts";
const KEEP = [SHELL_CACHE, MEDIA_CACHE, FONT_CACHE];
const SHELL_URL = "/";
const MAX_MEDIA = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Si la sesión de Access caducó, "/" redirige al login: no se guarda y se reintenta en la próxima visita.
      await refreshShell().catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("nl-") && !KEEP.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/cdn-cgi/")) {
    event.respondWith(navigation(request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  if (/^\/api\/media\/[0-9a-f-]{36}$/.test(url.pathname) && !request.headers.has("range")) {
    event.respondWith(media(request));
  }
  // Todo lo demás (API, cápsulas, /cdn-cgi/access): directo a la red, sin caché.
});

/** Respuesta propia y completa: ni redirecciones (login de Access), ni errores, ni respuestas parciales. */
const cacheable = (response) => response.ok && response.status === 200 && response.type === "basic" && !response.redirected;

/** Descarga index.html y los archivos que usa, y quita del caché los de versiones anteriores. */
async function refreshShell(response) {
  const shell = response ?? (await fetch(SHELL_URL, { credentials: "include", cache: "no-store" }));
  if (!cacheable(shell)) return;
  const html = await shell.clone().text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]))];

  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(
    assets.map(async (asset) => {
      if (await cache.match(asset)) return;
      const res = await fetch(asset, { credentials: "include" });
      if (cacheable(res)) await cache.put(asset, res);
    }),
  );
  await cache.put(SHELL_URL, shell);

  const current = new Set(assets.map((asset) => new URL(asset, self.location.origin).href));
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname.startsWith("/assets/") && !current.has(request.url)) await cache.delete(request);
  }
}

async function navigation(request) {
  try {
    const response = await fetch(request);
    // Todas las rutas devuelven el mismo index.html (SPA): se guarda una sola copia.
    if (cacheable(response) && (response.headers.get("content-type") ?? "").includes("text/html")) {
      const copy = response.clone();
      // Sin esperar: la página se muestra ya y el caché se actualiza por detrás.
      refreshShell(copy).catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    return cached ?? new Response(OFFLINE_PAGE, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(request, response.clone());
  return response;
}

async function media(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) {
    await cache.put(request, response.clone());
    // Las más antiguas se van primero (keys() respeta el orden en que se guardaron).
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_MEDIA))) await cache.delete(old);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? new Response("", { status: 504 });
}

const OFFLINE_PAGE = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nuestro Lugar</title><body style="font-family:system-ui;background:#fbf6f1;color:#3d2f35;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><p style="font-size:48px;margin:0">♡</p><h1 style="font-size:22px">Sin conexión</h1><p>Abre Nuestro Lugar con Internet una vez para poder usarlo sin conexión.</p></div></body></html>`;
