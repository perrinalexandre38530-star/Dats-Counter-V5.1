// ============================================
// src/lib/matchPersistence.ts — Autosave exhaustif + finalisation
// - Enregistre TOUT : visits, turns, scores, per-player, events...
// - Ecrit dans l'historique en continu (status = in_progress)
// - N'écrit les STATS JOUEUR GLOBALES qu'à la fin (status = finished)
// ============================================

import { History } from "./history";
import { commitPlayerStatsOnFinish } from "./playerStats"; // voir fichier 2

/* --------- Types --------- */
type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };

export type AutosaveInit = {
  kind: "x01" | "cricket" | "killer" | "shanghai";
  matchId: string;          // id logique de la partie
  resumeId: string;         // id de reprise (engine)
  game: { mode: string; startScore?: number; doubleOut?: boolean };
  players: PlayerLite[];

  // facultatif
  createdAt?: number;
};

export type Visit = {
  // Une volée de 3 flèches max dans l’ordre réel
  at: number;               // timestamp
  by: string;               // playerId
  darts: Array<{ mult: 1 | 2 | 3; value: 0 | 1|2|...|20 | 25 | 50 }>;
  score: number;            // total de la volée
  bust?: boolean;
};

export type RuntimeState = {
  // état compact pour reprendre la partie
  order: string[];          // ordre des joueurs (ids)
  currentThrow?: Visit | null;
  remaining?: Record<string, number>; // restes par joueur
  legNumber?: number;
  setNumber?: number;
};

export type PartialCounters = {
  // stats partielles pour l’écran en cours
  perPlayer?: Record<string, {
    darts?: number;
    visits?: number;
    bestVisit?: number;
    bestCheckout?: number;
    avg3?: number;
    buckets?: Record<"0-59"|"60-99"|"100+"|"140+"|"180", number>;
    doublesPct?: number;
    triplesPct?: number;
    bulls?: number;   // 25
    dbulls?: number;  // 50
    sixtyPlus?: number;
    hundredPlus?: number;
    oneFortyPlus?: number;
    oneEighty?: number;
  }>;
  // tu peux ajouter ce dont tu as besoin
};

export type FinishSnapshot = {
  winnerId?: string | null;
  endOverlayProps?: any;    // props sérialisables pour X01End
  // stats finales agrégées lisibles par Stats/History
  summary: {
    perPlayer: Record<string, {
      darts: number;
      visits: number;
      avg3: number;
      bestVisit: number;
      bestCheckout?: number;
      doublesPct?: number;
      triplesPct?: number;
      bulls?: number;
      dbulls?: number;
      sixtyPlus?: number;
      hundredPlus?: number;
      oneFortyPlus?: number;
      oneEighty?: number;
    }>;
    result?: any;           // classement/ordre si tu l’as
  };
};

/* --------- Utils internes --------- */
const now = () => Date.now();

/* --------- API publique --------- */

/** Crée immédiatement un enregistrement "in_progress" dans l'historique. */
export async function beginMatch(init: AutosaveInit) {
  const t = init.createdAt ?? now();
  await History.upsert({
    id: init.matchId,
    resumeId: init.resumeId,
    kind: init.kind,
    status: "in_progress",
    createdAt: t,
    updatedAt: t,
    players: init.players,
    game: init.game,

    // résumé minimal pour l’historique sans ouvrir payload
    summary: {
      resumeId: init.resumeId,
      startedAt: t,
      finished: false,
    },

    // payload complet (gros volume autorisé ici)
    payload: {
      visits: [] as Visit[],
      turns: [] as string[],     // ids dans l’ordre joué (optionnel)
      state: {} as RuntimeState,  // reprise minimale
      counters: {} as PartialCounters,
    },
  });
}

/** Ajoute une volée (visit) et met à jour l’état courant (reprise). */
export async function pushVisit(
  matchId: string,
  visit: Visit,
  nextState?: Partial<RuntimeState>,
  partial?: PartialCounters
) {
  await History.upsert({
    id: matchId,
    updatedAt: now(),
    status: "in_progress",
    // On stocke tout dans payload
    payload: {
      $append: { visits: [visit] },     // NB: History.upsert doit gérer $append (sinon recompose côté lib)
      state: nextState ? { ...(nextState as any) } : undefined,
      counters: partial ? { ...(partial as any) } : undefined,
    },
    // Redondance utile pour la liste Historique (lecture rapide)
    summary: partial ? { ...(partial as any), finished: false } : { finished: false },
  });
}

/** Sauvegarde un "delta" d’état sans visit (ex: annulation, reorder, etc.). */
export async function saveRuntime(
  matchId: string,
  nextState: Partial<RuntimeState>,
  partial?: PartialCounters
) {
  await History.upsert({
    id: matchId,
    updatedAt: now(),
    status: "in_progress",
    payload: {
      state: { ...(nextState as any) },
      counters: partial ? { ...(partial as any) } : undefined,
    },
    summary: partial ? { ...(partial as any), finished: false } : { finished: false },
  });
}

/** Finalise la partie : écrit l’overlay/summary et bascule en finished.
 *  ⚠️ Déclenche l’écriture des STATS JOUEUR GLOBALES (une seule fois). */
export async function finishMatch(
  matchId: string,
  resumeId: string,
  players: PlayerLite[],
  finish: FinishSnapshot
) {
  const t = now();

  await History.upsert({
    id: matchId,
    updatedAt: t,
    status: "finished",
    winnerId: finish.winnerId ?? null,

    summary: {
      resumeId,
      finished: true,
      finishedAt: t,
      winnerId: finish.winnerId ?? null,
      ...finish.summary,              // lisible par History/Stats
      endOverlayProps: finish.endOverlayProps ?? null,
    },

    payload: {
      endOverlayProps: finish.endOverlayProps ?? null,
      finalSummary: finish.summary,   // copie claire
    },
  });

  // 👉 C’est ici, et UNIQUEMENT ici, que l’on comptabilise les stats globales
  await commitPlayerStatsOnFinish(players, finish.summary);
}

/** Helper : lit un record par resumeId (utile Reprise) */
export async function getByResumeId(resumeId: string) {
  if (typeof (History as any).getByResumeId === "function") {
    return (History as any).getByResumeId(resumeId);
  }
  const list = await History.list();
  return list.find(
    (e: any) =>
      e?.resumeId === resumeId ||
      e?.summary?.resumeId === resumeId ||
      e?.payload?.resumeId === resumeId
  );
}
