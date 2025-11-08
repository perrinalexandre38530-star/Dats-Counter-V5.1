// ============================================
// src/dev/devHistoryProbe.ts
// Petit outil de debug pour l'historique
// window.__histProbe.seed() / dump() / clear()
// ============================================
import { History } from "../lib/history";

type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };

function rid() {
  return "m_" + Math.random().toString(36).slice(2) + "_" + Date.now();
}

async function seed() {
  const id = rid();
  const players: PlayerLite[] = [
    { id: "p1", name: "Alex" },
    { id: "p2", name: "Lehna" },
  ];
  const now = Date.now();

  await History.upsert({
    id,
    kind: "x01",
    status: "finished",
    players,
    winnerId: "p1",
    createdAt: now,
    updatedAt: now,
    summary: {
      legs: 1,
      darts: 42,
      avg3ByPlayer: { p1: 61.2, p2: 49.7 },
      co: 1,
    },
    payload: {
      visits: [{ p: "p1", score: 100 }, { p: "p2", score: 85 }],
      meta: { target: 301 },
    },
  });
  // Ré-hydrate le cache interne
  await History.list();
  console.info("[probe] seed OK:", id);
  return id;
}

async function dump() {
  const rows = await History.list();
  console.info("[probe] list:", rows);
  return rows;
}

async function clear() {
  await History.clear();
  console.warn("[probe] clear OK");
}

export function installHistoryProbe() {
  (window as any).__histProbe = { seed, dump, clear };
  console.info(
    "[probe] installé. Essayez dans la console:",
    "__histProbe.seed(), __histProbe.dump(), __histProbe.clear()"
  );
}
