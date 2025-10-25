// ============================================
// src/lib/types.ts — version corrigée & complète
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
  stats?: ProfileStats | any; // garde compatibilité avec ton ancien code
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

/* ===== Historique / Parties ===== */
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

/* ===== Store global ===== */
export type Store = {
  profiles: Profile[];
  settings: Settings;
  history: MatchRecord[];

  /** Profil actuellement connecté */
  activeProfileId: ID | null;

  /** Liste d’amis (en ligne / absents / hors ligne) */
  friends: Friend[];

  /** Statut du joueur actuel */
  selfStatus: "online" | "away" | "offline";

  /** Mutateur centralisé pour update le store */
  put: (updater: (s: Store) => Store) => void;
};
