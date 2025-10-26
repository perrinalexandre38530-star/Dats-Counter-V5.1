// ============================================
// src/lib/gameEngines/killerEngine.ts
// ============================================
import type {
    BaseGameState, Player, GameDart as Dart, MatchRules, GameEngine, KillerRules
  } from "../types-game";
  import { makeBaseState, pushTurn } from "./baseEngine";
  
  type KillerPlayerState = {
    playerId: string;
    number: number;     // numéro attribué (1..20)
    lives: number;      // vies restantes
    killer: boolean;    // est-il “killer” ?
  };
  
  export type KillerState = BaseGameState & {
    rules: KillerRules;
    table: Record<string, KillerPlayerState>;
  };
  
  function multFromBed(bed: Dart["bed"]) {
    if (bed === "T") return 3;
    if (bed === "D") return 2;
    return 1;
  }
  
  export const KillerEngine: GameEngine<KillerState> = {
    initGame(players: Player[], rules: MatchRules): KillerState {
      const r: KillerRules = {
        livesPerPlayer: 3,
        tripleCountsAs: 3,
        doubleCountsAs: 2,
        singleCountsAs: 1,
        ...((rules.mode === "killer" ? rules : {}) as KillerRules),
      };
      const base = makeBaseState("killer", players);
      // Attribution simple des numéros (1..20 en boucle)
      const table: KillerState["table"] = {};
      players.forEach((p, i) => {
        table[p.id] = {
          playerId: p.id,
          number: (i % 20) + 1,
          lives: r.livesPerPlayer!,
          killer: false,
        };
      });
      return { ...base, rules: r, table };
    },
  
    playTurn(state: KillerState, darts: Dart[]): KillerState {
      const pid = state.players[state.currentPlayerIndex].id;
      const self = state.table[pid];
  
      const next: KillerState = { ...state, table: { ...state.table } };
      next.table[pid] = { ...self };
  
      let notes: string | undefined;
  
      for (const d of darts.slice(0, 3)) {
        if (d.bed === "MISS") continue;
        const mult = multFromBed(d.bed);
  
        // Devenir killer : toucher le DOUBLE de son propre numéro
        if (!next.table[pid].killer) {
          if (d.bed === "D" && d.number === next.table[pid].number) {
            next.table[pid].killer = true;
            notes = (notes ? notes + " " : "") + "became-killer";
          }
          continue;
        }
  
        // Une fois killer : viser les numéros des autres pour leur enlever des vies
        for (const opp of state.players) {
          if (opp.id === pid) continue;
          const os = next.table[opp.id];
          if (os.lives <= 0) continue;
          if (d.number === os.number) {
            const remove =
              mult === 3 ? next.rules.tripleCountsAs! :
              mult === 2 ? next.rules.doubleCountsAs! :
                            next.rules.singleCountsAs!;
            os.lives = Math.max(0, os.lives - remove);
            notes = (notes ? notes + " " : "") + `hit-${opp.name}`;
          }
        }
      }
  
      const advanced = pushTurn(next, { darts, notes });
  
      // Fin = un seul joueur avec vies > 0
      const alive = advanced.players.filter(p => advanced.table[p.id].lives > 0);
      if (alive.length <= 1) {
        return { ...advanced, endedAt: Date.now() };
      }
      return advanced;
    },
  
    isGameOver(state) {
      if (state.endedAt) return true;
      const alive = state.players.filter(p => state.table[p.id].lives > 0);
      return alive.length <= 1;
    },
  
    getWinner(state) {
      const alive = state.players.filter(p => state.table[p.id].lives > 0);
      return alive[0] ?? null;
    },
  };
  