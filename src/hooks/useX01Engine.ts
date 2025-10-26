// ============================================
// src/hooks/useX01Engine.ts
// X01 engine wrapper: playTurn + safe BUST + CONTINUER (patch minimal)
// ============================================
import * as React from "react";
import type {
  Profile,
  Throw as UIThrow,
  MatchRecord,
  Dart as UIDart,
  // NEW ↓
  FinishPolicy,
  LegResult,
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
    if (d.v === 25) return { bed: "OB" };                 // 25
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
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/* -------- record builder -------- */
function buildMatchRecordX01(params: { state: any; startedAt: number }): MatchRecord {
  const { state, startedAt } = params;
  const players: Player[] = state.players;
  const perTurn: Array<{ playerId: string; darts: GameDart[] }> = state.history || [];

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
function wouldBust(state: any, dartsUI: UIThrow): { bust: boolean; reason: "over" | "oneLeft" | "needDouble" | null } {
  const p = state.players[state.currentPlayerIndex];
  const remaining = state.table[p.id]?.score ?? 0;
  const sum = (dartsUI || []).reduce((s, d) => s + dartPoints(d), 0);
  const after = remaining - sum;

  if (after < 0) return { bust: true, reason: "over" };
  if (after === 1) return { bust: true, reason: "oneLeft" };
  if (after === 0 && state.rules?.doubleOut) {
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
function computeLegAggFromHistory(state: any) {
  const players: Player[] = state.players || [];
  const hist: Array<{ playerId: string; darts: GameDart[] }> = state.history || [];

  const darts: Record<string, number> = {};
  const visits: Record<string, number> = {};
  const bestVisit: Record<string, number> = {};
  const bestCheckout: Record<string, number | null> = {};
  const x180: Record<string, number> = {};
  const doubles: Record<string, number> = {};
  const triples: Record<string, number> = {};
  const bulls: Record<string, number> = {};
  const sumPointsByVisit: Record<string, number> = {};

  for (const p of players) {
    darts[p.id] = 0; visits[p.id] = 0; bestVisit[p.id] = 0; bestCheckout[p.id] = null;
    x180[p.id] = 0; doubles[p.id] = 0; triples[p.id] = 0; bulls[p.id] = 0;
    sumPointsByVisit[p.id] = 0;
  }

  const startScore = state.rules?.startingScore ?? 501;
  const runningScores: Record<string, number> = Object.fromEntries(players.map(p => [p.id, startScore]));

  for (const t of hist) {
    const pid = t.playerId;
    const arr = t.darts || [];
    let volSum = 0;
    visits[pid] += 1;
    darts[pid]  += arr.length;

    for (const d of arr) {
      const pts = dartPointsGame(d);
      volSum += pts;
      if (d.bed === "D") doubles[pid] += 1;
      if (d.bed === "T") triples[pid] += 1;
      if (d.bed === "OB" || d.bed === "IB") bulls[pid] += 1;
    }
    if (arr.length === 3 && volSum === 180) x180[pid] += 1;
    bestVisit[pid] = Math.max(bestVisit[pid], volSum);
    sumPointsByVisit[pid] += volSum;

    const before = runningScores[pid];
    let after = before - volSum;
    if (after < 0 || after === 1) after = before;      // busts classiques
    else if (after === 0) bestCheckout[pid] = Math.max(bestCheckout[pid] ?? 0, volSum);
    runningScores[pid] = after;
  }

  const avg3: Record<string, number> = {};
  for (const p of players) {
    avg3[p.id] = visits[p.id] ? Math.round((sumPointsByVisit[p.id] / visits[p.id] / 3) * 100) / 100 : 0;
  }

  return { darts, visits, bestVisit, bestCheckout, x180, doubles, triples, bulls, avg3 };
}

/* -------- hook -------- */
export function useX01Engine(args: {
  profiles: Profile[];
  playerIds: string[];
  start: 301 | 501 | 701 | 1001;
  doubleOut: boolean;
  onFinish: (m: MatchRecord) => void;

  // NEW ↓
  finishPolicy?: FinishPolicy;                 // "firstToZero" (défaut) | "continueUntilPenultimate"
  onLegEnd?: (res: LegResult) => void;         // overlay classement + stats
  resume?: any;                                // si tu passes un snapshot
}) {
  const {
    profiles,
    playerIds,
    start,
    doubleOut,
    onFinish,
    // NEW ↓
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
  const [state, setState] = React.useState<any>(() => resume ? resume : engine.initGame(players, rules));
  const [lastBust, setLastBust] = React.useState<null | { reason: string }>(null);

  // NEW —— états "CONTINUER"
  const [finishedOrder, setFinishedOrder] = React.useState<string[]>([]);
  const [pendingFirstWin, setPendingFirstWin] = React.useState<null | { playerId: string }>(null);
  const [liveFinishPolicy, setLiveFinishPolicy] = React.useState<FinishPolicy>(finishPolicy);

  // (re)init seulement quand les paramètres de partie changent
  React.useEffect(() => {
    const s0 = resume ? resume : engine.initGame(players, rules);
    setState(s0);
    setLastBust(null);
    setFinishedOrder([]);
    setPendingFirstWin(null);
    setLiveFinishPolicy(finishPolicy);
  }, [players, rules.startingScore, rules.doubleOut, rules.doubleIn, finishPolicy, resume]); // eslint-disable-line

  // NEW —— helpers manche
  function buildLegResult(s: any): LegResult {
    const remaining: Record<string, number> = {};
    for (const p of s.players || []) remaining[p.id] = s.table?.[p.id]?.score ?? 0;

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
    };
  }
  function resetForNextLeg() {
    const s0 = engine.initGame(state.players, rules);
    setState(s0);
    setFinishedOrder([]);
    setPendingFirstWin(null);
    setLiveFinishPolicy(finishPolicy);
    setLastBust(null);
  }

  // NEW —— API UI
  function continueAfterFirst() {
    if (!pendingFirstWin) return;
    setLiveFinishPolicy("continueUntilPenultimate");
    setFinishedOrder((arr) => (arr.includes(pendingFirstWin.playerId) ? arr : [...arr, pendingFirstWin.playerId]));
    setPendingFirstWin(null);
  }
  function endNow() {
    const res = buildLegResult(state);
    onLegEnd?.(res);
    resetForNextLeg();
  }

  // ➜ exécute une volée OU un bust sans jamais réinitialiser d’autres joueurs
  function submitThrowUI(throwUI: UIThrow) {
    setState((prev: any) => {
      const check = wouldBust(prev, throwUI);

      if (check.bust) {
        // ⛔️ BUST: on ne modifie aucun score, on push juste l’historique du tour (optionnel)
        const curr = prev.players[prev.currentPlayerIndex];
        const historyEntry = { playerId: curr.id, darts: uiToGameDarts(throwUI) };

        const nextState = {
          ...prev,
          history: [...(prev.history || []), historyEntry],
          // on avance au joueur suivant
          currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
          turnIndex: 0,
        };

        setLastBust({ reason: check.reason! });
        return nextState;
      }

      // coup valide : déléguer au moteur
      setLastBust(null);
      const s2 = engine.playTurn(prev, uiToGameDarts(throwUI));

      // NEW —— détection checkout & pilotage "CONTINUER"
      try {
        const last = (s2.history || [])[Math.max(0, (s2.history || []).length - 1)];
        const pid: string | undefined = last?.playerId;
        if (pid) {
          const scoreNow = s2.table?.[pid]?.score;
          const justFinished = scoreNow === 0;

          if (justFinished) {
            if (finishedOrder.length === 0 && liveFinishPolicy === "firstToZero") {
              // Premier à finir => ouvrir la modale "Continuer ?"
              setPendingFirstWin({ playerId: pid });
              return s2;
            }

            // Ajoute ce joueur à l'ordre si pas déjà
            setFinishedOrder(arr => (arr.includes(pid) ? arr : [...arr, pid]));

            if (liveFinishPolicy === "continueUntilPenultimate") {
              const finishedCountNext = (finishedOrder.includes(pid) ? finishedOrder.length : finishedOrder.length + 1);
              if (finishedCountNext >= (s2.players?.length ?? 0) - 1) {
                // l'avant-dernier vient de finir => manche terminée
                const res = buildLegResult(s2);
                onLegEnd?.(res);
                setTimeout(() => resetForNextLeg(), 0);
              }
            } else {
              // mode firstToZero sans modale (cas forcé)
              const res = buildLegResult(s2);
              onLegEnd?.(res);
              setTimeout(() => resetForNextLeg(), 0);
            }
          }
        }
      } catch {
        // pas bloquant si la forme du state diffère
      }

      return s2;
    });
  }

  // undo dernière volée (si moteur expose une API sinon rollback simple)
  function undoLast() {
    setState((prev: any) => {
      if (!prev.history?.length) return prev;
      const base = engine.initGame(prev.players, prev.rules);
      const replay = { ...base };
      for (const h of prev.history.slice(0, -1)) {
        const darts = h.darts || [];
        Object.assign(replay, engine.playTurn(replay, darts));
      }
      // Répare les états "continuer"
      setFinishedOrder([]);
      setPendingFirstWin(null);
      setLiveFinishPolicy(finishPolicy);
      setLastBust(null);
      return replay;
    });
  }

  // CHANGED —— fin de partie: on bloque l’appel onFinish si “Continuer” est actif
  const nbPlayers = state.players?.length ?? 0;
  const isContinuing =
    (liveFinishPolicy === "firstToZero"  && (!!pendingFirstWin || finishedOrder.length === 0)) ||
    (liveFinishPolicy === "continueUntilPenultimate" && finishedOrder.length < Math.max(0, nbPlayers - 1));

  React.useEffect(() => {
    if (!engine.isGameOver(state)) return;
    if (isContinuing) return; // NE PAS appeler onFinish si on est en flux "continuer"
    const rec = buildMatchRecordX01({ state, startedAt });
    onFinish(rec);
  }, [state, engine, startedAt, onFinish, isContinuing]);

  const currentPlayer: Player | null = state?.players?.[state?.currentPlayerIndex] ?? null;

  const scoresByPlayer: Record<string, number> = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of state.players || []) out[p.id] = state.table?.[p.id]?.score ?? 0;
    return out;
  }, [state]);

  // CHANGED —— l’UI ne voit “fin de partie” que si on n’est PAS en train de continuer
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

    // NEW —— pour l’UI
    finishedOrder,
    pendingFirstWin,        // { playerId } | null → affiche la modale "Continuer ?"
    continueAfterFirst,     // bouton "CONTINUER"
    endNow,                 // bouton "TERMINER MAINTENANT"
    isContinuing,           // masque le bandeau "Victoire" tant que le flux continuer est actif
  };
}
