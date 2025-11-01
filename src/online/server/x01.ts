import type { PlayerId, X01Match } from "../shared/types";

export function createX01(startScore: number, order: {id: PlayerId; name: string}[]): X01Match {
  const remaining: Record<PlayerId, number> = {};
  const visits: Record<PlayerId, number[][]> = {};
  for (const p of order) { remaining[p.id] = startScore; visits[p.id] = []; }
  return {
    game: "x01",
    startScore,
    players: order,
    turn: order[0].id,
    remaining,
    visits,
    legNo: 1,
    finished: null
  };
}

function nextPlayerId(match: X01Match): PlayerId {
  const ids = match.players.map(p => p.id);
  const i = ids.indexOf(match.turn);
  return ids[(i + 1) % ids.length];
}

// Règles minimales X01 : on valide le score proposé, bust si négatif ou si passe à 1.
// Double-out non appliqué ici (tu pourras l’ajouter facilement).
export function applyVisit(match: X01Match, playerId: PlayerId, darts: number[]): X01Match {
  if (match.finished) return match;
  if (playerId !== match.turn) return match;

  const sum = darts.reduce((a,b)=>a+b,0);
  const current = match.remaining[playerId];
  const next = current - sum;

  // Bust si < 0 ou == 1
  if (next < 0 || next === 1) {
    match.visits[playerId].push(darts);
    match.turn = nextPlayerId(match);
    return match;
  }

  // Win si == 0 (pas de double-out dans cette V1)
  if (next === 0) {
    match.visits[playerId].push(darts);
    match.remaining[playerId] = 0;
    const order = computeOrder(match);
    match.finished = { winnerId: playerId, order };
    return match;
  }

  match.remaining[playerId] = next;
  match.visits[playerId].push(darts);
  match.turn = nextPlayerId(match);
  return match;
}

export function undoLast(match: X01Match): X01Match {
  if (match.finished) { match.finished = null; }
  // On recalcule tout depuis les visits (approche sûre)
  const startScore = match.startScore;
  const order = match.players.map(p => p.id);

  for (const p of order) {
    match.remaining[p] = startScore;
  }

  const flat: {pid: PlayerId; darts: number[]}[] = [];
  // Construire la séquence des visites dans l’ordre des tours
  const maxLen = Math.max(...order.map(pid => match.visits[pid].length));
  for (let i=0;i<maxLen;i++){
    for (const pid of order){
      const v = match.visits[pid][i];
      if (v) flat.push({pid, darts: v});
    }
  }
  // Supprimer la dernière
  flat.pop();

  // Réinitialiser
  for (const pid of order) match.visits[pid] = [];
  match.turn = order[0];

  // Rejouer tout
  for (const step of flat) applyVisit(match, step.pid, step.darts);

  return match;
}

function computeOrder(match: X01Match): PlayerId[] {
  // Classement par score restant (0 d’abord), puis par nombre de visites (moins = mieux)
  const ids = match.players.map(p=>p.id);
  return ids.sort((a,b)=>{
    const ra = match.remaining[a];
    const rb = match.remaining[b];
    if (ra === 0 && rb !== 0) return -1;
    if (rb === 0 && ra !== 0) return 1;
    if (ra !== rb) return ra - rb;
    const va = match.visits[a].length;
    const vb = match.visits[b].length;
    return va - vb;
  });
}
