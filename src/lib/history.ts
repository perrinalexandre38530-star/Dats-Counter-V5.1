// ============================================
// src/lib/history.ts (fix sans dépendance "uuid")
// ============================================

// --- ID sans package ---
const genId = (): string => {
  // navigateur moderne
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  // fallback
  const s = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${s()}-${s()}`;
};

import type { SavedMatch, SavedPlayer, X01Snapshot } from "./types";

const KEY = "darts.history.v1";

/* ---------- Lecture / Écriture locale ---------- */
function readAll(): SavedMatch[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedMatch[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedMatch[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/* ---------- API publique ---------- */
export const History = {
  list(): SavedMatch[] {
    return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): SavedMatch | undefined {
    return readAll().find((r) => r.id === id);
  },
  upsert(rec: SavedMatch) {
    const all = readAll();
    const i = all.findIndex((r) => r.id === rec.id);
    if (i >= 0) all[i] = rec;
    else all.unshift(rec);
    writeAll(all);
  },
  update(id: string, mut: (r: SavedMatch) => SavedMatch) {
    const all = readAll();
    const i = all.findIndex((r) => r.id === id);
    if (i >= 0) {
      all[i] = mut({ ...all[i], updatedAt: Date.now() });
      writeAll(all);
    }
  },
  remove(id: string) {
    writeAll(readAll().filter((r) => r.id !== id));
  },
  clear() {
    writeAll([]);
  },
};

/* =========================================================
   Création / mise à jour depuis le moteur X01
   ========================================================= */
export function makeX01RecordFromEngine(params: {
  engine: {
    rules: { start: number; doubleOut: boolean; sets?: number; legs?: number };
    players: Array<{ id?: string; name: string }>;
    scores: number[];
    currentIndex: number;
    dartsThisTurn: Array<{ v: number; mult: 1 | 2 | 3 } | null>;
    sets?: number[];
    legs?: number[];
    winnerId?: string | null;
  };
  existingId?: string;
}): SavedMatch {
  const { engine, existingId } = params;

  const players: SavedPlayer[] = engine.players.map((p) => ({
    id: p.id ?? `local:${p.name}`,
    name: p.name,
  }));

  const snapshot: X01Snapshot = {
    rules: {
      startScore: engine.rules.start,
      doubleOut: engine.rules.doubleOut,
      sets: engine.rules.sets,
      legs: engine.rules.legs,
    },
    players,
    scores: [...engine.scores],
    currentIndex: engine.currentIndex,
    dartsThisTurn: engine.dartsThisTurn,
    legs: engine.legs,
    sets: engine.sets,
  };

  const rec: SavedMatch = {
    id: existingId ?? genId(),              // <-- ici
    kind: "x01",
    status: engine.winnerId ? "finished" : "in_progress",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players,
    winnerId: engine.winnerId ?? undefined,
    payload: { kind: "x01", state: snapshot },
  };

  return rec;
}
