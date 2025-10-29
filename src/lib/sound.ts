// ============================================
// src/lib/sound.ts — Gestion simple des sons
// ============================================

export function playSound(name: string) {
  try {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.volume = 0.9;
    audio.play().catch(() => {});
  } catch (err) {
    console.warn("Erreur lecture son:", name, err);
  }
}

// Version améliorée : choisit le bon son selon la fléchette
import type { Dart as UIDart } from "./types";

export function playDartSfx(dart: UIDart, volley?: UIDart[]) {
  const total = volley?.reduce((s, d) => s + (d.v === 25 && d.mult === 2 ? 50 : d.v * d.mult), 0) || 0;
  if (total === 180) return playSound("180");

  if (dart.v === 25 && dart.mult === 2) return playSound("doublebull");
  if (dart.v === 25) return playSound("bull");
  if (dart.mult === 3) return playSound("triple");
  if (dart.mult === 2) return playSound("double");

  return playSound("dart-hit");
}