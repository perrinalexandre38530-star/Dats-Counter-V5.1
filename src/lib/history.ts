// ============================================
// src/lib/history.ts — Historique "lourd + compressé"
// API : list(), get(id), upsert(rec), remove(id), clear()
// + History.{list,get,upsert,remove,clear,readAll}  (readAll = sync via cache)
// - Stockage principal : IndexedDB (objectStore "history")
// - Compression : LZString (UTF-16) sur le champ payload
// - Fallback : localStorage si IDB indispo
// - Migration auto depuis l’ancien localStorage KEY = "dc-history-v1"
// ============================================

/* =========================
   Types
========================= */
export type PlayerLite = {
  id: string;
  name?: string;
  avatarDataUrl?: string | null;
};

export type SavedMatch = {
  id: string;
  kind?: "x01" | "cricket" | string;
  status?: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  // Résumé léger (pour listes)
  summary?: {
    legs?: number;
    darts?: number;
    avg3ByPlayer?: Record<string, number>;
    co?: number;
  } | null;
  // Payload complet (gros) — compressé en base
  payload?: any;
};

/* =========================
   Constantes
========================= */
const LSK = "dc-history-v1"; // ancien storage (migration + fallback)
const DB_NAME = "dc-store-v1";
// ⬇⬇⬇ bump version pour forcer onupgradeneeded et créer l'index manquant
const DB_VER = 2;
const STORE = "history";
const MAX_ROWS = 400;

/* =========================
   Mini LZ-String UTF16
   (compressToUTF16 / decompressFromUTF16)
   Source condensée : https://github.com/pieroxy/lz-string
========================= */
/* eslint-disable */
const LZString = (function () {
  const f = String.fromCharCode;
  const baseReverseDic: Record<string, Record<string, number>> = {};
  function getBaseValue(alphabet: string, character: string) {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (let i = 0; i < alphabet.length; i++) {
        baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
    }
    return baseReverseDic[alphabet][character];
  }
  const keyStrUriSafe =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const LZ: any = {};
  LZ.compressToUTF16 = function (input: string) {
    if (input == null) return "";
    let output = "",
      current = 0,
      status = 0,
      i: number;
    input = LZ.compress(input);
    for (i = 0; i < input.length; i++) {
      current = (current << 1) + input.charCodeAt(i);
      if (status++ == 14) {
        output += f(current + 32);
        status = 0;
        current = 0;
      }
    }
    return output + f(current + 32 + status);
  };
  LZ.decompressFromUTF16 = function (compressed: string) {
    if (compressed == null) return "";
    let output = "",
      current = 0,
      status = 0,
      i: number,
      c: number;
    for (i = 0; i < compressed.length; i++) {
      c = compressed.charCodeAt(i) - 32;
      if (status === 0) {
        status = c & 15;
        current = c >> 4;
      } else {
        current = (current << 15) + c;
        status += 15;
        while (status >= 8) {
          status -= 8;
          output += f((current >> status) & 255);
        }
      }
    }
    return LZ.decompress(output);
  };
  LZ.compress = function (uncompressed: string) {
    if (uncompressed == null) return "";
    let i,
      value,
      context_dictionary: any = {},
      context_dictionaryToCreate: any = {},
      context_c = "",
      context_wc = "",
      context_w = "",
      context_enlargeIn = 2,
      context_dictSize = 3,
      context_numBits = 2,
      context_data: number[] = [],
      context_data_val = 0,
      context_data_position = 0;
    for (let ii = 0; ii < uncompressed.length; ii += 1) {
      context_c = uncompressed.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }
      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc))
        context_w = context_wc;
      else {
        if (
          Object.prototype.hasOwnProperty.call(
            context_dictionaryToCreate,
            context_w
          )
        ) {
          value = context_w.charCodeAt(0);
          for (i = 0; i < context_numBits; i++) {
            context_data_val = context_data_val << 1;
            if (context_data_position == 15) {
              context_data.push(context_data_val);
              context_data_val = 0;
              context_data_position = 0;
            } else context_data_position++;
          }
          for (i = 0; i < 8; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == 15) {
              context_data.push(context_data_val);
              context_data_val = 0;
              context_data_position = 0;
            } else context_data_position++;
            value >>= 1;
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) {
            context_data_val =
              (context_data_val << 1) | (value & 1);
            if (context_data_position == 15) {
              context_data.push(context_data_val);
              context_data_val = 0;
              context_data_position = 0;
            } else context_data_position++;
            // @ts-ignore
            value >>= 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }
    if (context_w !== "") {
      if (
        Object.prototype.hasOwnProperty.call(
          context_dictionaryToCreate,
          context_w
        )
      ) {
        value = context_w.charCodeAt(0);
        for (i = 0; i < context_numBits; i++) {
          context_data_val = context_data_val << 1;
          if (context_data_position == 15) {
            context_data.push(context_data_val);
            context_data_val = 0;
            context_data_position = 0;
          } else context_data_position++;
        }
        for (i = 0; i < 8; i++) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position == 15) {
            context_data.push(context_data_val);
            context_data_val = 0;
            context_data_position = 0;
          } else context_data_position++;
          value >>= 1;
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i = 0; i < context_numBits; i++) {
          context_data_val =
            (context_data_val << 1) | (value & 1);
          if (context_data_position == 15) {
            context_data.push(context_data_val);
            context_data_val = 0;
            context_data_position = 0;
          } else context_data_position++;
          // @ts-ignore
          value >>= 1;
        }
      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }
    for (i = 0; i < context_numBits; i++) {
      context_data_val = context_data_val << 1;
      if (context_data_position == 15) {
        context_data.push(context_data_val);
        context_data_val = 0;
        context_data_position = 0;
      } else context_data_position++;
    }
    return context_data.map((c) => String.fromCharCode(c + 32)).join("");
  };
  LZ.decompress = function (compressed: string) {
    if (compressed == null) return "";
    let dictionary: any[] = [0, 1, 2],
      enlargeIn = 4,
      dictSize = 4,
      numBits = 3,
      entry = "",
      result: string[] = [],
      w: any,
      c: number;
    const data = {
      string: compressed,
      val: compressed.charCodeAt(0) - 32,
      position: 32768,
      index: 1,
    };
    function readBits(n: number) {
      let bits = 0,
        maxpower = Math.pow(2, n),
        power = 1;
      while (power != maxpower) {
        const resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = 32768;
          data.val = data.string.charCodeAt(data.index++) - 32;
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      return bits;
    }
    const next = readBits(2);
    switch (next) {
      case 0:
        c = readBits(8);
        dictionary[3] = String.fromCharCode(c);
        w = dictionary[3];
        break;
      case 1:
        c = readBits(16);
        dictionary[3] = String.fromCharCode(c);
        w = dictionary[3];
        break;
      case 2:
        return "";
    }
    result.push(w as string);
    while (true) {
      if (data.index > data.string.length) return "";
      let cc = readBits(numBits);
      let entry2;
      if (cc === 0) {
        c = readBits(8);
        dictionary[dictSize++] = String.fromCharCode(c);
        cc = dictSize - 1;
        enlargeIn--;
      } else if (cc === 1) {
        c = readBits(16);
        dictionary[dictSize++] = String.fromCharCode(c);
        cc = dictSize - 1;
        enlargeIn--;
      } else if (cc === 2) return result.join("");
      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      if (dictionary[cc]) entry2 = dictionary[cc];
      else if (cc === dictSize) entry2 = (w as string) + (w as string).charAt(0);
      else return "";
      result.push(entry2 as string);
      dictionary[dictSize++] = (w as string) + (entry2 as string).charAt(0);
      enlargeIn--;
      w = entry2;
      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
    }
  };
  return LZ;
})();
/* eslint-enable */

