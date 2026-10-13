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

// v2: limpia copias de /assets que en realidad eran index.html (ver assetOk).
const VERSION = "v2";
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

/**
 * Un archivo de /assets debe ser eso y no una página. Durante un deploy, una versión anterior del
 * Worker puede no tener el archivo nuevo y responder index.html con 200 (fallback de la SPA):
 * si se guardara, la app quedaría sin estilos o sin código hasta borrar los datos del sitio.
 */
const assetOk = (response) => cacheable(response) && !(response.headers.get("content-type") ?? "").includes("text/html");

/** Descarga index.html y los archivos que usa, y quita del caché los de versiones anteriores. */
// ---------------------------------------------------------------------------
// Notificaciones push (fase 13). El Worker manda el aviso cifrado; el navegador lo descifra y
// lo entrega aquí. Aunque la app esté cerrada, el aviso se muestra.
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Contenido inesperado: se muestra un aviso genérico.
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Nuestro Lugar";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url: safePath(data.url) },
      lang: "es",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(safePath(event.notification.data?.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus().catch(() => undefined);
        // navigate() solo funciona en pestañas que controla este service worker.
        const moved = "navigate" in open ? await open.navigate(url).catch(() => null) : null;
        if (moved) return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// El navegador cambió la suscripción (p. ej. al renovar sus claves): se avisa al Worker.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription?.options;
      const subscription = event.newSubscription ?? (options ? await self.registration.pushManager.subscribe(options) : null);
      if (!subscription) return;
      await fetch("/api/push/subscriptions", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      }).catch(() => undefined);
    })(),
  );
});

/** Solo rutas de la propia app ("/cartas/…"): un aviso nunca abre otro sitio. */
function safePath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

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
      if (assetOk(res)) await cache.put(asset, res);
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
  if (cached && assetOk(cached)) return cached;
  if (cached) await cache.delete(request);
  const response = await fetch(request);
  if (assetOk(response)) await cache.put(request, response.clone());
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
<title>Nuestro Lugar</title><body style="font-family:system-ui;background:#fff7f9;color:#4a3640;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><p style="font-size:48px;margin:0">♡</p><h1 style="font-size:22px">Sin conexión</h1><p>Abre Nuestro Lugar con Internet una vez para poder usarlo sin conexión.</p></div></body></html>`;
