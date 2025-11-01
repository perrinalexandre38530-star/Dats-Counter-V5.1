// ============================================
// src/lib/matchStats.ts — Journal simple des parties finies (localStorage)
// N'INTERFÈRE PAS avec tes stats profils existantes.
// ============================================

export type PlayerRef = { id: string; name: string };

export type X01LegSnapshot = {
  id: string;                       // uid
  kind: "x01";
  legNo: number;
  finishedAt: number;
  winnerId: string | null;
  players: PlayerRef[];
  // Stats "snapshot" par joueur au moment de la fin
  perPlayer: Record<string, {
    darts: number;
    visits: number;
    avg3: number;           // moyenne/3 de la manche
    pointsScored: number;   // visits * avg3 (arrondi)
    bestVisit: number;
    bestCheckout: number;
    remaining: number;
  }>;
};

type StoreShape = {
  list: X01LegSnapshot[];
};

const KEY = "dc5:match-log";

function readStore(): StoreShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { list: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.list)) return { list: [] };
    return parsed as StoreShape;
  } catch {
    return { list: [] };
  }
}

function writeStore(s: StoreShape) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

function uid() {
  // pas de dépendance crypto obligatoire
  return "mx-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/** Ajoute un enregistrement X01 depuis un LegResult-like,
 *  sans rien casser côté profils (lecture isolée).
 */
export function pushFromLeg(result: any, players: PlayerRef[]) {
  // Sécurisation des champs usuels du LegResult
  const legNo = Number(result?.legNo ?? 1);
  const finishedAt = Number(result?.finishedAt ?? Date.now());
  const winnerId = (result?.winnerId ?? null) as string | null;

  const darts = (result?.darts ?? {}) as Record<string, number>;
  const visits = (result?.visits ?? {}) as Record<string, number>;
  const avg3   = (result?.avg3   ?? {}) as Record<string, number>;
  const bestVisit    = (result?.bestVisit    ?? {}) as Record<string, number>;
  const bestCheckout = (result?.bestCheckout ?? {}) as Record<string, number>;
  const remaining    = (result?.remaining    ?? {}) as Record<string, number>;

  const perPlayer: X01LegSnapshot["perPlayer"] = {};
  const ids = new Set<string>([
    ...Object.keys(darts),
    ...Object.keys(visits),
    ...Object.keys(avg3),
    ...Object.keys(bestVisit),
    ...Object.keys(bestCheckout),
    ...Object.keys(remaining),
    ...players.map(p => p.id),
  ]);

  ids.forEach(pid => {
    const d = Number(darts[pid] ?? 0);
    const v = Number(visits[pid] ?? Math.ceil(d / 3));
    const a = Number(avg3[pid] ?? 0);
    const pts = Math.round(a * v);
    perPlayer[pid] = {
      darts: d,
      visits: v,
      avg3: a,
      pointsScored: pts,
      bestVisit: Number(bestVisit[pid] ?? 0),
      bestCheckout: Number(bestCheckout[pid] ?? 0),
      remaining: Number(remaining[pid] ?? 0),
    };
  });

  const rec: X01LegSnapshot = {
    id: uid(),
    kind: "x01",
    legNo,
    finishedAt,
    winnerId,
    players: players.map(p => ({ id: p.id, name: p.name })),
    perPlayer,
  };

  const s = readStore();
  // dédupe par (finishedAt + legNo + players hash) pour éviter doublons
  const keySig = (r: X01LegSnapshot) =>
    `${r.kind}|${r.legNo}|${r.finishedAt}|${r.players.map(p => p.id).join(",")}`;

  const sigNew = keySig(rec);
  const list = s.list.filter(r => keySig(r) !== sigNew);
  list.unshift(rec);
  // on limite l’historique local à 200 entrées max
  s.list = list.slice(0, 200);
  writeStore(s);
}

/** Liste (du + récent au + ancien) */
export function list(): X01LegSnapshot[] {
  return readStore().list;
}

/** Récupération par id */
export function get(id: string): X01LegSnapshot | undefined {
  return readStore().list.find(r => r.id === id);
}

/** Purge manuelle (optionnel) */
export function clearAll() {
  writeStore({ list: [] });
}
