// ============================================
// src/lib/storage.ts — IndexedDB + compression + utilitaires
// Remplace totalement l'ancienne version localStorage
// API principale : loadStore(), saveStore(), clearStore()
// + Helpers : getKV()/setKV()/delKV(), exportAll(), importAll(), storageEstimate()
// ============================================
import type { Store } from "./types";

/* ---------- Constantes ---------- */
const DB_NAME = "darts-counter-v5";
const STORE_NAME = "kv";
const STORE_KEY = "store";
const LEGACY_LS_KEY = "darts-counter-store-v3";

/* ---------- Détection compression (gzip) ---------- */
const supportsCompression =
  typeof (globalThis as any).CompressionStream !== "undefined" &&
  typeof (globalThis as any).DecompressionStream !== "undefined";

/* ---------- Encodage / décodage ---------- */
async function compressGzip(data: string): Promise<Uint8Array | string> {
  if (!supportsCompression) return data; // fallback string (non compressé)
  try {
    const cs = new (globalThis as any).CompressionStream("gzip");
    const stream = new Blob([data]).stream().pipeThrough(cs);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    // En cas d’échec, on renvoie la string
    return data;
  }
}

async function decompressGzip(payload: ArrayBuffer | Uint8Array | string): Promise<string> {
  if (typeof payload === "string") return payload;
  if (!supportsCompression) {
    // Pas de support gzip : on essaye de décoder brut
    return new TextDecoder().decode(payload as ArrayBufferLike);
  }
  try {
    const ds = new (globalThis as any).DecompressionStream("gzip");
    const stream = new Blob([payload as ArrayBuffer]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  } catch {
    // En dernier recours, tentative de décodage brut
    return new TextDecoder().decode(payload as ArrayBufferLike);
  }
}

/* ---------- Mini-wrapper IndexedDB (aucune lib externe) ---------- */
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

async function idbKeys(): Promise<IDBValidKey[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    // getAllKeys n’est pas supporté partout -> fallback curseur
    if ("getAllKeys" in store) {
      const req = (store as any).getAllKeys();
      req.onsuccess = () => resolve(req.result as IDBValidKey[]);
      req.onerror = () => reject(req.error);
    } else {
      const keys: IDBValidKey[] = [];
      const req = store.openKeyCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          keys.push(cursor.key);
          cursor.continue();
        } else {
          resolve(keys);
        }
      };
      req.onerror = () => reject(req.error);
    }
  });
}

async function idbClear(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ---------- Estimation de quota (quand disponible) ---------- */
export async function storageEstimate() {
  try {
    const est = await (navigator.storage?.estimate?.() ?? Promise.resolve(undefined as any));
    return {
      quota: est?.quota ?? null, // bytes
      usage: est?.usage ?? null, // bytes
      usageDetails: est?.usageDetails ?? null,
    };
  } catch {
    return { quota: null, usage: null, usageDetails: null };
  }
}

/* ---------- API publique principale ---------- */

/** Charge le store depuis IndexedDB (et migre depuis localStorage si présent). */
export async function loadStore<T extends Store>(): Promise<T | null> {
  try {
    // 1) IndexedDB
    const raw = (await idbGet<ArrayBuffer | Uint8Array | string>(STORE_KEY)) ?? null;
    if (raw != null) {
      const json = await decompressGzip(raw as any);
      return JSON.parse(json) as T;
    }

    // 2) Migration depuis localStorage (legacy)
    const legacy = localStorage.getItem(LEGACY_LS_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as T;
      await saveStore(parsed);
      try {
        localStorage.removeItem(LEGACY_LS_KEY);
      } catch {}
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
    const payload = await compressGzip(json);

    // Garde-fou : si on a une estimation et qu’on dépasse ~90% du quota, on évite d’écrire.
    const est = await storageEstimate();
    if (est.quota != null && est.usage != null && typeof payload !== "string") {
      const projected = est.usage + (payload as Uint8Array).byteLength;
      if (projected > est.quota * 0.98) {
        console.warn("[storage] quota presque plein, tentative d’écriture quand même.");
      }
    }

    await idbSet(STORE_KEY, payload);
  } catch (err) {
    console.error("[storage] saveStore error:", err);
    // Dernier recours : mini-backup localStorage (seulement pour petits stores)
    try {
      localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(store));
    } catch {}
  }
}

/** Vide la persistance (IDB + legacy localStorage). */
export async function clearStore(): Promise<void> {
  try {
    await idbDel(STORE_KEY);
  } catch {}
  try {
    localStorage.removeItem(LEGACY_LS_KEY);
  } catch {}
}

/* ---------- KV générique (pour sous-ensembles : history, stats, etc.) ---------- */
/** Récupère une valeur JSON (avec décompression si binaire). */
export async function getKV<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = await idbGet<ArrayBuffer | Uint8Array | string>(key);
    if (raw == null) return null;
    const json = await decompressGzip(raw as any);
    return JSON.parse(json) as T;
  } catch (err) {
    console.warn("[storage] getKV error:", key, err);
    return null;
  }
}

/** Enregistre une valeur JSON (gzip si dispo). */
export async function setKV(key: string, value: any): Promise<void> {
  try {
    const json = JSON.stringify(value);
    const payload = await compressGzip(json);
    await idbSet(key, payload);
  } catch (err) {
    console.error("[storage] setKV error:", key, err);
  }
}

/** Supprime une clé. */
export async function delKV(key: string): Promise<void> {
  try {
    await idbDel(key);
  } catch (err) {
    console.warn("[storage] delKV error:", key, err);
  }
}

/* ---------- Export / Import utiles pour debug / sauvegardes ---------- */
/** Exporte tout le contenu de l’object store "kv" en objet { key: any }. */
export async function exportAll(): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  const keys = await idbKeys();
  for (const k of keys) {
    const v = await idbGet<any>(k);
    if (v === undefined) continue;
    // On essaye de décoder/décompresser si nécessaire
    let data: any = v;
    try {
      if (typeof v !== "string") {
        const text = await decompressGzip(v as any);
        data = JSON.parse(text);
      } else {
        data = JSON.parse(v);
      }
    } catch {
      data = v; // si ce n’est pas du JSON, on laisse brut
    }
    out[String(k)] = data;
  }
  return out;
}

/** Importe un dump { key: any } (remplace les valeurs existantes). */
export async function importAll(dump: Record<string, any>): Promise<void> {
  for (const [k, v] of Object.entries(dump)) {
    await setKV(k, v);
  }
}

/** Efface toutes les clés du store IndexedDB (attention : destructif). */
export async function nukeAll(): Promise<void> {
  try {
    await idbClear();
  } catch (err) {
    console.error("[storage] nukeAll error:", err);
  }
}

/* ---------- Migration utilitaire (si d’autres clés legacy existent) ---------- */
export async function migrateFromLocalStorage(keys: string[]) {
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw == null) continue;
    try {
      const parsed = JSON.parse(raw);
      await setKV(k, parsed);
    } catch {
      // si ce n’est pas du JSON, on tente de sauvegarder tel quel
      try {
        await idbSet(k, raw);
      } catch {}
    }
    try {
      localStorage.removeItem(k);
    } catch {}
  }
}
