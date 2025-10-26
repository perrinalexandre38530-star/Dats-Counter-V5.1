// ============================================
// src/lib/gameEngines/x01Engine.ts
// ============================================
import type {
    BaseGameState, Player, GameDart as Dart, MatchRules, GameEngine, X01Rules
  } from "../types-game";
  import { makeBaseState, pushTurn } from "./baseEngine";
  
  type X01PlayerState = {
    playerId: string;
    score: number;
    entered?: boolean; // pour double-in
  };
  
  export type X01State = BaseGameState & {
    rules: X01Rules;
    table: Record<string, X01PlayerState>;
  };
  
  function dartValue(d: Dart): { points: number; isDouble: boolean } {
    if (d.bed === "MISS") return { points: 0, isDouble: false };
    if (d.bed === "OB") return { points: 25, isDouble: false };
    if (d.bed === "IB") return { points: 50, isDouble: true }; // IB compte comme double
    if (!d.number) return { points: 0, isDouble: false };
    const mult = d.bed === "S" ? 1 : d.bed === "D" ? 2 : 3;
    return { points: d.number * mult, isDouble: d.bed === "D" };
  }
  
  export const X01Engine: GameEngine<X01State> = {
    initGame(players: Player[], rules: MatchRules): X01State {
      const r: X01Rules = {
        startingScore: 501,
        doubleIn: false,
        doubleOut: true,
        ...((rules.mode === "x01" ? rules : {}) as X01Rules),
      };
      const base = makeBaseState("x01", players);
      const table: X01State["table"] = {};
      for (const p of players) {
        table[p.id] = { playerId: p.id, score: r.startingScore, entered: !r.doubleIn };
      }
      return { ...base, rules: r, table };
    },
  
    playTurn(state: X01State, darts: Dart[]): X01State {
      const pid = state.players[state.currentPlayerIndex].id;
      const ps = state.table[pid];
      const scoreBefore = ps.score;
  
      let consumed = 0;
      let busted = false;
      let checkout = false;
  
      const next: X01State = { ...state, table: { ...state.table } };
      next.table[pid] = { ...ps };
  
      for (const d of darts.slice(0, 3)) {
        const { points, isDouble } = dartValue(d);
  
        // Double-In
        if (!next.table[pid].entered) {
          if (isDouble) next.table[pid].entered = true;
          else continue; // pas d'impact tant qu'on n'est pas entré
        }
  
        const remaining = next.table[pid].score - points;
  
        // Bust checks
        if (remaining < 0) { busted = true; break; }
        if (remaining === 1 && next.rules.doubleOut) { busted = true; break; }
        if (remaining === 0) {
          if (next.rules.doubleOut && !isDouble) { busted = true; break; }
          // Checkout valide
          next.table[pid].score = 0;
          consumed += points;
          checkout = true;
          break;
        }
  
        // Coup normal
        next.table[pid].score = remaining;
        consumed += points;
      }
  
      const notes = busted ? "bust" : checkout ? "checkout" : undefined;
      if (busted) {
        next.table[pid].score = scoreBefore; // rollback
      }
  
      const advanced = pushTurn(next, { darts, scoreDelta: busted ? 0 : -consumed, notes });
  
      // Fin si un joueur à 0 ou si maxRounds atteint
      if (advanced.table[pid].score === 0) {
        return { ...advanced, endedAt: Date.now() };
      }
      if (advanced.rules.maxRounds && advanced.turnIndex >= advanced.rules.maxRounds * advanced.players.length) {
        return { ...advanced, endedAt: Date.now() };
      }
      return advanced;
    },
  
    isGameOver(state) {
      if (state.endedAt) return true;
      return state.players.some(p => state.table[p.id].score === 0);
    },
  
    getWinner(state) {
      const winner = state.players.find(p => state.table[p.id].score === 0);
      if (winner) return winner;
      if (state.endedAt && state.rules.maxRounds) {
        return [...state.players].sort((a, b) =>
          state.table[a.id].score - state.table[b.id].score
        )[0] ?? null;
      }
      return null;
    },
  };
  