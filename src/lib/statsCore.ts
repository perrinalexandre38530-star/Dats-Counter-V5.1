// ============================================
// src/lib/statsCore.ts — Calcul leg + agrégat match + legacy maps
// ============================================

import type {
    ID, Visit, LegStats, LegStatsPerPlayer, LegacyMaps, MatchSummary, PlayerLite,
  } from "./types";
  
  // ----- helpers
  const sum = (a: number, b: number) => a + b;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  
  export function computeLegStats(visits: Visit[], players: PlayerLite[], winnerId?: ID | null): LegStats {
    const by: Record<ID, LegStatsPerPlayer> = {};
    for (const p of players) {
      by[p.id] = {
        dartsThrown: 0, visits: 0, avg3: 0,
        h60: 0, h100: 0, h140: 0, h180: 0,
        bestVisit: 0, checkoutAttempts: 0, checkoutHits: 0, bestCheckout: 0,
      };
    }
  
    const byPlayerVisits: Record<ID, number[]> = {};
    for (const v of visits) {
      const segs = v.segments ?? [];
      const darts = segs.length;
      const sc = typeof v.score === "number" ? v.score : segs.map(s => s.v * (s.mult ?? 1)).reduce(sum, 0);
  
      by[v.p].dartsThrown += darts;
      by[v.p].visits += 1;
      by[v.p].bestVisit = Math.max(by[v.p].bestVisit, sc);
  
      // buckets
      if (sc >= 180) by[v.p].h180 += 1;
      else if (sc >= 140) by[v.p].h140 += 1;
      else if (sc >= 100) by[v.p].h100 += 1;
      else if (sc >= 60) by[v.p].h60 += 1;
  
      if (v.isCheckout) {
        by[v.p].checkoutAttempts += 1;
        const hit = !v.bust;
        if (hit) {
          by[v.p].checkoutHits += 1;
          by[v.p].bestCheckout = Math.max(by[v.p].bestCheckout, sc);
        }
      }
  
      (byPlayerVisits[v.p] ||= []).push(sc);
    }
  
    // avg3
    for (const pid of Object.keys(by)) {
      const d = by[pid].dartsThrown || 1;
      const total = (byPlayerVisits[pid] || []).reduce(sum, 0);
      by[pid].avg3 = (total / d) * 3;
    }
  
    const dartsTotal = Object.values(by).map(x => x.dartsThrown).reduce(sum, 0);
    return { byPlayer: by, winnerId: winnerId ?? null, dartsTotal };
  }
  
  export function toLegacyMaps(leg: LegStats): LegacyMaps {
    const ids = Object.keys(leg.byPlayer);
    const m = <T,>(f: (id: ID) => T) => Object.fromEntries(ids.map(id => [id, f(id)]));
  
    return {
      avg3: m(id => leg.byPlayer[id].avg3 || 0),
      darts: m(id => leg.byPlayer[id].dartsThrown || 0),
      visits: m(id => leg.byPlayer[id].visits || 0),
      h60: m(id => leg.byPlayer[id].h60 || 0),
      h100: m(id => leg.byPlayer[id].h100 || 0),
      h140: m(id => leg.byPlayer[id].h140 || 0),
      h180: m(id => leg.byPlayer[id].h180 || 0),
      bestVisit: m(id => leg.byPlayer[id].bestVisit || 0),
      bestCheckout: m(id => leg.byPlayer[id].bestCheckout || 0),
      coAtt: m(id => leg.byPlayer[id].checkoutAttempts || 0),
      coHit: m(id => leg.byPlayer[id].checkoutHits || 0),
    };
  }
  
  export function aggregateMatch(legs: LegStats[], players: PlayerLite[], matchId: ID, kind: string): MatchSummary {
    const by: Record<ID, { darts: number; visits: number; total: number; co: number }> = {};
    for (const p of players) by[p.id] = { darts: 0, visits: 0, total: 0, co: 0 };
  
    let winnerId: ID | undefined;
    for (const leg of legs) {
      if (leg.winnerId) winnerId = leg.winnerId;
      for (const pid of Object.keys(leg.byPlayer)) {
        const pl = leg.byPlayer[pid];
        by[pid].darts += pl.dartsThrown;
        by[pid].visits += pl.visits;
        by[pid].total += pl.avg3 * (pl.dartsThrown / 3);
        by[pid].co += pl.checkoutHits;
      }
    }
  
    const avg3ByPlayer: Record<ID, number> = {};
    for (const pid of Object.keys(by)) {
      const d = by[pid].darts || 1;
      const total = by[pid].total;
      avg3ByPlayer[pid] = (total / d) * 3;
    }
  
    const darts = Object.values(by).map(x => x.darts).reduce(sum, 0);
    return {
      id: matchId,
      kind,
      players,
      legs: legs.length,
      darts,
      winnerId: winnerId ?? null,
      avg3ByPlayer,
      co: Object.values(by).map(x => x.co).reduce(sum, 0),
    };
  }
  
  // Petit util pour % checkout
  export function checkoutRate(att: number, hit: number): number {
    const a = Math.max(0, att);
    const h = Math.max(0, hit);
    return a ? Math.round(clamp01(h / a) * 1000) / 10 : 0; // 1 décimale
  }
  