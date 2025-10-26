// ============================================
// src/lib/types-game.ts — Types du moteur de jeu + adaptateurs
// ============================================

/* ---------- Modes (moteur) ---------- */
export type Mode = "x01" | "cricket" | "killer" | "shanghai";

/* ---------- Darts (moteur) ---------- */
export type DartBed = "S" | "D" | "T" | "OB" | "IB" | "MISS";
// S=Single, D=Double, T=Triple, OB=Outer Bull(25), IB=Inner Bull(50)

export type GameDart = {
  bed: DartBed;
  number?: number; // 1..20 obligatoire pour S/D/T ; undefined pour OB/IB/MISS
};

/* ---------- Joueurs / Tours / State commun ---------- */
export type PlayerId = string;
export type Player = { id: PlayerId; name: string };

export type Turn = {
  playerId: PlayerId;
  darts: GameDart[];       // 0..3
  scoreDelta?: number;     // variation de score (si pertinent)
  notes?: string;          // "bust", "shanghai", "closed 20", etc.
};

export type BaseGameState = {
  mode: Mode;
  players: Player[];
  currentPlayerIndex: number;
  turnIndex: number;       // nombre de tours joués (pour stats/rounds)
  history: Turn[];
  startedAt: number;
  endedAt?: number;
};

/* ---------- Règles par jeu ---------- */
export type X01Rules = {
  startingScore: 301 | 501 | 701 | 1001; // j'ajoute 1001 pour coller à ton Settings
  doubleIn?: boolean;   // défaut false
  doubleOut?: boolean;  // défaut true
  maxRounds?: number;   // optionnel
};

export type CricketRules = {
  useBull?: boolean;    // cibles 15..20 + bull
  cutThroat?: boolean;  // scoring inversé
};

export type KillerRules = {
  livesPerPlayer?: number; // défaut 3
  tripleCountsAs?: number; // défaut 3
  doubleCountsAs?: number; // défaut 2
  singleCountsAs?: number; // défaut 1
};

export type ShanghaiRules = {
  rounds: number[];           // ex: [1,2,...,20]
  instantWinOnShanghai?: boolean; // défaut true
};

export type MatchRules =
  | ({ mode: "x01" } & X01Rules)
  | ({ mode: "cricket" } & CricketRules)
  | ({ mode: "killer" } & KillerRules)
  | ({ mode: "shanghai" } & ShanghaiRules);

/* ---------- Interface commune moteur ---------- */
export type GameEngine<State extends BaseGameState = BaseGameState> = {
  initGame: (players: Player[], rules: MatchRules) => State;
  playTurn: (state: State, darts: GameDart[]) => State;  // 0..3 fléchettes
  isGameOver: (state: State) => boolean;
  getWinner: (state: State) => Player | null;
};

/* =========================================================
   Couche d'adaptation avec tes types existants (UI / Store)
   =========================================================
   -> On évite toute collision de noms en important tes types
      sous alias (UIDart, UIGameMode, UIProfile, etc.)
*/
import type {
  Dart as UIDart,        // { v: number; mult: 1|2|3; label? } (0..20, 25=OB, 50=IB)
  Throw as UIThrow,      // UIDart[]
  GameMode as UIGameMode,
  Profile as UIProfile,
} from "./types";

/* ---------- Conversion GameMode (UI) -> Mode (moteur) ---------- */
export function toMode(ui: UIGameMode): Mode {
  // UI: "X01" | "Cricket" | "Killer" | "Shanghai"
  const m = ui.toLowerCase();
  if (m === "x01" || m === "cricket" || m === "killer" || m === "shanghai") {
    return m as Mode;
  }
  // Par défaut (sécurité)
  return "x01";
}

/* ---------- Conversions Dart ---------- */
export function uiDartToGameDart(d: UIDart): GameDart {
  // Règles:
  // v = 0  -> MISS
  // v = 25 -> OB (Outer bull)
  // v = 50 -> IB (Inner bull)
  // 1..20  -> S/D/T selon mult
  if (d.v === 0) return { bed: "MISS" };
  if (d.v === 25) return { bed: "OB" };
  if (d.v === 50) return { bed: "IB" };

  // 1..20
  const number = Math.max(1, Math.min(20, Math.floor(d.v)));
  const bed = d.mult === 1 ? "S" : d.mult === 2 ? "D" : "T";
  return { bed, number };
}

export function uiThrowToGameDarts(t: UIThrow): GameDart[] {
  return (t ?? []).slice(0, 3).map(uiDartToGameDart);
}

/* ---------- Conversion Player ---------- */
export function profilesToPlayers(arr: UIProfile[]): Player[] {
  return (arr ?? []).map(p => ({ id: p.id, name: p.name || "Player" }));
}
