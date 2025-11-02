// ============================================
// src/lib/ratings.ts
// Mappe une moyenne 3-darts -> 0..5 étoiles
// ============================================
export function avg3dToStars(avg3d: number | null | undefined): 0 | 1 | 2 | 3 | 4 | 5 {
  const v = typeof avg3d === "number" && isFinite(avg3d) ? avg3d : 0;
  if (v >= 100) return 5;
  if (v >= 80)  return 4;
  if (v >= 60)  return 3;
  if (v >= 40)  return 2;
  if (v >= 20)  return 1;
  return 0;
}

  