/* =========================
   IndexedDB helpers
========================= */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;

      // crée le store si besoin ou récupère-le
      let os: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE)) {
        os = db.createObjectStore(STORE, { keyPath: "id" });
      } else {
        os = req.transaction!.objectStore(STORE);
      }

      // crée l'index s'il manque (migration v1 -> v2)
      try {
        // @ts-ignore
        if (!os.indexNames || !os.indexNames.contains("by_updatedAt")) {
          os.createIndex("by_updatedAt", "updatedAt", { unique: false });
        }
      } catch {
        try { os.createIndex("by_updatedAt", "updatedAt", { unique: false }); } catch {}
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const st = tx.objectStore(STORE);
    Promise.resolve(fn(st))
      .then((v) => {
        tx.oncomplete = () => resolve(v as T);
        tx.onerror = () => reject(tx.error);
      })
      .catch(reject);
  });
}

/* =========================
   Migration depuis localStorage (une seule fois)
========================= */
let migrDone = false;
async function migrateFromLocalStorageOnce() {
  if (migrDone) return;
  migrDone = true;
  try {
    const raw = localStorage.getItem(LSK);
    if (!raw) return;
    const rows: SavedMatch[] = JSON.parse(raw);
    await withStore("readwrite", async (st) => {
      for (const r of rows) {
        const rec: any = { ...r };
        const payloadStr = rec.payload ? JSON.stringify(rec.payload) : "";
        const payloadCompressed = payloadStr
          ? LZString.compressToUTF16(payloadStr)
          : "";
        delete rec.payload;
        rec.payloadCompressed = payloadCompressed;
        await new Promise<void>((res, rej) => {
          const req = st.put(rec);
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        });
      }
    });
    localStorage.removeItem(LSK);
    console.info("[history] migration depuis localStorage effectuée");
  } catch (e) {
    console.warn("[history] migration impossible:", e);
  }
}

