// ============================================
// src/lib/playerStats.ts
// Résumé X01 + commit local (quick stats)
// Exports: buildX01Summary, commitMatchSummary
// ============================================

export type X01PerPlayer = {
  playerId: string;
  name?: string;
  avg3?: number;
  bestVisit?: number;
  bestCheckout?: number;
  darts?: number;
  win?: boolean;
  buckets?: any;
};

export type X01Summary = {
  id: string;
  kind: "x01";
  createdAt: number;
  winnerId: string | null;
  perPlayer: X01PerPlayer[];
};

export function buildX01Summary(args: {
  kind: "x01";
  winnerId: string | null;
  perPlayer: X01PerPlayer[];
}): X01Summary {
  const id = (globalThis.crypto?.randomUUID?.() ?? String(Date.now())) as string;
  return {
    id,
    kind: "x01",
    createdAt: Date.now(),
    winnerId: args.winnerId ?? null,
    perPlayer: (args.perPlayer || []).map((pp) => ({
      playerId: pp.playerId,
      name: pp.name || "",
      avg3: Number(pp.avg3 || 0),
      bestVisit: Number(pp.bestVisit || 0),
      bestCheckout: Number(pp.bestCheckout || 0),
      darts: Number(pp.darts || 0),
      win: !!pp.win,
      buckets: pp.buckets ?? undefined,
    })),
  };
}

/**
 * Commit ultra-simple dans le stockage local :
 * - garde le dernier résumé
 * - met à jour une carte "quick stats" par joueur (moyenne et bests)
 */
export function commitMatchSummary(summary: X01Summary): void {
  try {
    localStorage.setItem("dc-last-summary", JSON.stringify(summary));
  } catch {}

  try {
    const key = "dc-quick-stats";
    const raw = localStorage.getItem(key);
    const bag: Record<string, { games: number; darts: number; points: number; avg3: number; bestVisit: number; bestCheckout: number; wins: number; }> =
      raw ? JSON.parse(raw) : {};

    for (const pp of summary.perPlayer) {
      const s = (bag[pp.playerId] ||= {
        games: 0,
        darts: 0,
        points: 0,
        avg3: 0,
        bestVisit: 0,
        bestCheckout: 0,
        wins: 0,
      });
      s.games += 1;
      s.darts += Number(pp.darts || 0);
      // approx points = avg3/3 * darts
      const approxPoints = Number(pp.avg3 || 0) * (Number(pp.darts || 0) / 3);
      s.points += approxPoints;
      s.avg3 = s.darts > 0 ? (s.points / s.darts) * 3 : 0;
      s.bestVisit = Math.max(s.bestVisit || 0, Number(pp.bestVisit || 0));
      s.bestCheckout = Math.max(s.bestCheckout || 0, Number(pp.bestCheckout || 0));
      if (pp.win) s.wins += 1;
    }

    localStorage.setItem(key, JSON.stringify(bag));
  } catch {}
}
