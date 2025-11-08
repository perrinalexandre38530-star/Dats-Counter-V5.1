// ============================================
// src/lib/aggFromHistory.ts
// Récupère winnerId + perPlayer {darts, points, bestVisit, bestCheckout}
// depuis un SavedMatch (summary OU payload), en tolérant tous les formats
// ============================================

export type PerPlayerAgg = Record<string, {
    darts: number;
    points: number;
    bestVisit?: number;
    bestCheckout?: number;
  }>;
  
  export function pickNumber(v: any, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }
  
  export function extractAggFromSavedMatch(rec: any): {
    winnerId: string | null;
    perPlayer: PerPlayerAgg;
  } {
    const winnerId = rec?.winnerId ?? null;
    const s = rec?.summary || {};
    const p = rec?.payload || {};
  
    // 1) chemins possibles par joueur
    const per =
      s?.players || s?.perPlayer || s?.per || p?.players || p?.perPlayer || p?.per || {};
  
    // 2) fallback si rien : parfois chaque joueur est au premier niveau
    //    (ex: summary["playerId"] = {...})
    const keys = Object.keys(per).length ? Object.keys(per) :
      Object.keys(s).filter(k => typeof s[k] === "object" && s[k] && "darts" in s[k]);
  
    const perPlayer: PerPlayerAgg = {};
  
    const collect = (pid: string, obj: any) => {
      const darts =
        pickNumber(obj?.darts) ||
        (Array.isArray(obj?.visits) ? obj.visits.reduce((t: number, v: any) => t + (v?.segments?.length || 0), 0) : 0);
  
      const points =
        pickNumber(obj?.points) ||
        pickNumber(obj?.scored) ||
        (Array.isArray(obj?.visits)
          ? obj.visits.reduce((t: number, v: any) => t + pickNumber(v?.score), 0)
          : 0);
  
      const bestVisit = Math.max(
        0,
        pickNumber(obj?.bestVisit),
        ...(Array.isArray(obj?.visits) ? obj.visits.map((v: any) => pickNumber(v?.score)) : [])
      );
  
      const bestCheckout = Math.max(
        0,
        pickNumber(obj?.bestCheckout),
        pickNumber(obj?.bestCO),
        pickNumber(s?.bestCO), // global parfois
        pickNumber(p?.bestCO)
      );
  
      perPlayer[pid] = {
        darts,
        points,
        bestVisit: bestVisit || undefined,
        bestCheckout: bestCheckout || undefined,
      };
    };
  
    // 3) itère les structures rencontrées
    if (Object.keys(per).length) {
      for (const pid of Object.keys(per)) collect(pid, per[pid] || {});
    } else if (keys.length) {
      for (const pid of keys) collect(pid, s[pid] || {});
    } else if (Array.isArray(rec?.players)) {
      // dernier recours : boucle joueurs et cherche qqchose
      for (const pl of rec.players) {
        const pid = pl?.id;
        if (!pid) continue;
        collect(pid, (s?.players?.[pid] || s?.perPlayer?.[pid] || p?.players?.[pid] || p?.perPlayer?.[pid] || {}));
      }
    }
  
    return { winnerId, perPlayer };
  }
  