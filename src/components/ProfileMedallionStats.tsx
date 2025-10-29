// ============================================
// src/components/ProfileMedallionStats.tsx
// ============================================
import * as React from "react";
import { getPlayerMedallionStats } from "../lib/stats";

export default function ProfileMedallionStats({ playerId }: { playerId: string }) {
  let m = { winRate: 0, avg3: 0, bestVisit: 0, highestCheckout: 0, ton180: 0 };
  try {
    if (playerId) m = getPlayerMedallionStats(playerId);
  } catch {
    // store vide/corrompu -> garde valeurs par défaut
  }

  return (
    <div style={{ fontSize: 12, opacity: 0.85 }}>
      <span>WR {(m.winRate * 100).toFixed(0)}%</span> •{" "}
      <span>Avg3 {m.avg3.toFixed(1)}</span> •{" "}
      <span>BV {m.bestVisit}</span> •{" "}
      <span>HiCO {m.highestCheckout}</span> •{" "}
      <span>180×{m.ton180}</span>
    </div>
  );
}
