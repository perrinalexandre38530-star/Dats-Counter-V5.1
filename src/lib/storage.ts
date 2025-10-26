// ============================================
// src/lib/storage.ts — IndexedDB + compression
// Remplace totalement l'ancienne version localStorage
// API exportée : loadStore(), saveStore(), clearStore()
// ============================================
import type { Store } from "./types";

/* ---------- Constantes ---------- */
const DB_NAME = "darts-counter-v5";
const STORE_NAME = "kv";
const STORE_KEY = "store";
const LEGACY_LS_KEY = "darts-counter-store-v3";

/* ---------- Outils compression (gzip quand dispo) ---------- */
const hasCompression =
  typeof (window as any).CompressionStream !== "undefined" &&
  typeof (window as any).DecompressionStream !== "undefined";

async function compress(data: string): Promise<Uint8Array | string> {
  if (!hasCompression) return data; // fallback: on stocke la string
  const cs = new (window as any).CompressionStream("gzip");
  const writer = new Blob([data]).stream().pipeThrough(cs);
  const buf = await new Response(writer).arrayBuffer();
  return new Uint8Array(buf);
}

async function decompress(payload: ArrayBuffer | Uint8Array | string): Promise<string> {
  if (typeof payload === "string") return payload;
  if (!hasCompression) {
    // Si pas de compression mais on a un binaire, on tente de le lire comme texte
    return new TextDecoder().decode(payload as ArrayBufferLike);
  }
  const ds = new (window as any).DecompressionStream("gzip");
  const stream = new Blob([payload as ArrayBuffer]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}

/* ---------- Mini-wrapper IndexedDB (sans lib externe) ---------- */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T = unknown>(key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: IDBValidKey, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDel(key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ---------- API publique ---------- */

/** Charge le store depuis IndexedDB (et migre depuis localStorage si présent). */
export async function loadStore<T extends Store>(): Promise<T | null> {
  try {
    // 1) Essaye IndexedDB
    const raw = (await idbGet<ArrayBuffer | Uint8Array | string>(STORE_KEY)) ?? null;
    if (raw != null) {
      const json = await decompress(raw as any);
      return JSON.parse(json) as T;
    }

    // 2) Migration depuis localStorage (legacy)
    const legacy = localStorage.getItem(LEGACY_LS_KEY);
    if (legacy) {
      // on tente de parser et d’écrire en IDB
      const parsed = JSON.parse(legacy) as T;
      await saveStore(parsed);
      // nettoyage legacy
      try { localStorage.removeItem(LEGACY_LS_KEY); } catch {}
      return parsed;
    }

    return null;
  } catch (err) {
    console.warn("[storage] loadStore error:", err);
    return null;
  }
}

/** Sauvegarde complète du store (écrase la valeur précédente). */
export async function saveStore<T extends Store>(store: T): Promise<void> {
  try {
    const json = JSON.stringify(store);
    const payload = await compress(json);
    await idbSet(STORE_KEY, payload);
  } catch (err) {
    console.error("[storage] saveStore error:", err);
    // En dernier recours, on tente quand même localStorage (petits stores)
    try {
      localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(store));
    } catch {}
  }
}

/** Vide la persistance (IDB + legacy localStorage). */
export async function clearStore(): Promise<void> {
  try { await idbDel(STORE_KEY); } catch {}
  try { localStorage.removeItem(LEGACY_LS_KEY); } catch {}
}
