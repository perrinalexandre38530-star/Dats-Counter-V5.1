// ============================================
// src/pages/StatsHub.tsx — Stats + Historique (reprise intégrée)
// + Ouvre EndOfLegOverlay ("Classement de la manche") sur "Voir stats"
// + Supporte les entrées kind:"leg" (payload = LegResult)
// ============================================

import { useEffect, useMemo, useState } from "react";
import { History } from "../lib/history";
import EndOfLegOverlay from "../components/EndOfLegOverlay";

/* --- Types légers alignés sur l'usage actuel --- */
type PlayerLite = { id: string; name: string; avatarDataUrl?: string | null };
type SavedMatch = {
  id: string;
  kind: "x01" | "cricket" | "leg" | string;
  status?: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  updatedAt: number; // timestamp (ms)

  // exports possibles (matchs)
  lastLeg?: any;
  legResult?: any;
  result?: any;
  legs?: any[];

  // pour kind:"leg"
  payload?: any;
};

// store minimal pour retrouver les avatars quand rec.players est absent
type StoreLike = {
  profiles?: Array<{ id: string; name: string; avatarDataUrl?: string | null }>;
};

type StatsHubProps = {
  go?: (tab: string, params?: any) => void;
  store?: StoreLike;
};

type PlayerMini = { id: string; name: string; avatarDataUrl?: string | null };
type LegResult = Parameters<typeof EndOfLegOverlay>[0]["result"];

export default function StatsHub(props: StatsHubProps) {
  const go = props.go ?? (() => {});
  const store = props.store ?? { profiles: [] as StoreLike["profiles"] };
  const [tab, setTab] = useState<"stats" | "history">("history");

  // ========= ÉTAT OVERLAY =========
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayResult, setOverlayResult] = useState<LegResult | null>(null);
  const [overlayPlayers, setOverlayPlayers] = useState<Record<string, PlayerMini>>({});

  // helpers
  function buildPlayersMap(rec: SavedMatch, leg: any): Record<string, PlayerMini> {
    // priorité: joueurs embarqués dans l'entry
    const embedded = rec.players ?? [];
    if (embedded.length) {
      const map: Record<string, PlayerMini> = {};
      for (const p of embedded) {
        map[p.id] = { id: p.id, name: p.name, avatarDataUrl: p.avatarDataUrl ?? null };
      }
      return map;
    }

    // sinon: reconstruire depuis le store + ordre/ids présents dans le leg
    const ids: string[] =
      Array.isArray(leg?.order) && leg.order.length
        ? leg.order
        : Array.isArray(leg?.remaining)
        ? Object.keys(leg.remaining)
        : [];

    const byId: Record<string, PlayerMini> = {};
    const index = new Map((store.profiles ?? []).map((p) => [p.id, p]));
    for (const id of ids) {
      const prof = index.get(id);
      byId[id] = {
        id,
        name: prof?.name ?? id,
        avatarDataUrl: prof?.avatarDataUrl ?? null,
      };
    }
    return byId;
  }

  // ouvre l’overlay à partir d’un enregistrement d’historique
  function openOverlayFor(rec: SavedMatch) {
    // 1) si c’est une manche seule (kind:"leg"): payload = LegResult
    if (rec.kind === "leg" && rec.payload) {
      const leg = rec.payload;
      const playersById = buildPlayersMap(rec, leg);
      setOverlayPlayers(playersById);
      setOverlayResult(leg as LegResult);
      setOverlayOpen(true);
      return;
    }

    // 2) sinon: tenter de charger un match complet, puis en extraire le dernier LegResult
    const full = (History as any)?.get ? (History as any).get(rec.id) : rec;

    const legResult: any =
      full?.lastLeg ??
      full?.legResult ??
      full?.result ??
      (Array.isArray(full?.legs) && full.legs.length
        ? full.legs[full.legs.length - 1]?.result ?? full.legs[full.legs.length - 1]
        : null);

    if (!legResult) {
      alert("Aucune statistique détaillée trouvée pour cette partie.");
      return;
    }

    const playersById: Record<string, PlayerMini> = buildPlayersMap(full, legResult);
    setOverlayPlayers(playersById);
    setOverlayResult(legResult as LegResult);
    setOverlayOpen(true);
  }

  function handleResumeX01(rec: SavedMatch) {
    go("x01", { resumeId: rec.id });
  }
  function handleShowStats(rec: SavedMatch) {
    openOverlayFor(rec);
  }

  return (
    <>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Onglets */}
        <div
          style={{
            display: "inline-flex",
            gap: 8,
            padding: 6,
            borderRadius: 14,
            background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {(["stats", "history"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                appearance: "none" as React.CSSProperties["appearance"],
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.08)",
                background: tab === k ? "rgba(240,177,42,.18)" : "transparent",
                color: "#eee",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {k === "stats" ? "Stats" : "Historique"}
            </button>
          ))}
        </div>

        {tab === "stats" ? (
          <StatsPanel />
        ) : (
          <HistoryPanel onResumeX01={handleResumeX01} onShowStats={handleShowStats} />
        )}
      </div>

      {/* ===== Overlay de fin de manche (classement + stats) ===== */}
      <EndOfLegOverlay
        open={overlayOpen}
        result={overlayResult}
        playersById={overlayPlayers}
        onReplay={() => setOverlayOpen(false)}
        onClose={() => setOverlayOpen(false)}
        onSave={() => setOverlayOpen(false)}
      />
    </>
  );
}

