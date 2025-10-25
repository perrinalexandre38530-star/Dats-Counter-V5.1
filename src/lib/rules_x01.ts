import type { Dart, MatchHeader, MatchRecord, ID } from "./types";

// Basic X01 engine: supports start score (301/501/701/1001), straight/double-in (later),
// double-out option, bull 25/50 counted, bust rule.
export type X01Opts = {
  start: 301|501|701|1001;
  doubleOut: boolean;
};

export function createX01(players: ID[], opts: X01Opts): MatchRecord {
  const header: MatchHeader = {
    id: crypto.randomUUID(), mode:"X01", startedAt: Date.now(), players,
    meta:{ start:opts.start, doubleOut:opts.doubleOut, scores:Object.fromEntries(players.map(p=>[p,opts.start])), checkouts:{} }
  };
  return { header, rounds: [] };
}

export function applyX01Throw(match: MatchRecord, playerIndex: number, darts: Dart[]): { finished:boolean } {
  const pid = match.header.players[playerIndex];
  const scores = match.header.meta.scores as Record<ID, number>;
  let cur = scores[pid];
  const before = cur;

  // Compute visit
  const visit = darts.reduce((a,d)=>a + d.v * d.mult,0);

  // prospective
  let next = cur - visit;

  const isDO = !!match.header.meta.doubleOut;

  // Check busts / double-out legality
  const last = darts[darts.length-1];

  const validDoubleOut = !isDO || (next===0 && last && (last.mult===2 || last.v===25 && last.mult===2)); // D or Bull50 treated as double

  if (next < 0 || next === 1 || (next===0 && !validDoubleOut)) {
    // bust -> score resets to before visit
    next = before;
  }

  scores[pid] = next;

  if (next===0) {
    match.header.winner = pid;
    // save checkout sum
    const co = visit;
    match.header.meta.checkouts[pid] = Math.max(match.header.meta.checkouts[pid]||0, co);
    return { finished:true };
  }

  return { finished:false };
}
