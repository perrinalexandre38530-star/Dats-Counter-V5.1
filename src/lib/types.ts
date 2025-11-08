// ============================================
// src/lib/types.ts — version fusionnée + X01 "CONTINUER" + stats unifiés
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
   SOCLE STATS UNIFIÉ (à utiliser partout)
   ========================================================= */

// Profil léger utilisé dans les résumés / historiques
export type PlayerLite = {
  id: ID;
  name?: string;
  avatarDataUrl?: string | null;
};

// Log de volées
export type VisitSeg = { v: number; mult?: 1 | 2 | 3 };
export type Visit = {
  p: ID;                 // player id
  segments: VisitSeg[];  // 1..3 fléchettes
  bust?: boolean;
  score?: number;        // total de la volée (optionnel)
  isCheckout?: boolean;  // cette volée a terminé le leg ?
  ts?: number;
};

// Stats d'une manche par joueur
export type LegStatsPerPlayer = {
  dartsThrown: number;     // fléchettes lancées
  visits: number;          // volées
  avg3: number;            // moyenne /3
  h60: number;             // 60–99
  h100: number;            // 100–139
  h140: number;            // 140–179
  h180: number;            // 180
  bestVisit: number;       // meilleure volée
  checkoutAttempts: number;// essais de checkout
  checkoutHits: number;    // checkouts réussis
  bestCheckout: number;    // meilleur checkout
};

// Résultat “riche” d'une manche (source de vérité pour l’overlay & l’agrégat)
export type LegStats = {
  byPlayer: Record<ID, LegStatsPerPlayer>;
  winnerId?: ID | null;
  dartsTotal?: number;
};

// Maps “legacy” lues par les tableaux existants (overlay fin de leg, etc.)
export type LegacyMaps = {
  avg3: Record<ID, number>;
  darts: Record<ID, number>;
  visits: Record<ID, number>;
  h60: Record<ID, number>;
  h100: Record<ID, number>;
  h140: Record<ID, number>;
  h180: Record<ID, number>;
  bestVisit: Record<ID, number>;
  bestCheckout: Record<ID, number>;
  coAtt: Record<ID, number>;
  coHit: Record<ID, number>;
};

// Résumé de match (léger, stable, commun à toutes les pages)
export type MatchSummary = {
  id: ID;
  kind: "x01" | "cricket" | string;
  players: PlayerLite[];
  legs: number;
  darts: number;
  winnerId?: ID | null;
  avg3ByPlayer: Record<ID, number>;
  co: number; // total checkouts du match
};

// Stats rapides par profil pour Accueil / Profils / Page Stats
export type ProfileQuickStats = {
  games: number;
  legs: number;
  darts: number;
  avg3: number;
  bestVisit: number;
  bestCheckout: number;
  h60: number;
  h100: number;
  h140: number;
  h180: number;
  coRate: number; // %
};

/* =========================================================
   X01 — Politique de fin + Résultats de manche (modèle existant)
   ========================================================= */

// Politique de fin de manche : s'arrêter au 1er checkout ou continuer
export type FinishPolicy = "firstToZero" | "continueUntilPenultimate";

// Résultat d'une manche (leg) — (conservé, utilisé par certains écrans)
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

// Agrégat multi-manches (conservé)
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
  sets?: number;
  legs?: number;
};

/* =========================================================
   Sauvegardes / Reprise des parties (modèle existant conservé)
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

// ⚠️ Conservé tel quel : sert à la reprise + stats par match côté “saved”
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
  stats?: MatchStats;          // stats/glossaire de la partie (optionnel)
};

/* ===== Variante d'historique compact (optionnel) =====
   Si tu utilises un module History séparé, ce type sert
   de “ligne” légère en localStorage (évite le conflit de nom). */
export type HistorySavedMatch = {
  id: ID;
  kind?: "x01" | "cricket" | string;
  status?: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: ID | null;
  createdAt?: number;
  updatedAt?: number;
  summary?: {
    legs?: number;
    darts?: number;
    avg3ByPlayer?: Record<ID, number>;
    co?: number; // total checkouts du match
  } | null;
  payload?: any; // peut être tronqué par le module d'historique
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
