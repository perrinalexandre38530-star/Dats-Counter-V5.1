// ============================================
// src/lib/gameEngines/cricketEngine.ts
// ============================================
import type {
    BaseGameState, Player, GameDart as Dart, MatchRules, GameEngine, CricketRules
  } from "../types-game";
  import { makeBaseState, pushTurn } from "./baseEngine";
  
  type Target = 15 | 16 | 17 | 18 | 19 | 20 | 25; // 25 = bull (OB/IB)
  const DEFAULT_TARGETS: Target[] = [15,16,17,18,19,20,25];
  
  type Marks = Record<Target, number>; // 0..3
  type Scores = number;
  
  export type CricketState = BaseGameState & {
    rules: CricketRules;
    marks: Record<string, Marks>; // par joueur
    scores: Record<string, Scores>;
    targets: Target[];
  };
  
  function hitToMarks(d: Dart, target: Target): number {
    if (d.bed === "MISS") return 0;
    if (target === 25) {
      if (d.bed === "OB") return 1;
      if (d.bed === "IB") return 2;
      return 0;
    }
    if (d.number !== target) return 0;
    if (d.bed === "S") return 1;
    if (d.bed === "D") return 2;
    if (d.bed === "T") return 3;
    return 0;
  }
  function hitToPoints(d: Dart, target: Target): number {
    if (target === 25) {
      if (d.bed === "OB") return 25;
      if (d.bed === "IB") return 50;
      return 0;
    }
    if (d.number !== target) return 0;
    const mult = d.bed === "S" ? 1 : d.bed === "D" ? 2 : d.bed === "T" ? 3 : 0;
    return target * mult;
  }
  
  export const CricketEngine: GameEngine<CricketState> = {
    initGame(players: Player[], rules: MatchRules): CricketState {
      const r: CricketRules = {
        useBull: true,
        cutThroat: false,
        ...((rules.mode === "cricket" ? rules : {}) as CricketRules),
      };
      const base = makeBaseState("cricket", players);
      const targets = r.useBull ? DEFAULT_TARGETS : DEFAULT_TARGETS.filter(t => t !== 25);
      const marks: CricketState["marks"] = {};
      const scores: CricketState["scores"] = {};
      for (const p of players) {
        scores[p.id] = 0;
        marks[p.id] = Object.fromEntries(targets.map(t => [t, 0])) as Marks;
      }
      return { ...base, rules: r, marks, scores, targets };
    },
  
    playTurn(state: CricketState, darts: Dart[]): CricketState {
      const pid = state.players[state.currentPlayerIndex].id;
  
      const next: CricketState = {
        ...state,
        marks: { ...state.marks },
        scores: { ...state.scores },
      };
      next.marks[pid] = { ...next.marks[pid] };
  
      let gained = 0;
      let overflowHitTargets: Target[] = [];
  
      for (const d of darts.slice(0, 3)) {
        for (const t of next.targets) {
          const add = hitToMarks(d, t);
          if (!add) continue;
  
          const before = next.marks[pid][t];
          const after = Math.min(3, before + add);
          const overflow = Math.max(0, before + add - 3);
          next.marks[pid][t] = after;
  
          // Points sur overflow si les autres n'ont pas tous fermé
          const othersClosed = state.players
            .filter(p => p.id !== pid)
            .every(p => next.marks[p.id][t] >= 3);
  
          if (!othersClosed && overflow > 0) {
            gained += overflow * (hitToPoints(d, t) / add); // proportionnel
            overflowHitTargets.push(t);
          }
        }
      }
  
      if (next.rules.cutThroat && gained > 0) {
        const openOpponents = state.players.filter(p =>
          p.id !== pid &&
          overflowHitTargets.some(t => next.marks[p.id][t] < 3)
        );
        if (openOpponents.length > 0) {
          const share = Math.floor(gained / openOpponents.length);
          for (const opp of openOpponents) {
            next.scores[opp.id] += share;
          }
        }
      } else {
        next.scores[pid] += gained;
      }
  
      const someoneClosedAll = state.players.some(p =>
        next.targets.every(t => next.marks[p.id][t] >= 3)
      );
  
      const advanced = pushTurn(next, {
        darts,
        scoreDelta: next.rules.cutThroat ? 0 : gained,
        notes: someoneClosedAll ? "closed-all" : undefined,
      });
  
      if (someoneClosedAll) {
        return { ...advanced, endedAt: Date.now() };
      }
      return advanced;
    },
  
    isGameOver(state) {
      if (state.endedAt) return true;
      return state.players.some(p =>
        state.targets.every(t => state.marks[p.id][t] >= 3)
      );
    },
  
    getWinner(state) {
      // Standard: a fermé toutes les cibles ET a le meilleur score
      const closed = state.players.filter(p =>
        state.targets.every(t => state.marks[p.id][t] >= 3)
      );
      if (closed.length === 0) return null;
      const sorted = [...closed].sort((a, b) => state.scores[b.id] - state.scores[a.id]);
      return sorted[0] ?? null;
    },
  };
  