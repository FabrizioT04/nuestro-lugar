import Dexie, { type EntityTable } from "dexie";
import type { OutboxAction } from "./types";

// Base de datos local del dispositivo (IndexedDB). Solo guarda lo que el Worker ya entregó
// (nunca contenido bloqueado) y las acciones que esperan a tener conexión.

export interface CacheEntry {
  key: string;
  value: unknown;
  savedAt: number;
}

/** Foto preparada (comprimida, sin EXIF) que todavía no se pudo subir. */
export interface StoredPhoto {
  id: string;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

interface MetaEntry {
  key: string;
  value: string;
}

class OfflineDatabase extends Dexie {
  cache!: EntityTable<CacheEntry, "key">;
  outbox!: EntityTable<OutboxAction, "id">;
  photos!: EntityTable<StoredPhoto, "id">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor() {
    super("nuestro-lugar");
    this.version(1).stores({
      cache: "key, savedAt",
      outbox: "id, createdAt",
      photos: "id",
      meta: "key",
    });
  }
}

export const db = new OfflineDatabase();
