// ============================================
// src/lib/statsOnce.ts — Commit des stats "une seule fois" par leg
// ============================================
import { saveMatchStats } from "./stats";

type PlayerLite = { id: string; name: string };

const LS_COMMITTED = "dc5_stats_committed_leg_ids_v1";

function loadCommitted(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(LS_COMMITTED) || "{}");
  } catch {
    return {};
  }
}
function saveCommitted(map: Record<string, true>) {
  localStorage.setItem(LS_COMMITTED, JSON.stringify(map));
}

export function commitLegStatsOnce(opts: {
  legId: string;
  kind: string;
  finishedAt: number;
  players: PlayerLite[];
  winnerId?: string | null;
  perPlayer: Record<
    string,
    {
      dartsThrown?: number;
      pointsScored?: number;
      visits?: number;
      avg3?: number;
      bestVisit?: number;
      highestCheckout?: number;
      tons60?: number;
      tons100?: number;
      tons140?: number;
      ton180?: number;
      checkoutAttempts?: number;
      checkoutHits?: number;
      legsPlayed?: number;
      legsWon?: number;
    }
  >;
}) {
  const committed = loadCommitted();
  if (committed[opts.legId]) return;

  saveMatchStats({
    id: opts.legId,
    kind: opts.kind,
    finishedAt: opts.finishedAt,
    players: opts.players,
    winnerId: opts.winnerId ?? null,
    perPlayer: opts.perPlayer,
  });

  committed[opts.legId] = true;
  saveCommitted(committed);
}
