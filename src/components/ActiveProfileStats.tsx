// ============================================
// src/components/ActiveProfileStats.tsx — Widget Accueil
// ============================================
import { useEffect, useState } from "react";
import { getBasicProfileStats, type BasicProfileStats } from "../lib/statsBridge";
import { loadStore } from "../lib/storage";

export default function ActiveProfileStats() {
  const [pid, setPid] = useState<string>("");
  const [s, setS] = useState<BasicProfileStats | null>(null);

  useEffect(() => {
    (async () => {
      const store = await loadStore().catch(() => null);
      const id = store?.activeProfileId ?? store?.profiles?.[0]?.id ?? "";
      setPid(id);
      if (id) setS(await getBasicProfileStats(id));
    })();
  }, []);

  if (!pid || !s) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(255,215,0,0.35)",
        background: "linear-gradient(90deg,#e6c20022,#0000)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 900 }}>Profil actif</div>
        <div style={{ opacity: 0.8 }}>· {pid}</div>
        <div style={{ marginLeft: "auto", color: "#ffd700", fontWeight: 900 }}>
          Moy/3: {s.avg3.toFixed(2)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        <Mini label="W/P" value={`${s.legsWon}/${s.legsPlayed}`} />
        <Mini label="Best" value={s.bestVisit} />
        <Mini label="180s" value={s.bins180} />
        <Mini label="Highest CO" value={s.highestCO} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 10,
        padding: 8,
        fontSize: 12,
      }}
    >
      <div style={{ opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 14 }}>{value}</div>
    </div>
  );
}