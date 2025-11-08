// ============================================
// src/boot/warmAgg.ts — Backfill agrégateur depuis History (one-shot)
// ============================================
import { History } from "../lib/history";
import { addMatchSummary } from "../lib/statsLiteIDB";
import { extractAggFromSavedMatch } from "../lib/aggFromHistory";

const FLAG = "dc-statslite-backfill-v1";

export async function warmAggOnce() {
  try {
    if (localStorage.getItem(FLAG)) return;
    const rows = await History.list();
    for (const r of rows || []) {
      const { winnerId, perPlayer } = extractAggFromSavedMatch(r);
      if (Object.keys(perPlayer).length) {
        await addMatchSummary({ winnerId, perPlayer });
      }
    }
    localStorage.setItem(FLAG, "1");
  } catch (e) {
    console.warn("warmAggOnce:", e);
  }
}
