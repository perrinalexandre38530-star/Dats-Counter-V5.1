// ============================================
// src/hooks/useQuickStats.ts
// Lit store.statsByPlayer[pid] + réagit aux MAJ ("__stats_dirty")
// ============================================
import { useEffect, useMemo, useState } from "react";
import { loadStore } from "../lib/storage";

export type QuickStats = {
  avg3: number;
  bestVisit: number;
  bestCheckout?: number;
  winRatePct: number;
  buckets: Record<string, number>;
};

export function useQuickStats(playerId: string | null): QuickStats | null {
  const [seed, setSeed] = useState(0);
  const [snap, setSnap] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const s: any = await loadStore();
        if (!alive) return;
        setSnap(s?.statsByPlayer || null);
      } catch {
        if (!alive) return;
        setSnap(null);
      }
    };
    read();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "__stats_dirty") setSeed((x) => x + 1);
    };
    window.addEventListener("storage", onStorage);
    const t = setInterval(() => setSeed((x) => x + 1), 1500); // fallback StackBlitz

    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s: any = await loadStore();
        setSnap(s?.statsByPlayer || null);
      } catch {
        setSnap(null);
      }
    })();
  }, [seed]);

  return useMemo(() => {
    if (!playerId || !snap || !snap[playerId]) return null;
    const p = snap[playerId];
    const games = Number(p.matches || 0);
    const wins = Number(p.wins || 0);
    const winRatePct = games > 0 ? (wins / games) * 100 : 0;

    return {
      avg3: Number(p.avg3 || 0),
      bestVisit: Number(p.bestVisit || 0),
      bestCheckout: p.bestCheckout != null ? Number(p.bestCheckout) : undefined,
      winRatePct,
      buckets: p.buckets || {},
    };
  }, [snap, playerId]);
}
