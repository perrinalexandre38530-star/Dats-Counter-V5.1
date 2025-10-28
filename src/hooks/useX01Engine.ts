// ============================================
// src/hooks/useX01Engine.ts
// X01 engine wrapper: playTurn + safe BUST + CONTINUER + stats exclusives
// + SKIP auto des joueurs terminés (score = 0)
// + Reprise sûre depuis snapshot (hydrateFromSnapshot)
// ============================================
import * as React from "react";
import type {
  Profile,
  Throw as UIThrow,
  MatchRecord,
  Dart as UIDart,
  FinishPolicy,
  LegResult,
  X01Snapshot
} from "../lib/types";
import type { MatchRules, GameDart, Player } from "../lib/types-game";
import { getEngine } from "../lib/gameEngines";

/* -------- utils mapping -------- */
function toPlayersFromIds(profiles: Profile[], ids: string[]): Player[] {
  const map = new Map(profiles.map((p) => [p.id, p]));
  return (ids || [])
    .map((id) => map.get(id))
    .filter((p): p is Profile => !!p)
    .map((p) => ({ id: p.id, name: p.name || "Player" }));
}
function uiToGameDarts(throwUI: UIThrow): GameDart[] {
  return (throwUI || []).slice(0, 3).map((d) => {
    if (!d || d.v === 0) return { bed: "MISS" };
    if (d.v === 25 && d.mult === 2) return { bed: "IB" }; // 50
    if (d.v === 25) return { bed: "OB" }; // 25
    const number = Math.max(1, Math.min(20, Math.floor(d.v)));
    const bed = d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S";
    return { bed, number };
  });
}
function gameToUIDart(d: GameDart): UIDart {
  if (d.bed === "MISS") return { v: 0, mult: 1, label: "MISS" };
  if (d.bed === "OB") return { v: 25, mult: 1, label: "OB" };
  if (d.bed === "IB") return { v: 25, mult: 2, label: "IB" };
  const mult = d.bed === "T" ? 3 : d.bed === "D" ? 2 : 1;
  return { v: d.number ?? 0, mult };
}
function makeId() {
  return (
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
  );
}

/* -------- record builder -------- */
function buildMatchRecordX01(params: {
  state: any;
  startedAt: number;
}): MatchRecord {
  const { state, startedAt } = params;
  const players: Player[] = state.players;
  const perTurn: Array<{ playerId: string; darts: GameDart[] }> =
    state.history || [];

  const rounds: Array<UIThrow[]> = [];
  let currentRound: Record<string, UIThrow> = {};

  for (const t of perTurn) {
    currentRound[t.playerId] = (t.darts || []).map(gameToUIDart);
    const filled = players.every((p) => currentRound[p.id] !== undefined);
    if (filled) {
      rounds.push(players.map((p) => currentRound[p.id] || []));
      currentRound = {};
    }
  }

  const winner = players.find((p) => state.table[p.id]?.score === 0) || null;

  return {
    header: {
      id: makeId(),
      mode: "X01",
      startedAt,
      players: players.map((p) => p.id),
      winner: winner ? winner.id : null,
      meta: { rules: state.rules, endedAt: state.endedAt ?? Date.now() },
    },
    rounds,
  };
}

/* -------- bust helpers -------- */
function dartPoints(d: UIDart): number {
  if (!d) return 0;
  if (d.v === 25 && d.mult === 2) return 50;
  return d.v * d.mult;
}

// ✅ one-left bust seulement si doubleOut actif
function wouldBust(
  state: any,
  dartsUI: UIThrow
): { bust: boolean; reason: "over" | "oneLeft" | "needDouble" | null } {
  const idx = state.currentPlayerIndex ?? 0;
  const players: Player[] = state.players || [];
  if (!players.length || idx < 0 || idx >= players.length) {
    // état incomplet => ne pas considérer bust pour éviter un crash
    return { bust: false, reason: null };
  }
  const p = players[idx];
  const remaining = state.table?.[p.id]?.score ?? 0;
  const sum = (dartsUI || []).reduce((s, d) => s + dartPoints(d), 0);
  const after = remaining - sum;
  const doubleOut = !!state.rules?.doubleOut;

  if (after < 0) return { bust: true, reason: "over" };
  if (doubleOut && after === 1) return { bust: true, reason: "oneLeft" };
  if (after === 0 && doubleOut) {
    const last = (dartsUI || []).slice().reverse().find(Boolean);
    if (!last || last.mult !== 2) return { bust: true, reason: "needDouble" };
  }
  return { bust: false, reason: null };
}

