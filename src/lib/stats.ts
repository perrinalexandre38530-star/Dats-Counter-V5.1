// ============================================
// src/lib/stats.ts
// Gestion et calculs des statistiques joueurs
// (X01 / Cricket / autres modes futurs)
// ============================================

import type { MatchRecord, PlayerStats } from "./types";

/* =========================================================
   Helpers de calcul
   ========================================================= */

/**
 * Moyenne par 3 fléchettes (volée)
 */
export function avgPerThree(darts: number, score: number): number {
  if (!darts || darts === 0) return 0;
  return Math.round((score / darts) * 3 * 100) / 100;
}

/**
 * Calcule le pourcentage de réussite au checkout
 */
export function checkoutRate(checkouts: number, attempts: number): number {
  if (!attempts) return 0;
  return Math.round((checkouts / attempts) * 100);
}

/**
 * Renvoie les meilleures volées (60+, 100+, 140+, 180)
 */
export function classifyVisits(visits: number[]): Record<string, number> {
  const bins = { "60+": 0, "100+": 0, "140+": 0, "180": 0 };
  for (const v of visits) {
    if (v >= 180) bins["180"]++;
    else if (v >= 140) bins["140+"]++;
    else if (v >= 100) bins["100+"]++;
    else if (v >= 60) bins["60+"]++;
  }
  return bins;
}

/* =========================================================
   Génération de stats pour un match complet
   ========================================================= */

/**
 * Construit un objet PlayerStats à partir des données brutes
 */
export function buildPlayerStats(record: MatchRecord, playerId: string): PlayerStats {
  const darts = record.darts?.[playerId] ?? 0;
  const visits = record.visits?.[playerId] ?? 0;
  const remaining = record.remaining?.[playerId] ?? 0;
  const avg3 = record.avg3?.[playerId] ?? 0;
  const bestVisit = record.bestVisit?.[playerId] ?? 0;
  const checkouts = record.checkouts?.[playerId] ?? 0;
  const checkoutAttempts = record.checkoutAttempts?.[playerId] ?? 0;

  const rate = checkoutRate(checkouts, checkoutAttempts);

  return {
    id: playerId,
    darts,
    visits,
    remaining,
    avg3,
    bestVisit,
    checkouts,
    checkoutAttempts,
    checkoutRate: rate,
  };
}

/**
 * Calcule les stats globales d’un match pour tous les joueurs
 */
export function computeMatchStats(record: MatchRecord) {
  const out: Record<string, PlayerStats> = {};
  for (const pid of record.order) {
    out[pid] = buildPlayerStats(record, pid);
  }
  return out;
}

/* =========================================================
   Persistance — Sauvegarde / chargement des stats
   ========================================================= */

/**
 * Sauvegarde des statistiques d’un match dans le stockage local
 */
export function saveMatchStats(matchId: string, data: any) {
  try {
    const key = `stats:${matchId}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("Erreur saveMatchStats:", err);
  }
}

/**
 * Récupération d’un set de stats depuis le stockage local
 */
export function loadMatchStats(matchId: string): any | null {
  try {
    const key = `stats:${matchId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("Erreur loadMatchStats:", err);
    return null;
  }
}

/* =========================================================
   Agrégation — Pour le Hub Stats global
   ========================================================= */

/**
 * Combine plusieurs matchs pour des stats cumulées (moyennes, taux, etc.)
 */
export function aggregateStats(matches: MatchRecord[], playerId: string) {
  let totalDarts = 0;
  let totalScore = 0;
  let totalCheckouts = 0;
  let totalAttempts = 0;
  let games = 0;

  for (const rec of matches) {
    if (!rec.avg3?.[playerId]) continue;
    totalDarts += rec.darts?.[playerId] ?? 0;
    totalScore += rec.visits?.[playerId] ?? 0;
    totalCheckouts += rec.checkouts?.[playerId] ?? 0;
    totalAttempts += rec.checkoutAttempts?.[playerId] ?? 0;
    games++;
  }

  const avg = games ? Math.round((totalScore / totalDarts) * 3 * 100) / 100 : 0;
  const rate = totalAttempts ? Math.round((totalCheckouts / totalAttempts) * 100) : 0;

  return { avg3: avg, checkoutRate: rate, games };
}

/* =========================================================
   Exports globaux
   ========================================================= */

export default {
  avgPerThree,
  checkoutRate,
  classifyVisits,
  computeMatchStats,
  buildPlayerStats,
  aggregateStats,
  saveMatchStats,
  loadMatchStats,
};
