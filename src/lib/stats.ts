import type { MatchRecord, Profile, Store, GameMode } from "./types";

export function computeStats(store: Store, profileId: string) {
  const games = store.history.filter(h => h.header.players.includes(profileId));
  let darts=0, scoreSum=0, wins=0, legs=games.length, bestVisit=0, bestCheckout=0;

  for (const g of games) {
    const idx = g.header.players.indexOf(profileId);
    let gamePoints = 0;
    for (const r of g.rounds) {
      const t = r[idx] || [];
      darts += t.length;
      const roundSum = t.reduce((a,d)=>a+d.v*d.mult,0);
      gamePoints += roundSum;
      if (roundSum>bestVisit) bestVisit = roundSum;
    }
    if (g.header.mode==="X01") {
      // naive checkout from meta.track if provided
      const ch = g.header.meta?.checkouts?.[profileId] || 0;
      if (ch>bestCheckout) bestCheckout=ch;
    }
    if (g.header.winner===profileId) wins++;
    scoreSum += gamePoints;
  }
  const avg3 = darts? (scoreSum/darts)*3 : 0;
  const winRate = legs? wins/legs : 0;

  return {
    games: legs,
    wins,
    winRate,
    avg3: Number(avg3.toFixed(2)),
    bestVisit,
    bestCheckout,
  };
}

export function summarizeModes(store: Store, mode?: GameMode){
  const list = store.history.filter(h=>!mode || h.header.mode===mode);
  return { total: list.length };
}
