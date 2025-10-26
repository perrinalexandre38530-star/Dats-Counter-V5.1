// ============================================
// HeaderScoreCard — carte du haut (avatar + score + 3 derniers coups)
// ============================================
import React from "react";

export default function HeaderScoreCard({
  score,
  avatarDataUrl,
  lastThree,       // ex: ["T17","S5","S20"]
  mode = "X01",
}: {
  score: number;
  avatarDataUrl?: string | null;
  lastThree: string[];
  mode?: string;
}) {
  const card: React.CSSProperties = {
    background:
      "radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.10), transparent 55%), linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.8))",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,.35)",
  };

  const chip = (label: string, key?: React.Key) => (
    <span
      key={key ?? label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 48,
        height: 36,
        padding: "0 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.08)",
        background:
          "radial-gradient(120% 120% at 50% 0%, rgba(255,195,26,.18), rgba(30,30,34,.6))",
        color: "#f7d169",
        fontWeight: 700,
        letterSpacing: 0.2,
        boxShadow: "0 0 18px rgba(255,195,26,.25)",
      }}
    >
      {label}
    </span>
  );

  const avatar = (src?: string | null, size = 80) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "linear-gradient(180deg, #1b1b1f, #111114)",
        border: "1px solid rgba(255,255,255,.08)",
        boxShadow: "0 6px 18px rgba(0,0,0,.35)",
        flex: "0 0 auto",
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center", color: "#999", fontWeight: 700,
        }}>?</div>
      )}
    </div>
  );

  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {avatar(avatarDataUrl)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1,
              fontWeight: 800,
              color: "#ffcf57",
              textShadow: "0 4px 20px rgba(255,195,26,.25)",
            }}
          >
            {score}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {lastThree.map((t, i) => chip(t, i))}
          </div>
        </div>
        <div style={{ alignSelf: "flex-start", color: "#d8d8de", fontSize: 14, opacity: .8, fontWeight: 600 }}>
          Mode : <span style={{ fontWeight: 800 }}>{mode}</span>
        </div>
      </div>
    </div>
  );
}
