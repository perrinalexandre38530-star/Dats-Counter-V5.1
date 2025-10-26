// ============================================
// src/lib/gameEngines/baseEngine.ts
// ============================================
import type {
    BaseGameState, MatchRules, Player, GameDart as Dart, GameEngine
  } from "../types-game";
  
  export function rotateToNextPlayer(idx: number, total: number) {
    return (idx + 1) % total;
  }
  
  export function makeBaseState(mode: MatchRules["mode"], players: Player[]): BaseGameState {
    return {
      mode,
      players,
      currentPlayerIndex: 0,
      turnIndex: 0,
      history: [],
      startedAt: Date.now(),
    };
  }
  
  /** Ajoute le tour dans l’historique et avance joueur + compteur de tours */
  export function pushTurn<S extends BaseGameState>(
    state: S,
    turn: { darts: Dart[]; scoreDelta?: number; notes?: string }
  ): S {
    const player = state.players[state.currentPlayerIndex];
    const next: S = {
      ...state,
      history: [
        ...state.history,
        { playerId: player.id, darts: turn.darts, scoreDelta: turn.scoreDelta, notes: turn.notes },
      ],
      currentPlayerIndex: rotateToNextPlayer(state.currentPlayerIndex, state.players.length),
      turnIndex: state.turnIndex + 1,
    };
    return next;
  }
  
  // Moteur neutre (non utilisé directement, fourni pour l’interface)
  export const BaseEngine: GameEngine = {
    initGame(players) {
      return makeBaseState("x01", players);
    },
    playTurn(s) { return s; },
    isGameOver() { return false; },
    getWinner() { return null; },
  };
  