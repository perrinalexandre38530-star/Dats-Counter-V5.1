// ============================================
// src/lib/types.ts — version fusionnée + X01 "CONTINUER" + stats
// ============================================

export type ID = string;

/* ===== Darts / Jeux ===== */
export type Dart = { v: number; mult: 1 | 2 | 3; label?: string }; // 0..20 ou 25/50
export type Throw = Dart[];
export type GameMode = "X01" | "Cricket" | "Killer" | "Shanghai";

/* ===== Profils ===== */
export type ProfileStats = {
  avg3?: number;          // moyenne / 3 flèches
  bestVisit?: number;     // meilleure volée (ex: 180)
  bestCheckout?: number;  // plus haut checkout (ex: 170)
  wins?: number;          // nb de victoires
  losses?: number;        // nb de défaites
};

export type Profile = {
  id: ID;
  name: string;
  avatarDataUrl?: string;
  stats?: ProfileStats | any; // compat ancien code
};

/* ===== Réglages ===== */
export type Settings = {
  lang: "fr" | "en";
  ttsOnThird: boolean;
  neonTheme: boolean;
  defaultX01: 301 | 501 | 701 | 1001;
  doubleOut: boolean;
  randomOrder: boolean;
};

/* ===== Historique (modèle existant, conservé) ===== */
export type MatchHeader = {
  id: ID;
  mode: GameMode;
  startedAt: number;
  players: ID[];
  winner?: ID | null;
  meta?: any;
};

export type MatchRecord = {
  header: MatchHeader;
  rounds: Array<Throw[]>; // rounds[roundIndex][playerIndex] = Throw
};

/* ===== Amis ===== */
export type FriendStatus = "online" | "away" | "offline";

export type Friend = {
  id: ID;
  name: string;
  avatarDataUrl?: string;
  status: FriendStatus;
  stats: {
    avg3: number;        // moyenne / 3 flèches
    bestVisit: number;   // meilleure volée
    winrate: number;     // taux de victoire (0..1)
  };
};

/* =========================================================
   X01 — Politique de fin + Résultats de manche + Stats
   ========================================================= */

// Politique de fin de manche : s'arrêter au 1er checkout ou continuer
export type FinishPolicy = "firstToZero" | "continueUntilPenultimate";

// Résultat d'une manche (leg) — alimente l'overlay "Classement + Stats"
export type LegResult = {
  legNo: number;
  winnerId: string;
  order: string[];                    // ordre d’arrivée (IDs des joueurs)
  finishedAt: number;                 // timestamp (Date.now())
  remaining: Record<string, number>;  // score restant par joueur à la fin
  darts: Record<string, number>;      // nb total de flèches tirées
  visits: Record<string, number>;     // nb de volées
  avg3: Record<string, number>;       // moyenne / 3 flèches
  bestVisit: Record<string, number>;  // meilleure volée
  bestCheckout: Record<string, number | null>;
  x180: Record<string, number>;
  doubles: Record<string, number>;
  triples: Record<string, number>;
  bulls: Record<string, number>;      // 25/50 cumulés
};

// Agrégat multi-manches (facultatif, si tu veux cumuler plusieurs legs)
export type MatchStats = {
  legs: LegResult[];
  perPlayer: Record<string, {
    legsWon: number;
    darts: number;
    visits: number;
    avg3: number;
    bestVisit: number;
    bestCheckout: number | null;
    x180: number;
    doubles: number;
    triples: number;
    bulls: number;
  }>;
};

// Règles X01 (ajout de finishPolicy)
export type X01Rules = {
  startScore: number;
  doubleOut: boolean;
  finishPolicy?: FinishPolicy; // default: "firstToZero"
};

/* =========================================================
   Sauvegardes / Reprise des parties (non breaking)
   ========================================================= */

export type GameKind = "x01" | "cricket"; // étends si besoin
export type SavedMatchStatus = "in_progress" | "finished";

export type SavedPlayer = {
  id: ID;                  // profile id si dispo, sinon "local:<name>"
  name: string;
};

export type X01Snapshot = {
  // État minimal pour reprendre
  rules: {
    startScore: number;    // ex. 501
    doubleOut: boolean;
    finishPolicy?: FinishPolicy; // 👈 conserve le choix "CONTINUER"
    sets?: number;
    legs?: number;
  };
  players: SavedPlayer[];
  scores: number[];            // même ordre que players
  currentIndex: number;        // joueur au trait
  dartsThisTurn: Array<Dart | null>; // 3 slots
  legs?: number[];             // si tu gères sets/legs
  sets?: number[];             // idem
};

export type SavedGamePayload =
  | { kind: "x01"; state: X01Snapshot }
  | { kind: "cricket"; state: any }; // TODO: modèle Cricket

export type SavedMatch = {
  id: ID;                      // uuid
  kind: GameKind;
  status: SavedMatchStatus;
  createdAt: number;           // Date.now()
  updatedAt: number;
  players: SavedPlayer[];
  winnerId?: ID;               // si finished
  note?: string;
  payload: SavedGamePayload;   // snapshot pour reprise / stats
  stats?: MatchStats;          // 👈 stats/glossaire de la partie (optionnel)
};

/* ===== Store global ===== */
export type Store = {
  profiles: Profile[];
  settings: Settings;

  /** Historique existant (si tu l’utilises déjà) */
  history: MatchRecord[];

  /** NOUVEAU : sauvegardes reprenables + stats par match */
  saved: SavedMatch[];

  /** Profil actuellement connecté */
  activeProfileId: ID | null;

  /** Liste d’amis (en ligne / absents / hors ligne) */
  friends: Friend[];

  /** Statut du joueur actuel */
  selfStatus: "online" | "away" | "offline";

  /** Mutateur centralisé pour update le store */
  put: (updater: (s: Store) => Store) => void;
};
