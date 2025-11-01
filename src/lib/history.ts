// ============================================
// src/lib/history.ts — SAFE (IndexedDB + OPFS)
// Remplace totalement l’ancienne version localStorage
// API conservée : list(), get(id), upsert(rec), clear()
// ============================================

import { loadStore, saveStore } from "./storage";
import { readJSON, writeJSON } from "./deviceStore"; // fallback OPFS
import type { Store } from "./types";

/* ---------- Types publics ---------- */
export type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };

export type SavedMatch = {
  id: string;
  kind?: "x01" | "cricket" | string;
  status?: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  summary?: any;
  payload?: any;
};

/* ---------- Constantes ---------- */
const OPFS_HISTORY_PATH = "history/history.json";
const MAX_ITEMS = 500;

/* ---------- Helpers ---------- */
function toArr<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function byUpdatedDesc(a: SavedMatch, b: SavedMatch) {
  const ta = Number(a.updatedAt ?? a.createdAt ?? 0);
  const tb = Number(b.updatedAt ?? b.createdAt ?? 0);
  return tb - ta;
}

/* ---------- Canal principal : IndexedDB (storage.ts) ---------- */
async function readFromIDB(): Promise<SavedMatch[]> {
  const s = (await loadStore<Store>()) || ({} as Store);
  return toArr<SavedMatch>(s.history);
}

async function writeToIDB(list: SavedMatch[]) {
  const s = (await loadStore<Store>()) || ({} as Store);
  const next: Store = { ...(s as any), history: list } as Store;
  await saveStore(next);
}

/* ---------- Fallback OPFS (deviceStore.ts) ---------- */
async function readFromOPFS(): Promise<SavedMatch[]> {
  try {
    const v = await readJSON<SavedMatch[]>(OPFS_HISTORY_PATH);
    return toArr(v);
  } catch {
    return [];
  }
}
async function writeToOPFS(list: SavedMatch[]) {
  try {
    await writeJSON(OPFS_HISTORY_PATH, list);
  } catch {
    // ignore
  }
}

/* ---------- Implémentation publique ---------- */
async function list(): Promise<SavedMatch[]> {
  // 1) tente IndexedDB
  try {
    const arr = await readFromIDB();
    if (arr.length) return arr.sort(byUpdatedDesc);
    // si vide, tente OPFS (peut contenir une ancienne copie)
    const opfs = await readFromOPFS();
    if (opfs.length) {
      // replique dans IDB pour normaliser
      await writeToIDB(opfs);
      return opfs.sort(byUpdatedDesc);
    }
    return [];
  } catch {
    // IDB KO → fallback pur OPFS
    const opfs = await readFromOPFS();
    return opfs.sort(byUpdatedDesc);
  }
}

async function get(id: string): Promise<SavedMatch | null> {
  const all = await list();
  return all.find((r) => r.id === id) ?? null;
}

async function upsert(rec: SavedMatch): Promise<void> {
  const now = Date.now();
  const fixed: SavedMatch = {
    ...rec,
    id: rec.id || (crypto.randomUUID?.() ?? String(now)),
    createdAt: rec.createdAt ?? now,
    updatedAt: now,
  };

  // 1) essaie IDB
  try {
    const arr = await readFromIDB();
    const idx = arr.findIndex((r) => r.id === fixed.id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...fixed, updatedAt: now };
    else arr.unshift(fixed);

    const trimmed = arr.sort(byUpdatedDesc).slice(0, MAX_ITEMS);
    await writeToIDB(trimmed);
    // miroir OPFS (best-effort)
    writeToOPFS(trimmed).catch(() => {});
    return;
  } catch {
    // 2) IDB KO → tout en OPFS
    const arr = await readFromOPFS();
    const idx = arr.findIndex((r) => r.id === fixed.id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...fixed, updatedAt: now };
    else arr.unshift(fixed);
    const trimmed = arr.sort(byUpdatedDesc).slice(0, MAX_ITEMS);
    await writeToOPFS(trimmed);
  }
}

async function clear(): Promise<void> {
  try {
    await writeToIDB([]);
  } catch {}
  try {
    await writeToOPFS([]);
  } catch {}
}

/* ---------- Export ---------- */
export const History = {
  list,      // Promise<SavedMatch[]>
  get,       // Promise<SavedMatch|null>
  upsert,    // Promise<void>
  clear,     // Promise<void>
};

export default History;
