// ============================================
// src/lib/statsOnce.ts — commit des stats "une seule fois" par leg
// ============================================

const LS_COMMITTED = "dc5_stats_committed_leg_ids_v1";

type Recording = Record<string, true>;

function loadCommitted(): Recording {
  try {
    return JSON.parse(localStorage.getItem(LS_COMMITTED) || "{}");
  } catch {
    return {};
  }
}

function saveCommitted(map: Recording, flush = true) {
  if (flush) localStorage.setItem(LS_COMMITTED, JSON.stringify(map));
}

export function commitLegStatsOnce(opts: {
  kind: string;            // "x01" / "cricket" / ...
  finishedAt: number;      // Date.now() quand le leg se termine
  players: { id: string }[];
  winnerId?: string | null;
  perPlayer?: Record<string, any>; // stats déjà prêtes si besoin
  legKey?: string;         // clé stable si tu en as une; sinon auto
}) {
  const map = loadCommitted();

  // Fabrique une clé stable pour ce leg, ex:
  const key =
    opts.legKey ??
    `${opts.kind}#${opts.winnerId ?? "?"}#${opts.finishedAt}`;

  if (map[key]) {
    // déjà comptabilisé → on ne refait rien
    return { committed: false, key };
  }

  // Ici tu peux envoyer l’événement vers un agrégateur global si tu veux
  // (ex: incrémenter des compteurs par profil). Pour l’instant on se contente
  // de marquer le leg comme compté.

  map[key] = true;
  saveCommitted(map, true);
  return { committed: true, key };
}
