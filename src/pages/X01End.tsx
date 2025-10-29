// ============================================
// src/pages/X01End.tsx
// Page d’affichage du tableau de fin de partie (read-only)
// - Utilisée par go("x01_end", { recordId, record, readOnly: true, source: "history" })
// - Rend le composant EndOfLegOverlay en consultation (sans sons/TTS)
// ============================================
import React, { useMemo } from "react";
import EndOfLegOverlay from "../components/EndOfLegOverlay";

/* --- Types légers (compat) --- */
type PlayerMini = { id: string; name: string; avatarDataUrl?: string | null };

type LegResult = {
  legNo: number;
  winnerId: string;
  order: string[]; // classement (ids)
  finishedAt: number;
  remaining: Record<string, number>;
  darts: Record<string, number>;
  visits: Record<string, number>;
  avg3?: Record<string, number>;
  bestVisit?: Record<string, number>;
  highCheckout?: Record<string, number>;
  hits?: {
    s60?: Record<string, number>;
    s100?: Record<string, number>;
    s140?: Record<string, number>;
    s180?: Record<string, number>;
    dbl?: Record<string, number>;
    tpl?: Record<string, number>;
    bull?: Record<string, number>;
    dbull?: Record<string, number>;
  };
};

type SavedMatch = {
  id: string;
  kind: "x01" | "cricket" | string;
  status: "in_progress" | "finished";
  players?: PlayerMini[];
  winnerId?: string | null;
  updatedAt?: number;
  legResults?: LegResult[]; // attendu si tu l’as déjà en base
  [k: string]: any;
};

export default function X01End({
  go,
  params,
}: {
  go?: (tab: string, p?: any) => void;
  params?: any;
}) {
  const record: SavedMatch | null =
    params?.record ?? params?.match ?? null;

  const lastLeg: LegResult | null = useMemo(() => {
    if (!record) return null;
    if (Array.isArray(record.legResults) && record.legResults.length > 0) {
      return record.legResults[record.legResults.length - 1]!;
    }
    // Fallback minimal si on ne stocke pas legResults mais qu’on a un classement final
    if (record.finalOrder && Array.isArray(record.finalOrder)) {
      const ids: string[] = record.finalOrder;
      const players: PlayerMini[] = record.players ?? [];
      const now = record.updatedAt ?? Date.now();
      const emptyNumMap = Object.fromEntries(
        (players ?? []).map((p) => [p.id, 0])
      ) as Record<string, number>;
      const res: LegResult = {
        legNo: record.legNo ?? 1,
        winnerId: ids[0] ?? (record.winnerId ?? (players[0]?.id ?? "")),
        order: ids,
        finishedAt: now,
        remaining: record.remaining ?? emptyNumMap,
        darts: record.darts ?? emptyNumMap,
        visits: record.visits ?? emptyNumMap,
        avg3: record.avg3 ?? emptyNumMap,
        bestVisit: record.bestVisit ?? emptyNumMap,
        highCheckout: record.highCheckout ?? emptyNumMap,
        hits: record.hits ?? {
          s60: emptyNumMap,
          s100: emptyNumMap,
          s140: emptyNumMap,
          s180: emptyNumMap,
          dbl: emptyNumMap,
          tpl: emptyNumMap,
          bull: emptyNumMap,
          dbull: emptyNumMap,
        },
      };
      return res;
    }
    return null;
  }, [record]);

  const players: PlayerMini[] = useMemo(
    () => record?.players ?? [],
    [record]
  );

  function goBack() {
    (go ?? (() => {}))("stats", { tab: "history" });
  }

  if (!record) {
    return (
      <div
        style={{
          padding: 16,
          maxWidth: 720,
          margin: "0 auto",
          color: "#fff",
        }}
      >
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <button
            onClick={goBack}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "#fff",
            }}
          >
            ← Retour
          </button>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            Fin de partie
          </div>
        </div>
        Impossible de charger l’enregistrement.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 12,
        maxWidth: 720,
        margin: "0 auto",
        color: "#fff",
      }}
    >
      {/* Header simple */}
      <div
        style={{
          margin: "6px 0 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={goBack}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "#fff",
            }}
          >
            ← Retour
          </button>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            Tableau de fin de partie
          </div>
        </div>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 12,
            background: "rgba(0,180,120,.18)",
            border: "1px solid rgba(0,180,120,.35)",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          FINISHED
        </div>
      </div>

      {/* Rend l’overlay en lecture seule */}
      {lastLeg ? (
        <EndOfLegOverlay
          // Les props exactes de ton overlay peuvent varier.
          // On passe en "any" pour tolérer les différences et forcer le mode lecture seule.
          {...({
            result: lastLeg,
            players,
            readOnly: true,
            fromHistory: true,
            onClose: goBack,
          } as any)}
        />
      ) : (
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background:
              "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
            border: "1px solid rgba(255,255,255,.12)",
          }}
        >
          Aucune donnée de manche trouvée pour cette partie.
        </div>
      )}
    </div>
  );
}