/* -------- NEW: agrégats & LegResult -------- */
function dartPointsGame(d: GameDart): number {
  if (!d) return 0 as never;
  if (d.bed === "MISS") return 0;
  if (d.bed === "OB") return 25;
  if (d.bed === "IB") return 50;
  const mult = d.bed === "T" ? 3 : d.bed === "D" ? 2 : 1;
  return (d.number ?? 0) * mult;
}

type HitsBySector = Record<string, number>; // S20/D20/T20... S1/D1/T1, OB/IB/MISS

/**
 * Agrégats de manche (volée = unité) :
 * - Moy/3D = moyenne des points PAR VOLÉE (pas par fléchette)
 * - bins exclusifs 60+/100+/140+/180 (une volée = un seul bin)
 * - séries pour onglets Volées / Checkouts / Hits secteur
 */
function computeLegAggFromHistory(state: any) {
  const players: Player[] = state.players || [];
  const hist: Array<{ playerId: string; darts: GameDart[] }> =
    state.history || [];

  const darts: Record<string, number> = {};
  const visits: Record<string, number> = {};
  const bestVisit: Record<string, number> = {};
  const bestCheckout: Record<string, number | null> = {};
  const x180: Record<string, number> = {};
  const doubles: Record<string, number> = {};
  const triples: Record<string, number> = {};
  const bulls: Record<string, number> = {};

  // Nouveaux jeux pour les onglets
  const visitSumsByPlayer: Record<string, number[]> = {}; // Volées (scores par volée)
  const checkoutDartsByPlayer: Record<string, number[]> = {}; // Nb de fléchettes quand CO réussi
  const hitsBySector: Record<string, HitsBySector> = {}; // Histogramme secteurs

  // bins EXCLUSIFS
  const h60: Record<string, number> = {};
  const h100: Record<string, number> = {};
  const h140: Record<string, number> = {};
  const h180: Record<string, number> = {};

  const sumPointsByVisit: Record<string, number> = {};

  // init
  for (const p of players) {
    darts[p.id] = 0;
    visits[p.id] = 0;
    bestVisit[p.id] = 0;
    bestCheckout[p.id] = null;
    x180[p.id] = 0;
    doubles[p.id] = 0;
    triples[p.id] = 0;
    bulls[p.id] = 0;
    visitSumsByPlayer[p.id] = [];
    checkoutDartsByPlayer[p.id] = [];
    hitsBySector[p.id] = {};
    h60[p.id] = 0;
    h100[p.id] = 0;
    h140[p.id] = 0;
    h180[p.id] = 0;
    sumPointsByVisit[p.id] = 0;
  }

  const startScore = state.rules?.startingScore ?? 501;
  const runningScores: Record<string, number> = Object.fromEntries(
    players.map((p) => [p.id, startScore])
  );

  const markHit = (pid: string, d: GameDart) => {
    let key = "MISS";
    if (d.bed === "OB" || d.bed === "IB") key = d.bed;
    else if (d.bed === "S" || d.bed === "D" || d.bed === "T")
      key = `${d.bed}${d.number ?? 0}`; // <-- backticks OK
    hitsBySector[pid][key] = (hitsBySector[pid][key] || 0) + 1;
  };

  for (const t of hist) {
    const pid = t.playerId;
    const arr = (t.darts || []).slice(0, 3);
    let volSum = 0;

    visits[pid] += 1;
    darts[pid] += arr.length;

    for (const d of arr) {
      markHit(pid, d);
      const pts = dartPointsGame(d);
      volSum += pts;
      if (d.bed === "D") doubles[pid] += 1;
      if (d.bed === "T") triples[pid] += 1;
      if (d.bed === "OB" || d.bed === "IB") bulls[pid] += 1;
    }

    // bins exclusifs par volée
    if (arr.length === 3 && volSum === 180) {
      h180[pid] += 1;
      x180[pid] += 1;
    } else if (volSum >= 140) h140[pid] += 1;
    else if (volSum >= 100) h100[pid] += 1;
    else if (volSum >= 60) h60[pid] += 1;

    bestVisit[pid] = Math.max(bestVisit[pid], volSum);
    sumPointsByVisit[pid] += volSum;
    visitSumsByPlayer[pid].push(volSum);

    const before = runningScores[pid];
    let after = before - volSum;

    const doubleOut = !!state.rules?.doubleOut;
    const bust = after < 0 || (doubleOut && after === 1);
    if (bust) {
      after = before; // bust: le score reste
    } else if (after === 0) {
      // checkout réussi: on enregistre le nb de fléchettes utilisées
      checkoutDartsByPlayer[pid].push(arr.length);
      bestCheckout[pid] = Math.max(bestCheckout[pid] ?? 0, volSum);
    }
    runningScores[pid] = after;
  }

  // Moyenne PAR VOLÉE (affichée comme “Moy/3”)
  const avg3: Record<string, number> = {};
  for (const p of players) {
    avg3[p.id] = visits[p.id]
      ? Math.round((sumPointsByVisit[p.id] / visits[p.id]) * 100) / 100
      : 0;
  }

  return {
    darts,
    visits,
    bestVisit,
    bestCheckout,
    x180,
    doubles,
    triples,
    bulls,
    avg3,
    // onglets :
    visitSumsByPlayer,
    checkoutDartsByPlayer,
    hitsBySector,
    // bins exclusifs :
    h60,
    h100,
    h140,
    h180,
  };
}

