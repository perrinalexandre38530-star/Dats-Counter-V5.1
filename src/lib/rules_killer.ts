import type { Dart, MatchHeader, MatchRecord, ID } from "./types";

// Killer (classique) : chacun reçoit un numéro aléatoire 1..20, doit toucher D de son numéro pour devenir Killer,
// puis chaque D de ce numéro sur un adversaire lui retire une vie. Dernier vivant gagne.
export type KillerMeta = {
  number: Record<ID, number>;
  lives: Record<ID, number>;
  killer: Record<ID, boolean>;
};

export function createKiller(players: ID[]): MatchRecord {
  const number: Record<ID, number> = {};
  const lives: Record<ID, number> = {};
  const killer: Record<ID, boolean> = {};
  for (const p of players) {
    number[p] = 1 + Math.floor(Math.random()*20);
    lives[p] = 3;
    killer[p] = false;
  }
  const header: MatchHeader = {
    id: crypto.randomUUID(), mode:"Killer", startedAt: Date.now(), players,
    meta: { number, lives, killer }
  };
  return { header, rounds: [] };
}

export function applyKillerThrow(match: MatchRecord, playerIndex: number, darts: Dart[]): { finished:boolean } {
  const pid = match.header.players[playerIndex];
  const M = match.header.meta as KillerMeta;

  for (const d of darts) {
    // devenir killer ?
    if (!M.killer[pid]) {
      if (d.v===M.number[pid] && d.mult===2) M.killer[pid]=true;
      continue;
    }
    // tuer un autre ?
    for (const op of match.header.players) {
      if (op===pid) continue;
      if (d.v===M.number[op] && d.mult===2 && M.lives[op]>0) {
        M.lives[op] -= 1;
      }
    }
  }
  const alive = match.header.players.filter(p => M.lives[p]>0);
  if (alive.length===1) {
    match.header.winner = alive[0];
    return { finished:true };
  }
  return { finished:false };
}
