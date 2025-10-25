import type { Dart, MatchHeader, MatchRecord, ID } from "./types";

// Shanghai : 1 manche par numéro (1..20 puis bull optionnel). On marque S/D/T * numéro.
// "Shanghai" = S, D, T du numéro dans la même volée -> victoire immédiate.
export function createShanghai(players: ID[]): MatchRecord {
  const header: MatchHeader = {
    id: crypto.randomUUID(), mode:"Shanghai", startedAt: Date.now(), players,
    meta:{ round:1, points:Object.fromEntries(players.map(p=>[p,0])) }
  };
  return { header, rounds: [] };
}

export function applyShanghaiThrow(match: MatchRecord, playerIndex: number, darts: Dart[]): { finished:boolean } {
  const pid = match.header.players[playerIndex];
  const R = match.header.meta as any;
  const n = R.round; // target number

  let hits = new Set<number>(); // 1,2,3 marks types
  let add = 0;
  for (const d of darts) {
    if (d.v===n) {
      add += d.v * d.mult;
      hits.add(d.mult);
    }
  }
  R.points[pid] += add;

  if (hits.has(1) && hits.has(2) && hits.has(3)) {
    match.header.winner = pid; // Shanghai instantané
    return { finished:true };
  }

  // fin de manche: on avance la cible au changement de joueur géré côté UI
  // victoire finale: après round 20, plus haut score gagne
  if (R.round>20) {
    const entries = Object.entries(R.points) as [ID,number][];
    entries.sort((a,b)=>b[1]-a[1]);
    match.header.winner = entries[0]?.[0] ?? null;
    return { finished:true };
  }
  return { finished:false };
}
