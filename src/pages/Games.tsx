// ============================================
// src/pages/Games.tsx — Sélecteur de modes de jeu
// ============================================
import React from "react";

export default function Games({
  setTab,
}: {
  setTab: (tab: any) => void;
}) {
  // -- Déclare les jeux ici (seul X01 est activé)
  const GAMES: {
    id: string;
    title: string;
    subtitle: string;
    tab: string;
    enabled: boolean;
  }[] = [
    { id: "x01", title: "X01", subtitle: "301 / 501 / 701 / 1001 — double-out", tab: "x01setup", enabled: true },
    { id: "cricket", title: "Cricket", subtitle: "15–20 + Bull — fermetures et points", tab: "cricket", enabled: false },
    { id: "killer", title: "Killer", subtitle: "Double ton numéro — deviens Killer", tab: "killer", enabled: false },
    { id: "shanghai", title: "Shanghai", subtitle: "Cible du tour, S/D/T — Shanghai = win", tab: "shanghai", enabled: false },
    { id: "battle", title: "Battle Royale", subtitle: "Mode fun à plusieurs — éliminations successives", tab: "battle", enabled: false },
  ];

  return (
    <div
      className="container"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* -------- Titre principal -------- */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          marginBottom: 10,
          letterSpacing: 1,
        }}
      >
        TOUS LES JEUX
      </div>
      <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 8 }}>
        Sélectionne un mode de jeu :
      </div>

      {/* -------- Liste des cartes de jeu -------- */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {GAMES.map((g) => (
          <GameCard
            key={g.id}
            title={g.title}
            subtitle={g.subtitle}
            onClick={() => setTab(g.tab)}
            disabled={!g.enabled}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Carte de sélection de jeu ---------- */
function GameCard({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <button
      aria-disabled={disabled ? true : undefined}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      title={disabled ? "Bientôt disponible" : undefined}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "14px 18px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.08)",
        background: "linear-gradient(180deg, rgba(25,25,28,.6), rgba(15,15,18,.7))",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "transform 0.15s ease",
        pointerEvents: "auto", // On garde le tooltip
      }}
      onMouseEnter={(e) =>
        !disabled && (e.currentTarget.style.transform = "scale(1.02)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <div>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>

      <span
        style={{
          background: disabled
            ? "linear-gradient(180deg, #6b7280, #4b5563)" // gris
            : "linear-gradient(180deg, #ffc63a, #ffaf00)",
          color: disabled ? "#e5e7eb" : "#111",
          borderRadius: 999,
          padding: "6px 14px",
          fontWeight: 800,
          fontSize: 13,
          border: disabled ? "1px solid rgba(148,163,184,.35)" : "1px solid rgba(255,180,0,.35)",
          boxShadow: disabled ? "none" : "0 0 10px rgba(240,177,42,.25)",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {disabled ? (
          <>
            <span aria-hidden>🔒</span> Bientôt
          </>
        ) : (
          "Jouer"
        )}
      </span>
    </button>
  );
}
