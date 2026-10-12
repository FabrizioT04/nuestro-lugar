import { db } from "./db";

// Copia local de lo último que se vio, para poder mostrarlo sin conexión.

/** Tope de entradas: lo más antiguo se descarta. */
const MAX_ENTRIES = 400;
/** Cachés del service worker (ver public/sw.js). */
const SW_CACHE_PREFIX = "nl-";

export async function readCache<T>(key: string): Promise<{ value: T; savedAt: number } | null> {
  try {
    const entry = await db.cache.get(key);
    return entry ? { value: entry.value as T, savedAt: entry.savedAt } : null;
  } catch {
    // IndexedDB no disponible (modo privado antiguo, almacenamiento lleno…): seguir sin caché.
    return null;
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await db.cache.put({ key, value, savedAt: Date.now() });
    const total = await db.cache.count();
    if (total > MAX_ENTRIES) {
      const oldest = await db.cache.orderBy("savedAt").limit(total - MAX_ENTRIES).primaryKeys();
      await db.cache.bulkDelete(oldest);
    }
  } catch {
    // Sin caché la app sigue funcionando en línea.
  }
}

export async function removeCache(key: string): Promise<void> {
  await db.cache.delete(key).catch(() => undefined);
}

/** Borra todo lo guardado en este dispositivo: datos, cola pendiente, fotos y cachés del service worker. */
export async function clearOfflineData(): Promise<void> {
  await Promise.all([db.cache.clear(), db.outbox.clear(), db.photos.clear(), db.meta.clear()]).catch(() => undefined);
  if ("caches" in window) {
    const names = await caches.keys().catch(() => [] as string[]);
    await Promise.all(names.filter((name) => name.startsWith(SW_CACHE_PREFIX)).map((name) => caches.delete(name)));
  }
}

/**
 * Los datos guardados pertenecen a una persona. Si entra otra en el mismo navegador,
 * se borra todo lo anterior antes de guardar nada suyo.
 */
export async function bindOwner(userId: string): Promise<void> {
  try {
    const owner = await db.meta.get("owner");
    if (owner && owner.value !== userId) await clearOfflineData();
    if (owner?.value !== userId) await db.meta.put({ key: "owner", value: userId });
  } catch {
    // Sin IndexedDB no hay nada que proteger.
  }
}
