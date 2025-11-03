// ============================================
// src/debugStore.ts
// Petit script pour afficher le contenu du store
// ============================================
import { loadStore } from "./lib/storage";

(async () => {
  const store = await loadStore<any>();
  console.log("======== STORE COMPLET ========");
  console.log(store);
  console.log("======== store.statsByPlayer ========");
  console.log(store.statsByPlayer);
  console.log("======== store.stats ========");
  console.log(store.stats);
  console.log("======== store.history (dernier résumé) ========");
  const h = Array.isArray(store.history) ? store.history : [];
  console.log(h[h.length - 1]?.summary);
})();