/* -------- policy normalizer -------- */
function normalizePolicy(
  p: FinishPolicy | string | undefined
): "firstToZero" | "continueToPenultimate" {
  if (!p) return "firstToZero";
  if (p === "continueToPenultimate" || p === "continueUntilPenultimate")
    return "continueToPenultimate";
  return "firstToZero";
}

/* ===== Helpers SKIP joueurs finis ===== */
function isFinished(state: any, playerId: string) {
  return (state.table?.[playerId]?.score ?? 1) === 0;
}
function nextAliveIndex(state: any, fromIndex: number) {
  const n = state.players?.length ?? 0;
  if (!n) return 0;
  let i = fromIndex;
  for (let step = 0; step < n; step++) {
    i = (i + 1) % n;
    const pid = state.players[i].id;
    if (!isFinished(state, pid)) return i;
  }
  return fromIndex; // tout le monde est fini
}
function ensureActiveIsAlive(state: any) {
  const idx = state.currentPlayerIndex ?? 0;
  const pid = state.players?.[idx]?.id;
  if (!pid) return state;
  if (isFinished(state, pid)) {
    return { ...state, currentPlayerIndex: nextAliveIndex(state, idx) };
  }
  return state;
}

/* ===== Hydratation depuis snapshot ===== */
function hydrateFromSnapshot(
  engine: any,
  snap: X01Snapshot,
  players: Player[],
  rules: MatchRules
) {
  // 1) base propre du moteur
  let s = engine.initGame(players, rules);

  // 2) scores, index joueur courant
  const ids = players.map((p) => p.id);
  for (let i = 0; i < ids.length; i++) {
    const pid = ids[i];
    const score = snap.scores?.[i];
    if (typeof score === "number" && s.table?.[pid]) {
      s.table[pid].score = score;
    }
  }
  if (typeof snap.currentIndex === "number") {
    s.currentPlayerIndex = Math.max(0, Math.min(ids.length - 1, snap.currentIndex));
  }
  if (Array.isArray(snap.dartsThisTurn)) {
    // On ne pousse rien dans l’historique (on ne sait pas si c’était validé)
    s.turnIndex = 0;
  }

  // 3) drapeaux règles (double-out etc.)
  if (s.rules) {
    (s.rules as any).startingScore = snap.rules?.startScore ?? rules.startingScore;
    (s.rules as any).doubleOut = !!snap.rules?.doubleOut;
  }

  return s;
}

