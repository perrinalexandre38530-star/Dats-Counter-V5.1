// ============================================
// src/lib/gameEngines/shanghaiEngine.ts
// ============================================
import type {
    BaseGameState, Player, GameDart as Dart, MatchRules, GameEngine, ShanghaiRules
  } from "../types-game";
  import { makeBaseState, pushTurn } from "./baseEngine";
  
  export type ShanghaiState = BaseGameState & {
    rules: ShanghaiRules;
    roundIndex: number; // index dans rules.rounds
    scores: Record<string, number>;
  };
  
  function dartPoints(d: Dart) {
    if (d.bed === "MISS") return 0;
    if (d.bed === "OB") return 25;
    if (d.bed === "IB") return 50;
    if (!d.number) return 0;
    const mult = d.bed === "S" ? 1 : d.bed === "D" ? 2 : 3;
    return d.number * mult;
  }
  
  export const ShanghaiEngine: GameEngine<ShanghaiState> = {
    initGame(players: Player[], rules: MatchRules): ShanghaiState {
      const r: ShanghaiRules = {
        rounds: Array.from({ length: 20 }, (_, i) => i + 1),
        instantWinOnShanghai: true,
        ...((rules.mode === "shanghai" ? rules : {}) as ShanghaiRules),
      };
      const base = makeBaseState("shanghai", players);
      const scores: Record<string, number> = {};
      for (const p of players) scores[p.id] = 0;
      return { ...base, rules: r, scores, roundIndex: 0 };
    },
  
    playTurn(state: ShanghaiState, darts: Dart[]): ShanghaiState {
      const pid = state.players[state.currentPlayerIndex].id;
      const target = state.rules.rounds[state.roundIndex];
  
      const next: ShanghaiState = { ...state, scores: { ...state.scores } };
  
      // Points uniquement si on touche le numéro du round
      let hitsS = 0, hitsD = 0, hitsT = 0, gained = 0;
  
      for (const d of darts.slice(0, 3)) {
        if (target >= 1 && target <= 20 && d.number === target) {
          if (d.bed === "S") { hitsS++; gained += dartPoints(d); }
          if (d.bed === "D") { hitsD++; gained += dartPoints(d); }
          if (d.bed === "T") { hitsT++; gained += dartPoints(d); }
        } else if (target === 25 && (d.bed === "OB" || d.bed === "IB")) {
          gained += dartPoints(d);
          if (d.bed === "OB") hitsS++;
          if (d.bed === "IB") hitsD++; // on assimile IB à double pour shanghai bull
        }
      }
  
      next.scores[pid] += gained;
  
      const gotShanghai =
        state.rules.instantWinOnShanghai &&
        target >= 1 && target <= 20 &&
        hitsS > 0 && hitsD > 0 && hitsT > 0;
  
      let advanced = pushTurn(next, { darts, scoreDelta: gained, notes: gotShanghai ? "shanghai" : undefined });
  
      // À chaque retour au joueur 0 → on avance de round
      if (advanced.currentPlayerIndex === 0) {
        const nextRound = Math.min(advanced.rules.rounds.length - 1, advanced.roundIndex + 1);
        advanced = { ...advanced, roundIndex: nextRound };
      }
  
      // Fin si shanghai instantané ou dernier round terminé (tout le monde a joué)
      const lastRoundDone =
        advanced.roundIndex === advanced.rules.rounds.length - 1 &&
        advanced.currentPlayerIndex === 0;
  
      if (gotShanghai || lastRoundDone) {
        return { ...advanced, endedAt: Date.now() };
      }
      return advanced;
    },
  
    isGameOver(state) {
      if (state.endedAt) return true;
      return false;
    },
  
    getWinner(state) {
      if (!state.endedAt) return null;
      return [...state.players].sort((a, b) => state.scores[b.id] - state.scores[a.id])[0] ?? null;
    },
  };
  