/* =========================
   API asynchrone principale
========================= */
export async function list(): Promise<SavedMatch[]> {
  await migrateFromLocalStorageOnce();
  try {
    const rows: any[] = await withStore("readonly", async (st) => {
      // Essai via l’index (ordre décroissant)
      const readWithIndex = async () =>
        await new Promise<any[]>((resolve, reject) => {
          try {
            // @ts-ignore
            const hasIndex = st.indexNames && st.indexNames.contains("by_updatedAt");
            if (!hasIndex) throw new Error("no_index");
            const ix = st.index("by_updatedAt");
            const req = ix.openCursor(undefined, "prev");
            const out: any[] = [];
            req.onsuccess = () => {
              const cur = req.result as IDBCursorWithValue | null;
              if (cur) {
                const val = { ...cur.value };
                delete (val as any).payloadCompressed;
                out.push(val);
                cur.continue();
              } else resolve(out);
            };
            req.onerror = () => reject(req.error);
          } catch (e) {
            reject(e);
          }
        });

      // Fallback : lecture du store brut + tri mémoire
      const readWithoutIndex = async () =>
        await new Promise<any[]>((resolve, reject) => {
          const req = st.openCursor();
          const out: any[] = [];
          req.onsuccess = () => {
            const cur = req.result as IDBCursorWithValue | null;
            if (cur) {
              const val = { ...cur.value };
              delete (val as any).payloadCompressed;
              out.push(val);
              cur.continue();
            } else {
              out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
              resolve(out);
            }
          };
          req.onerror = () => reject(req.error);
        });

      try {
        return await readWithIndex();
      } catch {
        return await readWithoutIndex();
      }
    });
    return rows as SavedMatch[];
  } catch {
    // fallback legacy si IDB HS
    try {
      const txt = localStorage.getItem(LSK);
      return txt ? (JSON.parse(txt) as SavedMatch[]) : [];
    } catch {
      return [];
    }
  }
}