/* -------- hook -------- */
export function useX01Engine(args: {
  profiles: Profile[];
  playerIds: string[];
  start: 301 | 501 | 701 | 1001;
  doubleOut: boolean;
  onFinish: (m: MatchRecord) => void;
  finishPolicy?: FinishPolicy; // "firstToZero" | "continueToPenultimate"
  onLegEnd?: (res: LegResult) => void; // overlay classement + stats
  resume?: X01Snapshot | any; // snapshot
}) {
  const {
    profiles,
    playerIds,
    start,
    doubleOut,
    onFinish,
    finishPolicy = "firstToZero",
    onLegEnd,
    resume,
  } = args;

  const players = React.useMemo(
    () => toPlayersFromIds(profiles || [], playerIds || []),
    [profiles, playerIds]
  );

  const rules: MatchRules = React.useMemo(
    () => ({ mode: "x01", startingScore: start, doubleOut, doubleIn: false }),
    [start, doubleOut]
  );

  const engine = React.useMemo(() => getEngine("x01"), []);
  const [startedAt] = React.useState<number>(() => Date.now());

  // 🔧 INIT: si resume est un snapshot, on reconstruit un état moteur
  const [state, setState] = React.useState<any>(() => {
    let s0: any;
    if (resume && (resume as any)?.rules?.startScore !== undefined) {
      s0 = hydrateFromSnapshot(engine, resume as X01Snapshot, players, rules);
    } else {
      s0 = engine.initGame(players, rules);
    }
    return ensureActiveIsAlive(s0);
  });

  const [lastBust, setLastBust] = React.useState<null | { reason: string }>(null);

  // CONTINUER
  const [finishedOrder, setFinishedOrder] = React.useState<string[]>([]);
  const [pendingFirstWin, setPendingFirstWin] =
    React.useState<null | { playerId: string }>(null);
  const [liveFinishPolicy, setLiveFinishPolicy] =
    React.useState<"firstToZero" | "continueToPenultimate">(
      normalizePolicy(finishPolicy)
    );

  // (re)init sur changement de paramètres ou de snapshot
  React.useEffect(() => {
    let s0: any;
    if (resume && (resume as any)?.rules?.startScore !== undefined) {
      s0 = hydrateFromSnapshot(engine, resume as X01Snapshot, players, rules);
    } else {
      s0 = engine.initGame(players, rules);
    }
    s0 = ensureActiveIsAlive(s0);
    setState(s0);
    setLastBust(null);
    setFinishedOrder([]);
    setPendingFirstWin(null);
    setLiveFinishPolicy(normalizePolicy(finishPolicy));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, rules.startingScore, rules.doubleOut, rules.doubleIn, finishPolicy, resume]);

  // ---- helpers manche
  function buildLegResultLocal(s: any): LegResult {
    const remaining: Record<string, number> = {};
    for (const p of s.players || [])
      remaining[p.id] = s.table?.[p.id]?.score ?? 0;

    const order = [...finishedOrder];
    for (const p of s.players || []) if (!order.includes(p.id)) order.push(p.id);

    const agg = computeLegAggFromHistory(s);
    return {
      legNo: 1,
      winnerId: order[0],
      order,
      finishedAt: Date.now(),
      remaining,
      darts: agg.darts,
      visits: agg.visits,
      avg3: agg.avg3,
      bestVisit: agg.bestVisit,
      bestCheckout: agg.bestCheckout,
      x180: agg.x180,
      doubles: agg.doubles,
      triples: agg.triples,
      bulls: agg.bulls,
      visitSumsByPlayer: agg.visitSumsByPlayer,
      checkoutDartsByPlayer: agg.checkoutDartsByPlayer,
      hitsBySector: agg.hitsBySector,
      h60: agg.h60,
      h100: agg.h100,
      h140: agg.h140,
      h180: agg.h180,
    } as unknown as LegResult;
  }
  function resetForNextLeg() {
    const s0 = engine.initGame(state.players, rules);
    setState(ensureActiveIsAlive(s0));
    setFinishedOrder([]);
    setPendingFirstWin(null);
    setLiveFinishPolicy(normalizePolicy(finishPolicy));
    setLastBust(null);
  }

  // ---- API CONTINUER
  function continueAfterFirst() {
    if (!pendingFirstWin) return;
    setLiveFinishPolicy("continueToPenultimate");
    setFinishedOrder((arr) =>
      arr.includes(pendingFirstWin.playerId)
        ? arr
        : [...arr, pendingFirstWin.playerId]
    );
    setPendingFirstWin(null);
  }
  function endNow() {
    const res = buildLegResultLocal(state);
    onLegEnd?.(res);
    resetForNextLeg();
  }

  // ---- jouer une volée (ou un BUST)
  function submitThrowUI(throwUI: UIThrow) {
    setState((prev: any) => {
      const check = wouldBust(prev, throwUI);

      if (check.bust) {
        // BUST => on conserve l'historique, on passe au joueur suivant (skip finis)
        const curr = prev.players?.[prev.currentPlayerIndex];
        const historyEntry = { playerId: curr?.id, darts: uiToGameDarts(throwUI) };

        let next = {
          ...prev,
          history: [...(prev.history || []), historyEntry],
          currentPlayerIndex: (prev.currentPlayerIndex + 1) % (prev.players?.length || 1),
          turnIndex: 0,
        };
        next = ensureActiveIsAlive(next);

        setLastBust({ reason: check.reason! });
        return next;
      }

      // coup valide
      setLastBust(null);
      let s2 = engine.playTurn(prev, uiToGameDarts(throwUI));
      s2 = ensureActiveIsAlive(s2);

      // détection checkout & CONTINUER
      try {
        const last = (s2.history || [])[Math.max(0, (s2.history || []).length - 1)];
        const pid: string | undefined = last?.playerId;
        if (pid && s2.table?.[pid]) {
          const scoreNow = s2.table[pid].score;
          const justFinished = scoreNow === 0;

          if (justFinished) {
            if (finishedOrder.length === 0 && liveFinishPolicy === "firstToZero") {
              // premier fini => proposer "Continuer ?"
              setPendingFirstWin({ playerId: pid });
              return s2;
            }

            // ajoute au classement si pas déjà
            setFinishedOrder((arr) => (arr.includes(pid) ? arr : [...arr, pid]));

            if (liveFinishPolicy === "continueToPenultimate") {
              const finishedCountNext = finishedOrder.includes(pid)
                ? finishedOrder.length
                : finishedOrder.length + 1;
              if (finishedCountNext >= (s2.players?.length ?? 0) - 1) {
                // l'avant-dernier vient de finir => manche terminée
                const res = buildLegResultLocal(s2);
                onLegEnd?.(res);
                setTimeout(() => resetForNextLeg(), 0);
              }
            } else {
              // firstToZero (cas forcé)
              const res = buildLegResultLocal(s2);
              onLegEnd?.(res);
              setTimeout(() => resetForNextLeg(), 0);
            }
          }
        }
      } catch {
        // tolérance si la forme du state diffère
      }

      return s2;
    });
  }

  // undo (replay de l'historique)
  function undoLast() {
    setState((prev: any) => {
      if (!prev.history?.length) return prev;
      const base = engine.initGame(prev.players, prev.rules);
      let replay = { ...base };
      for (const h of prev.history.slice(0, -1)) {
        const darts = h.darts || [];
        replay = engine.playTurn(replay, darts);
      }
      replay = ensureActiveIsAlive(replay);
      setFinishedOrder([]);
      setPendingFirstWin(null);
      setLiveFinishPolicy(normalizePolicy(finishPolicy));
      setLastBust(null);
      return replay;
    });
  }

  // flag “continuing” (masque la fin auto)
  const nbPlayers = state.players?.length ?? 0;
  const finishedCount = finishedOrder.length;
  const isContinuing =
    (liveFinishPolicy === "firstToZero" && !!pendingFirstWin) ||
    (liveFinishPolicy === "continueToPenultimate" &&
      finishedCount < Math.max(0, nbPlayers - 1));

  React.useEffect(() => {
    if (!engine.isGameOver(state)) return;
    if (isContinuing) return; // ne pas finir si on continue
    const rec = buildMatchRecordX01({ state, startedAt });
    onFinish(rec);
  }, [state, engine, startedAt, onFinish, isContinuing]);

  const currentPlayer: Player | null =
    state?.players?.[state?.currentPlayerIndex] ?? null;

  const scoresByPlayer: Record<string, number> = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of state.players || [])
      out[p.id] = state.table?.[p.id]?.score ?? 0;
    return out;
  }, [state]);

  const isOver = !isContinuing && engine.isGameOver(state);
  const winner: Player | null = engine.getWinner(state);

  return {
    state,
    currentPlayer,
    turnIndex: state?.turnIndex ?? 0,
    scoresByPlayer,
    isOver,
    winner,
    submitThrowUI,
    undoLast,
    lastBust,

    // CONTINUER API
    finishedOrder,
    pendingFirstWin,
    continueAfterFirst,
    endNow,
    isContinuing,
  };
}
