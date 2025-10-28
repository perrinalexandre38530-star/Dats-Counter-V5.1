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

function now() {
  return Date.now();
}

/* ---------- API publique ---------- */
export const History = {
  /** Liste triée, la plus récente en premier */
  list(): SavedMatch[] {
    return readAll().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  },

  /** Récupère un match par id. Ne renvoie **jamais** undefined. */
  get(id: string): SavedMatch | null {
    const rec = readAll().find((r) => r.id === id);
    return rec ?? null;
  },

  /** Récupère un match X01 (ou null si absent / mauvais type). */
  getX01(id: string): SavedMatch | null {
    const rec = this.get(id);
    if (!rec || rec.kind !== "x01") return null;
    return rec;
  },

  /** Crée ou met à jour un match. Renvoie la version effectivement stockée. */
  upsert(rec: SavedMatch): SavedMatch {
    const all = readAll();

    // garde-fou timestamps + id
    const stored: SavedMatch = {
      ...rec,
      id: rec.id || genId(),
      createdAt: rec.createdAt ?? now(),
      updatedAt: now(),
    };

    const i = all.findIndex((r) => r.id === stored.id);
    if (i >= 0) all[i] = stored;
    else all.unshift(stored);

    writeAll(all);
    return stored;
  },

  /** Modifie un match par mutation. Renvoie la version enregistrée ou null. */
  update(id: string, mut: (r: SavedMatch) => SavedMatch): SavedMatch | null {
    const all = readAll();
    const i = all.findIndex((r) => r.id === id);
    if (i < 0) return null;

    const next = mut({ ...all[i] });
    const stored: SavedMatch = {
      ...next,
      id,
      createdAt: next.createdAt ?? all[i].createdAt ?? now(),
      updatedAt: now(),
    };

    all[i] = stored;
    writeAll(all);
    return stored;
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

  const when = now();

  const rec: SavedMatch = {
    id: existingId ?? genId(),
    kind: "x01",
    status: engine.winnerId ? "finished" : "in_progress",
    createdAt: when,
    updatedAt: when,
    players,
    winnerId: engine.winnerId ?? undefined,
    payload: { kind: "x01", state: snapshot },
  };

  return rec;
}
