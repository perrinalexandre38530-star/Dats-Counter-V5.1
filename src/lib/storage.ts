import type { Store, Friend } from "./types";

/* ============================================
   DARTS COUNTER — Gestion du stockage local
   ============================================ */

const STORAGE_KEY = "darts-counter-store-v5";

/** Valeurs par défaut du store */
const DEFAULT_STORE: Store = {
  profiles: [],
  settings: {
    lang: "fr",
    ttsOnThird: true,
    neonTheme: true,
    defaultX01: 501,
    doubleOut: true,
    randomOrder: true,
  },
  history: [],
  activeProfileId: null,
  friends: [],          // ← indispensable
  selfStatus: "online", // ← indispensable
  put: (u) => { /* ta logique existante */ }
};

/** Charge le store depuis localStorage */
export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const merged = { ...DEFAULT_STORE, ...parsed };

    // Ajoute la méthode "put" après coup
    return {
      ...merged,
      put: (updater) => {
        const next = updater({ ...merged, put: merged.put });
        saveStore(next);
        return next;
      },
    };
  } catch (err) {
    console.error("Erreur de lecture du store :", err);
    return {
      ...DEFAULT_STORE,
      put: (updater) => {
        const next = updater({ ...DEFAULT_STORE });
        saveStore(next);
        return next;
      },
    };
  }
}

/** Sauvegarde le store dans localStorage */
export function saveStore(store: Store): Store {
  try {
    const clone = { ...store };
    delete (clone as any).put; // on retire la fonction avant d’enregistrer
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
  } catch (err) {
    console.error("Erreur lors de la sauvegarde :", err);
  }
  return store;
}

/** Reset total (utile pour debug ou réinit) */
export function clearStore() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}
