// ============================================
// src/lib/deriveHistoryStats.ts
// Dérive des stats simples depuis un enregistrement d'historique.
// Fonctionne même si "summary" est incomplet.
// ============================================

export type NumMap = Record<string, number>;

export type SimpleMatchStats = {
  kind: string;
  playerIds: string[];
  winnerId: string | null;
  createdAt?: number;
  avg3ByPlayer: NumMap;
  dartsByPlayer: NumMap;
  bestVisitByPlayer: NumMap;
  bestCheckoutByPlayer: NumMap;
  co?: number; // nb de checkouts
};

/** Sécurise un nombre */
const N = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Additionne par joueur */
function addMap(dst: NumMap, src?: NumMap) {
  if (!src) return;
  for (const k of Object.keys(src)) dst[k] = N(dst[k]) + N(src[k]);
}

/** Dérive pour un match X01 en lisant summary puis payload.legs si besoin */
export function deriveX01(rec: any): SimpleMatchStats {
  const players = (rec?.players || []).map((p: any) => p.id);
  const out: SimpleMatchStats = {
    kind: "x01",
    playerIds: players,
    winnerId: rec?.winnerId ?? null,
    createdAt: rec?.createdAt,
    avg3ByPlayer: {},
    dartsByPlayer: {},
    bestVisitByPlayer: {},
    bestCheckoutByPlayer: {},
    co: 0,
  };

  // 1) Si summary présent, on prend ce qu'il y a
  const sum = rec?.summary || {};
  addMap(out.avg3ByPlayer, sum.avg3ByPlayer);
  // "darts" peut être total ou par joueur selon impl — on gère les deux
  if (typeof sum.darts === "number") {
    const per = Math.floor(N(sum.darts) / Math.max(players.length || 1, 1));
    for (const id of players) out.dartsByPlayer[id] = (out.dartsByPlayer[id] || 0) + per;
  } else {
    addMap(out.dartsByPlayer, sum.darts as NumMap);
  }
  if (typeof sum.co === "number") out.co = N(sum.co);

  // 2) Si payload.legs existe : calcule proprement par joueur
  const legs: any[] = rec?.payload?.legs || rec?.payload?.__legs || [];
  if (Array.isArray(legs) && legs.length) {
    const perAll = legs.flatMap((l: any) => Array.isArray(l?.perPlayer) ? l.perPlayer : []);
    for (const id of players) {
      const rows = perAll.filter((x: any) => x?.playerId === id);
      const darts = rows.reduce((s: number, r: any) => s + N(r?.darts), 0);
      const pts = rows.reduce((s: number, r: any) => s + N(r?.points), 0);
      const a3 = darts > 0 ? (pts / darts) * 3 : 0;
      const bv = rows.reduce((m: number, r: any) => Math.max(m, N(r?.bestVisit)), 0);
      const bco = rows.reduce((m: number, r: any) => Math.max(m, N(r?.bestCheckout)), 0);

      out.dartsByPlayer[id] = Math.max(N(out.dartsByPlayer[id]), darts);
      out.avg3ByPlayer[id] = Math.max(N(out.avg3ByPlayer[id]), Math.round(a3 * 100) / 100);
      out.bestVisitByPlayer[id] = Math.max(N(out.bestVisitByPlayer[id]), bv);
      out.bestCheckoutByPlayer[id] = Math.max(N(out.bestCheckoutByPlayer[id]), bco);
    }
    // co = nb de legs avec winnerId défini
    out.co = Math.max(N(out.co), legs.filter((l) => !!l?.winnerId).length);
  }

  // 3) Si rien du tout, tenter payload.state (compat reprise)
  if (!legs?.length && (!sum || Object.keys(sum).length === 0)) {
    const st = rec?.payload?.state;
    if (st?.players && st?.scores) {
      for (const id of players) {
        out.dartsByPlayer[id] = N(out.dartsByPlayer[id]); // 0 par défaut
        out.avg3ByPlayer[id] = N(out.avg3ByPlayer[id]);
        out.bestVisitByPlayer[id] = N(out.bestVisitByPlayer[id]);
        out.bestCheckoutByPlayer[id] = N(out.bestCheckoutByPlayer[id]);
      }
    }
  }

  return out;
}

/** Route générique (au cas où d'autres modes arrivent) */
export function deriveSimpleStats(rec: any): SimpleMatchStats {
  const kind = String(rec?.kind || "x01");
  if (kind === "x01") return deriveX01(rec);
  // fallback : squelette vide mais stable
  return {
    kind,
    playerIds: (rec?.players || []).map((p: any) => p.id),
    winnerId: rec?.winnerId ?? null,
    createdAt: rec?.createdAt,
    avg3ByPlayer: {},
    dartsByPlayer: {},
    bestVisitByPlayer: {},
    bestCheckoutByPlayer: {},
    co: 0,
  };
}