/* ===== Onglet STATS (placeholder) ===== */
function StatsPanel() {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(20,20,24,.55), rgba(6,6,8,.7))",
        border: "1px solid rgba(255,255,255,.06)",
        color: "#e7e7e7",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8, color: "#f0b12a" }}>
        Stats (bientôt)
      </div>
      <div style={{ opacity: 0.8 }}>
        Ajoute ici tes moyennes, meilleurs checkouts, 180, etc.
      </div>
    </div>
  );
}

/* ===== Onglet HISTORIQUE ===== */
function HistoryPanel({
  onResumeX01,
  onShowStats,
}: {
  onResumeX01: (rec: SavedMatch) => void;
  onShowStats: (rec: SavedMatch) => void;
}) {
  const [kind, setKind] = useState<"all" | "x01" | "cricket" | "leg">("all");
  const [list, setList] = useState<SavedMatch[]>([]);

  useEffect(() => {
    setList((History.list() as unknown as SavedMatch[]) ?? []);
  }, []);
  function refresh() {
    setList((History.list() as unknown as SavedMatch[]) ?? []);
  }

  const filtered = useMemo(
    () => list.filter((r) => (kind === "all" ? true : r.kind === kind)),
    [list, kind]
  );

  return (
    <>
      {/* Filtres + actions globales */}
      <div
        style={{
          display: "flex",
          gap: 8,
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.08)",
          padding: 6,
          borderRadius: 12,
        }}
      >
        {(["all", "x01", "cricket", "leg"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            style={{
              appearance: "none" as React.CSSProperties["appearance"],
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.08)",
              background: kind === k ? "rgba(240,177,42,.18)" : "transparent",
              color: "#eee",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {k === "all" ? "Tous les jeux" : k.toUpperCase()}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            if (confirm("Vider tout l'historique ?")) {
              History.clear();
              refresh();
            }
          }}
          style={{
            appearance: "none" as React.CSSProperties["appearance"],
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.15)",
            background: "transparent",
            color: "#bbb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🗑️ Vider
        </button>
      </div>

      {/* Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((rec: SavedMatch) => (
          <HistoryItem
            key={rec.id}
            rec={rec}
            onResume={() => {
              if (rec.kind === "x01" && rec.status === "in_progress") onResumeX01(rec);
            }}
            onStats={() => onShowStats(rec)}
            onDelete={() => {
              History.remove(rec.id);
              refresh();
            }}
          />
        ))}

        {filtered.length === 0 && (
          <div style={{ opacity: 0.7, padding: 24, textAlign: "center" }}>
            Aucun enregistrement pour ce filtre.
          </div>
        )}
      </div>
    </>
  );
}

function HistoryItem({
  rec,
  onResume,
  onStats,
  onDelete,
}: {
  rec: SavedMatch;
  onResume: () => void;
  onStats: () => void;
  onDelete: () => void;
}) {
  const date = new Date(rec.updatedAt);
  const statusColor =
    rec.kind === "leg"
      ? "#41d17d"
      : rec.status === "in_progress"
      ? "#ff5b5b"
      : "#41d17d";
  const statusLabel =
    rec.kind === "leg"
      ? "LEG"
      : rec.status === "in_progress"
      ? "IN PROGRESS"
      : "FINISHED";
  const players = (rec.players ?? []).map((p: PlayerLite) => p.name).join(" · ");

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        background: "linear-gradient(180deg, rgba(20,20,24,.55), rgba(6,6,8,.7))",
        border: "1px solid rgba(255,255,255,.06)",
        boxShadow: "0 4px 18px rgba(0,0,0,.35)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        color: "#e7e7e7",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 800, color: "#f0b12a" }}>
          {(rec.kind ?? "").toUpperCase()}
        </div>
        <div style={{ opacity: 0.8 }}>
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontWeight: 800, color: statusColor }}>{statusLabel}</div>
      </div>

      {players && <div style={{ opacity: 0.9 }}>{players}</div>}
      {rec.kind !== "leg" && rec.status === "finished" && rec.winnerId && (
        <div style={{ opacity: 0.9 }}>🏆 {displayWinnerName(rec)}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {rec.kind === "x01" && rec.status === "in_progress" && (
          <button onClick={onResume} style={btnStyle("#2b2", "#173")}>
            Reprendre
          </button>
        )}
        <button onClick={onStats} style={btnStyle("#eee", "#222")}>
          Voir stats
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            if (confirm("Supprimer cette entrée ?")) onDelete();
          }}
          style={btnStyle("#f55", "#3a0")}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function btnStyle(fg: string, border: string): React.CSSProperties {
  return {
    appearance: "none" as React.CSSProperties["appearance"],
    padding: "8px 12px",
    borderRadius: 10,
    background: "transparent",
    border: `1px solid ${border}`,
    color: fg,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function displayWinnerName(rec: SavedMatch): string {
  const p = (rec.players ?? []).find((x) => x.id === rec.winnerId);
  return p ? p.name : "—";
}
