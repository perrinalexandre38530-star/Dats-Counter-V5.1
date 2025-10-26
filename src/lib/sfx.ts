// ============================================
// src/lib/sfx.ts — Gestion centralisée des sons
// ============================================

// ⚠️ Adapte les chemins d’import à ton arborescence.
// Place tes mp3 dans: src/assets/sounds/ (ou ajuste)
import hit from "../assets/sounds/dart-hit.mp3";
import bust from "../assets/sounds/bust.mp3";
import s180 from "../assets/sounds/180.mp3";
import dble from "../assets/sounds/double.mp3";
import trpl from "../assets/sounds/triple.mp3";
import bull from "../assets/sounds/bull.mp3";
import dbull from "../assets/sounds/double-bull.mp3";

export const SFX = {
  hit,
  bust,
  "180": s180,
  dble,
  trpl,
  bull,
  dbull,
} as const;

function playSafe(url?: string) {
  if (!url) return;
  const a = new Audio(url);
  a.play().catch(() => {}); // évite "uncaught (in promise)"
}

/** Joue un son par clé */
export function playSfx(key: keyof typeof SFX) {
  playSafe(SFX[key]);
}

/** Mappe une flèche vers un son contextuel */
export function playThrowSound(dart: { mult: number; value: number }) {
  const { mult, value } = dart;
  if (value === 25 && mult === 2) return playSfx("dbull");
  if (value === 25 && mult === 1) return playSfx("bull");
  if (mult === 3) return playSfx("trpl");
  if (mult === 2) return playSfx("dble");
  return playSfx("hit");
}

/** Son spécial 180 */
export function playOneEighty(total: number) {
  if (total === 180) playSfx("180");
}

/** Son de bust */
export function playBust(isBust: boolean) {
  if (isBust) playSfx("bust");
}
