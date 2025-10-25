import type { Dart, MatchHeader, MatchRecord, ID } from "./types";

// Simple Standard Cricket: numbers 15..20 + Bull (25/50). Close a number with 3 marks.
// Doubles=2 marks, Triples=3 marks. After closing, hitting adds points unless opponent also closed.
export function createCricket(players: ID[]): MatchRecord {
  const header: MatchHeader = {
    id: crypto.randomUUID(), mode:"Cricket", startedAt: Date.now(), players,
    meta:{
      marks:Object.fromEntries(players.map(p=>[p, Object.fromEntries([...Array(6)].map((_,i)=>[15+i,0])).concat([[25,0]]) ])),
      points:Object.fromEntries(players.map(p=>[p,0]))
    }
  };
  return { header, rounds: [] };
}

export function applyCricketThrow(match: MatchRecord, playerIndex: number, darts: Dart[]): { finished:boolean } {
  const pid = match.header.players[playerIndex];
  const marks: Record<ID, Record<number, number>> = match.header.meta.marks;
  const points: Record<ID, number> = match.header.meta.points;

  const nums = [15,16,17,18,19,20,25];

  for (const d of darts) {
    let target = d.v;
    if (target===50) target=25; // bull counts as 25 line
    if (!nums.includes(target)) continue;

    const addMarks = d.mult===3?3: d.mult===2?2: 1;
    const selfMarks = marks[pid];
    const before = selfMarks[target];
    const now = Math.min(3, before + addMarks);
    selfMarks[target] = now;

    const closedSelf = now===3;
    const othersClosed = match.header.players.every(p => marks[p][target]===3);

    if (before===3) {
      // already closed -> scoring if others not closed
      if (!othersClosed) points[pid] += addMarks * (target===25 ? 25 : target);
    } else if (closedSelf && !othersClosed) {
      // extra marks overflow into points
      const overflow = before + addMarks - 3;
      if (overflow>0) points[pid] += overflow * (target===25 ? 25 : target);
    }
  }

  // win if closed all and has >= max points of others
  const selfClosedAll = nums.every(n => marks[pid][n]===3);
  const maxOtherPts = Math.max(...match.header.players.filter(p=>p!==pid).map(p=>points[p]), 0);
  if (selfClosedAll && points[pid] >= maxOtherPts) {
    match.header.winner = pid;
    return { finished:true };
  }
  return { finished:false };
}