export async function get(id: string): Promise<SavedMatch | null> {
  await migrateFromLocalStorageOnce();
  try {
    const rec: any = await withStore("readonly", async (st) => {
      return await new Promise<any>((resolve, reject) => {
        const req = st.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
    if (!rec) {
      // fallback
      const rows = (() => {
        try {
          return JSON.parse(localStorage.getItem(LSK) || "[]");
        } catch {
          return [];
        }
      })() as any[];
      return (rows.find((r) => r.id === id) || null) as SavedMatch | null;
    }
    const payload =
      rec.payloadCompressed && typeof rec.payloadCompressed === "string"
        ? JSON.parse(LZString.decompressFromUTF16(rec.payloadCompressed) || "null")
        : null;
    delete rec.payloadCompressed;
    return { ...(rec as any), payload } as SavedMatch;
  } catch (e) {
    console.warn("[history.get] fallback localStorage:", e);
    const rows = (() => {
      try {
        return JSON.parse(localStorage.getItem(LSK) || "[]");
      } catch {
        return [];
      }
    })() as any[];
    return (rows.find((r) => r.id === id) || null) as SavedMatch | null;
  }
}

export async function upsert(rec: SavedMatch): Promise<void> {
  await migrateFromLocalStorageOnce();
  const now = Date.now();
  const safe: any = {
    id: rec.id,
    kind: rec.kind || "x01",
    status: rec.status || "finished",
    players: rec.players || [],
    winnerId: rec.winnerId ?? null,
    createdAt: rec.createdAt ?? now,
    updatedAt: now,
    summary: rec.summary || null,
  };
  try {
    const payloadStr = rec.payload ? JSON.stringify(rec.payload) : "";
    const payloadCompressed = payloadStr
      ? LZString.compressToUTF16(payloadStr)
      : "";

    await withStore("readwrite", async (st) => {
      // limiter à MAX_ROWS
      await new Promise<void>((resolve, reject) => {
        // lecture via index si dispo, sinon store brut
        const doTrim = (keys: string[]) => {
          if (keys.length > MAX_ROWS) {
            const toDelete = keys.slice(MAX_ROWS);
            let pending = toDelete.length;
            if (!pending) return resolve();
            toDelete.forEach((k) => {
              const del = st.delete(k);
              del.onsuccess = () => { if (--pending === 0) resolve(); };
              del.onerror = () => { if (--pending === 0) resolve(); };
            });
          } else resolve();
        };

        try {
          // @ts-ignore
          const hasIndex = st.indexNames && st.indexNames.contains("by_updatedAt");
          if (hasIndex) {
            const ix = st.index("by_updatedAt");
            const req = ix.openCursor(undefined, "prev");
            const keys: string[] = [];
            req.onsuccess = () => {
              const cur = req.result as IDBCursorWithValue | null;
              if (cur) {
                keys.push(cur.primaryKey as string);
                cur.continue();
              } else doTrim(keys);
            };
            req.onerror = () => reject(req.error);
          } else {
            const req = st.openCursor();
            const rows: any[] = [];
            req.onsuccess = () => {
              const cur = req.result as IDBCursorWithValue | null;
              if (cur) {
                rows.push(cur.value);
                cur.continue();
              } else {
                rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                doTrim(rows.map(r => r.id));
              }
            };
            req.onerror = () => reject(req.error);
          }
        } catch (e) {
          resolve(); // en cas de doute, on ne coupe rien
        }
      });

      const putReq = st.put({ ...safe, payloadCompressed });
      await new Promise<void>((resolve, reject) => {
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });
    });
  } catch (e) {
    // Fallback compact si IDB indispo
    console.warn("[history.upsert] fallback localStorage (IDB indispo?):", e);
    try {
      const rows: any[] = (() => {
        try {
          return JSON.parse(localStorage.getItem(LSK) || "[]");
        } catch {
          return [];
        }
      })();
      const idx = rows.findIndex((r) => r.id === rec.id);
      const trimmed = { ...safe, payload: null };
      if (idx >= 0) rows.splice(idx, 1);
      rows.unshift(trimmed);
      while (rows.length > 120) rows.pop();
      localStorage.setItem(LSK, JSON.stringify(rows));
    } catch {}
  }
}

export async function remove(id: string): Promise<void> {
  await migrateFromLocalStorageOnce();
  try {
    await withStore("readwrite", (st) => {
      return new Promise<void>((resolve, reject) => {
        const req = st.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  } catch {
    // fallback
    try {
      const rows = (() => {
        try {
          return JSON.parse(localStorage.getItem(LSK) || "[]");
        } catch {
          return [];
        }
      })() as any[];
      const out = rows.filter((r) => r.id !== id);
      localStorage.setItem(LSK, JSON.stringify(out));
    } catch {}
  }
}

export async function clear(): Promise<void> {
  await migrateFromLocalStorageOnce();
  try {
    await withStore("readwrite", (st) => {
      return new Promise<void>((resolve, reject) => {
        const req = st.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  } catch {
    try {
      localStorage.removeItem(LSK);
    } catch {}
  }
}

/* =========================
   Cache léger synchrone (pour UI legacy)
========================= */
type _LightRow = Omit<SavedMatch, "payload">;

const LSK_CACHE = "dc-history-cache-v1";
let __cache: _LightRow[] = (() => {
  try {
    const txt = localStorage.getItem(LSK_CACHE);
    return txt ? (JSON.parse(txt) as _LightRow[]) : [];
  } catch {
    return [];
  }
})();
function _saveCache() {
  try {
    localStorage.setItem(LSK_CACHE, JSON.stringify(__cache));
  } catch {}
}

async function _hydrateCacheFromList() {
  try {
    const rows = await list();
    __cache = rows.map((r: any) => {
      const { payload, ...lite } = r || {};
      return lite;
    });
    _saveCache();
  } catch {}
}
function _applyUpsertToCache(rec: SavedMatch) {
  const { payload, ...lite } = (rec as any) || {};
  __cache = [lite as _LightRow, ...__cache.filter((r) => r.id !== lite.id)];
  if (__cache.length > MAX_ROWS) __cache.length = MAX_ROWS;
  _saveCache();
}
function _applyRemoveToCache(id: string) {
  __cache = __cache.filter((r) => r.id !== id);
  _saveCache();
}
function _clearCache() {
  __cache = [];
  _saveCache();
}

function readAllSync(): _LightRow[] {
  return __cache.slice();
}

/* =========================
   Export objet unique History
========================= */
export const History = {
  // asynchrone
  async list() {
    const rows = await list();
    __cache = rows.map((r: any) => {
      const { payload, ...lite } = r || {};
      return lite;
    });
    _saveCache();
    return rows;
  },
  get,
  async upsert(rec: SavedMatch) {
    await upsert(rec);
    _applyUpsertToCache(rec);
  },
  async remove(id: string) {
    await remove(id);
    _applyRemoveToCache(id);
  },
  async clear() {
    await clear();
    _clearCache();
  },

  // synchrone (legacy UI)
  readAll: readAllSync,
};

// Première hydration du cache
if (!__cache.length) {
  _hydrateCacheFromList();
}
