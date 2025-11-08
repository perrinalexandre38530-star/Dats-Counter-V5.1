// ============================================
// src/hooks/useHistory.ts
// Hook pour charger l'historique (IDB) + refresh simple
// ============================================
import { useEffect, useState } from "react";
import { History, type SavedMatch } from "../lib/history";

export function useHistory() {
  const [rows, setRows] = useState<SavedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const out = await History.list();
      setRows(out);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    // Mini bus d’événements via localStorage pour forcer un refresh inter-écrans
    const KEY = "dc-history-refresh";
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // exposer un moyen manuel de refresh après upsert/remove
  return { rows, loading, refresh };
}
