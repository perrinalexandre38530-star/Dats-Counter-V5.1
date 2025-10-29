// ============================================
// src/lib/history.ts
// Historique léger + fabrique d'enregistrements X01
// - Stockage localStorage (clé "darts.history.v1")
// - API: History.list/get/getX01/upsert/remove/clear
// - makeX01RecordFromEngine(engine, existingId?)
// ============================================

/* --- Types souples (évite la casse pendant l'intégration) --- */
export type PlayerLite = { id: string; name: string; avatarDataUrl?: string | null };
export type X01Snapshot = {
  rules: { start: number; doubleOut: boolean };
  players: PlayerLite[];
  scores: number[];
  currentIndex: number;
  dartsThisTurn: { v: number; mult: 1 | 2 | 3 }[];
  winnerId?: string | null;
};

export type SavedMatch = {
  id: string;
  kind: "x01" | "leg" | string;
  status: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  updatedAt: number;
  createdAt?: number;
  // pour X01: { state: X01Snapshot }
  // pour LEG: payload = LegResult
  payload?: any;
  // résumé optionnel ultra-léger pour l’historique
  summary?: {
    title?: string;
    subtitle?: string;
  };
};

const KEY = "darts.history.v1";

/* ---------- Helpers stockage ---------- */
function safeRead(): SavedMatch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function safeWrite(items: SavedMatch[]) {
  try {
    // Compression minime : tri + toJSON
    const ordered = [...items].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    localStorage.setItem(KEY, JSON.stringify(ordered));
  } catch (e) {
    // En cas de quota, on supprime les entrées les plus anciennes et on retente
    try {
      let arr = [...items].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      while (arr.length > 0) {
        arr = arr.slice(0, -1);
        localStorage.setItem(KEY, JSON.stringify(arr));
        break;
      }
    } catch {
      // on abandonne silencieusement
    }
  }
}

/* ---------- API ---------- */
export const History = {
  list(): SavedMatch[] {
    return safeRead();
  },

  get(id: string): SavedMatch | null {
    return safeRead().find((r) => r.id === id) ?? null;
  },

  // alias pour compat X01 (même chose que get)
  getX01(id: string): SavedMatch | null {
    return History.get(id);
  },

  upsert(rec: SavedMatch): SavedMatch {
    const arr = safeRead();
    const i = arr.findIndex((r) => r.id === rec.id);
    const merged: SavedMatch = {
      ...(i >= 0 ? arr[i] : {}),
      ...rec,
      updatedAt: rec.updatedAt ?? Date.now(),
    };
    if (i >= 0) arr[i] = merged;
    else arr.unshift(merged);
    safeWrite(arr);
    return merged;
  },

  remove(id: string) {
    const arr = safeRead().filter((r) => r.id !== id);
    safeWrite(arr);
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
};

/* ---------- Fabrique: X01 -> SavedMatch ---------- */
/**
 * Construit un enregistrement X01 à partir d'un "engine-like"
 * attendu par X01Play (buildEngineLike).
 *
 * engine: {
 *   rules: { start, doubleOut },
 *   players: [{id,name}...],
 *   scores: number[],
 *   currentIndex: number,
 *   dartsThisTurn: Dart[],
 *   winnerId?: string|null
 * }
 */
export function makeX01RecordFromEngine(
  engine: {
    rules: { start: number; doubleOut: boolean };
    players: PlayerLite[];
    scores: number[];
    currentIndex: number;
    dartsThisTurn: { v: number; mult: 1 | 2 | 3 }[];
    winnerId?: string | null;
  },
  existingId?: string
): SavedMatch {
  const players = (engine.players || []).map((p) => ({ id: p.id, name: p.name }));
  const winnerId = engine.winnerId ?? null;
  const status: SavedMatch["status"] = winnerId ? "finished" : "in_progress";

  const snapshot: X01Snapshot = {
    rules: { start: Number(engine.rules?.start ?? 501), doubleOut: !!engine.rules?.doubleOut },
    players,
    scores: engine.scores ?? [],
    currentIndex: Number(engine.currentIndex ?? 0),
    dartsThisTurn: engine.dartsThisTurn ?? [],
    winnerId,
  };

  const id =
    existingId ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()));

  const subtitle = players.map((p) => p.name).join(" · ");

  const rec: SavedMatch = {
    id,
    kind: "x01",
    status,
    players,
    winnerId,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    payload: { state: snapshot },
    summary: {
      title: `X01 ${new Date().toLocaleString()}`,
      subtitle,
    },
  };

  return rec;
}
