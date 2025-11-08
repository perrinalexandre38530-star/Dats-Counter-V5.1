// ============================================
// src/lib/scanHistory.ts
// Lecture robuste de l'Historique + agrégats par joueur
// - Ne dépend PAS du moteur : tente plusieurs formes (summary, payload.legs, payload.summary, ...)
// - Retourne { matches, totalsByPlayer }
// ============================================
import { History } from "./history";

type Totals = {
  id: string;
  name: string;
  matches: number;
  wins: number;
  darts: number;
  points: number;
  visits: number;
  avg3: number;        // calculé
  bestVisit: number;
  bestCheckout: number;
  coHits: number;
};

type MatchRow = {
  id: string;
  date: number;
  winnerId: string | null;
  players: { id: string; name?: string }[];
  per: Record<string, {
    darts: number; points: number; visits: number;
    avg3: number; bestVisit: number; bestCheckout: number; coHits: number;
  }>;
};

function n(x: any, d = 0) { const v = Number(x); return Number.isFinite(v) ? v : d; }
function obj(o: any) { return (o && typeof o === "object") ? o : {}; }
function arr(a: any) { return Array.isArray(a) ? a : []; }

function pickPlayers(rec: any): { id: string; name?: string }[] {
  const ps = arr(rec.players);
  return ps.map((p: any) => ({ id: String(p.id || ""), name: p.name || "" }));
}

function fromSummary(rec: any): Record<string, any> | null {
  // essaie différentes places
  const s = obj(rec.summary) || obj(rec.payload?.summary);
  if (!s) return null;

  // format 1 : { avg3ByPlayer, darts, co }
  if (s.avg3ByPlayer || s.darts || s.co) {
    const per: Record<string, any> = {};
    const a3 = obj(s.avg3ByPlayer);
    const darts = obj(s.darts);
    const co = n(s.co, 0);
    const pids = new Set<string>([
      ...Object.keys(a3), ...Object.keys(darts)
    ]);
    for (const pid of pids) {
      const d = n(darts[pid]);
      const avg3 = n(a3[pid]);
      per[pid] = {
        darts: d,
        points: d ? Math.round((avg3 / 3) * d) : 0,
        visits: d ? Math.ceil(d / 3) : 0,
        avg3,
        bestVisit: n(s.bestVisit?.[pid]),
        bestCheckout: n(s.bestCheckout?.[pid]),
        coHits: pid in (s.coHits || {}) ? n(s.coHits[pid]) : 0,
      };
    }
    return per;
  }

  // format 2 : { perPlayer: [...] }
  if (Array.isArray(s.perPlayer)) {
    const per: Record<string, any> = {};
    for (const row of s.perPlayer) {
      const pid = String(row.playerId || row.id || "");
      if (!pid) continue;
      const darts = n(row.darts);
      const points = n(row.points);
      const avg3 = darts ? (points / darts) * 3 : n(row.avg3);
      per[pid] = {
        darts,
        points,
        visits: darts ? Math.ceil(darts / 3) : n(row.visits),
        avg3: Math.round((avg3 || 0) * 100) / 100,
        bestVisit: n(row.bestVisit),
        bestCheckout: n(row.bestCheckout),
        coHits: n(row.coHits || row.checkoutHits),
      };
    }
    return per;
  }

  return null;
}

function fromLegs(rec: any): Record<string, any> | null {
  const legs = arr(rec.payload?.legs);
  if (!legs.length) return null;
  const per: Record<string, { darts: number; points: number; visits: number; bestVisit: number; bestCheckout: number; coHits: number; }> = {};
  for (const leg of legs) {
    const rows = arr(leg.perPlayer);
    for (const r of rows) {
      const pid = String(r.playerId || "");
      if (!pid) continue;
      per[pid] ??= { darts: 0, points: 0, visits: 0, bestVisit: 0, bestCheckout: 0, coHits: 0 };
      per[pid].darts += n(r.darts);
      per[pid].points += n(r.points);
      per[pid].visits += n(r.visits) || (n(r.darts) ? Math.ceil(n(r.darts)/3) : 0);
      per[pid].bestVisit = Math.max(per[pid].bestVisit, n(r.bestVisit));
      per[pid].bestCheckout = Math.max(per[pid].bestCheckout, n(r.bestCheckout));
      per[pid].coHits += n(r.coHits || r.checkoutHits);
    }
  }
  return Object.fromEntries(Object.entries(per).map(([pid, v]) => {
    const avg3 = v.darts ? (v.points / v.darts) * 3 : 0;
    return [pid, { ...v, avg3: Math.round(avg3 * 100) / 100 }];
  }));
}

function fromVisits(rec: any): Record<string, any> | null {
  const visits = arr(rec.payload?.visits) || arr(rec.payload?.__visits) || arr(rec.__visits);
  if (!visits.length) return null;
  const per: Record<string, { darts: number; points: number; visits: number; bestVisit: number; bestCheckout: number; coHits: number; }> = {};
  for (const v of visits) {
    const pid = String(v.p || v.playerId || "");
    if (!pid) continue;
    per[pid] ??= { darts: 0, points: 0, visits: 0, bestVisit: 0, bestCheckout: 0, coHits: 0 };
    const score = n(v.score);
    const segs = Array.isArray(v.segments) ? v.segments : Array.isArray(v.darts) ? v.darts : [];
    per[pid].points += score;
    per[pid].darts += segs.length || 3; // approximation acceptable si non fourni
    per[pid].visits += 1;
    per[pid].bestVisit = Math.max(per[pid].bestVisit, score);
    if (v.isCheckout) {
      // bestCheckout inconnu → on ne le connaît pas sur visits bruts; on compte juste coHits
      per[pid].coHits += 1;
    }
  }
  return Object.fromEntries(Object.entries(per).map(([pid, v]) => {
    const avg3 = v.darts ? (v.points / v.darts) * 3 : 0;
    return [pid, { ...v, avg3: Math.round(avg3 * 100) / 100 }];
  }));
}

function extractPer(rec: any): Record<string, any> {
  return (
    fromSummary(rec) ||
    fromLegs(rec) ||
    fromVisits(rec) ||
    {}
  );
}

export async function deriveFromHistory() {
  // 1) Récupère tous les enregistrements
  let all: any[] = [];
  try {
    all = (await History.list()) || [];
  } catch {
    // fallback sync si dispo
    all = (History as any).readAll?.() || [];
  }

  // 2) Ne garde que les matchs X01 “finished”
  const matches: MatchRow[] = [];
  for (const rec of all) {
    if (!rec || rec.kind !== "x01" || rec.status !== "finished") continue;
    const per = extractPer(rec);
    const rows: MatchRow = {
      id: String(rec.id || ""),
      date: n(rec.updatedAt || rec.createdAt || Date.now()),
      winnerId: rec.winnerId ?? null,
      players: pickPlayers(rec),
      per,
    };
    matches.push(rows);
  }

  // 3) Agrégats par joueur
  const totalsByPlayer: Record<string, Totals> = {};
  for (const m of matches) {
    const pids = Object.keys(m.per);
    for (const pid of pids) {
      const base = m.per[pid] || {};
      totalsByPlayer[pid] ??= {
        id: pid, name: m.players.find(p => p.id === pid)?.name || "?", matches: 0, wins: 0,
        darts: 0, points: 0, visits: 0, avg3: 0, bestVisit: 0, bestCheckout: 0, coHits: 0
      };
      const t = totalsByPlayer[pid];
      t.matches += 1;
      if (m.winnerId === pid) t.wins += 1;
      t.darts += n(base.darts);
      t.points += n(base.points);
      t.visits += n(base.visits);
      t.bestVisit = Math.max(t.bestVisit, n(base.bestVisit));
      t.bestCheckout = Math.max(t.bestCheckout, n(base.bestCheckout));
      t.coHits += n(base.coHits);
    }
  }
  for (const t of Object.values(totalsByPlayer)) {
    t.avg3 = t.darts ? Math.round(((t.points / t.darts) * 3) * 100) / 100 : 0;
  }

  // tri des matchs récents
  matches.sort((a, b) => b.date - a.date);

  return { matches, totalsByPlayer };
}
