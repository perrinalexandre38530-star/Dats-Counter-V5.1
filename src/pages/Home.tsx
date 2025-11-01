// ============================================
// src/pages/Home.tsx
// Accueil + Carte profil (stats unifiées)
// - Médaillon avatar centré & zoom anti-bords (cover + scale)
// - Layout mobile sans scroll + variante ultra-compacte
// - Grille 2 colonnes sur tablette
// ============================================

import React from "react";
import ProfileAvatar from "../components/ProfileAvatar";
import type { Store, Profile } from "../lib/types";
import { getBasicProfileStats, type BasicProfileStats } from "../lib/statsBridge";

type Tab =
  | "home" | "games" | "profiles" | "friends" | "all" | "stats" | "settings"
  | "x01setup" | "x01" | "cricket" | "killer" | "shanghai" | "lobby";

export default function Home({
  store,
  go,
  showConnect = true,
  onConnect,
}: {
  store: Store;
  go: (tab: Tab) => void;
  showConnect?: boolean;
  onConnect?: () => void;
}) {
  const profiles = store?.profiles ?? [];
  const activeProfileId = store?.activeProfileId ?? null;
  const active = profiles.find((p) => p.id === activeProfileId) ?? null;

  const basicStats = useBasicStats(active?.id || null);

  return (
    <div
      className="home-page container"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 10,
        paddingBottom: 0,
        gap: 12,
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      {/* ---- Styles responsives & variables ---- */}
      <style>{`
        .home-page {
          --title-min: 28px;
          --title-ideal: 8vw;
          --title-max: 44px;
          --card-pad: 16px;
          --menu-gap: 10px;
          --avatar-size: 92px;
          --avatar-scale: 1.06; /* léger zoom pour manger les bords transparents */
          --avatar-dx: 0px;     /* micro-réglage optionnel horizontal */
          --avatar-dy: 0px;     /* micro-réglage optionnel vertical */
          --bottomnav-h: 70px;
          --menu-title: 16px;
          --menu-sub: 12.5px;
        }
        /* Ultra-compact: petits téléphones / faible hauteur */
        @media (max-height: 680px), (max-width: 360px) {
          .home-page {
            --title-min: 24px;
            --title-ideal: 7vw;
            --title-max: 36px;
            --card-pad: 12px;
            --menu-gap: 8px;
            --avatar-size: 80px;
            --menu-title: 15px;
            --menu-sub: 11.5px;
            --bottomnav-h: 64px;
          }
        }
        /* Tablette: élargir et basculer les cartes en 2 colonnes */
        @media (min-width: 640px) {
          .home-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--menu-gap); }
        }
      `}</style>

      {/* ===== HERO ===== */}
      <div
        className="card"
        style={{
          padding: "var(--card-pad)",
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 18px 36px rgba(0,0,0,.40)",
          gap: 8,
        }}
      >
        <div className="title-accent" style={{ marginBottom: 0 }}>
          Bienvenue
        </div>

        <h1
          className="title-xl"
          style={{
            fontSize: "clamp(var(--title-min), var(--title-ideal), var(--title-max))",
            lineHeight: 1.05,
            margin: "4px 0 6px",
            color: "var(--gold-2)",
            textShadow: "0 6px 18px rgba(240,177,42,.35)",
            whiteSpace: "normal",
            wordBreak: "break-word",
            paddingInline: 8,
            maxWidth: "100%",
          }}
        >
          DARTS COUNTER
        </h1>

        {!active && showConnect ? (
          <button
            className="btn primary"
            style={{
              fontSize: 15,
              padding: "10px 22px",
              borderRadius: 14,
              boxShadow: "0 0 18px rgba(240,177,42,.22)",
            }}
            onClick={onConnect ?? (() => go("profiles"))}
          >
            SE CONNECTER
          </button>
        ) : active ? (
          <ActiveProfileCard
            profile={active}
            status={(store?.selfStatus as any) ?? "online"}
            onNameClick={() => go("stats")}
            basicStats={basicStats}
          />
        ) : null}
      </div>

      {/* ===== ACCÈS RAPIDES ===== */}
      <div
        className="list home-grid"
        style={{
          width: "100%",
          maxWidth: 520,
          gap: "var(--menu-gap)",
          display: "flex",          // remplacé par grid >=640px via .home-grid
          flexDirection: "column",
          paddingInline: 12,
        }}
      >
        <HomeCard
          title="PROFILS"
          subtitle="Création et gestion de profils"
          icon={<Icon name="profiles" size={24} />}
          onClick={() => go("profiles")}
        />
        <HomeCard
          title="JEU LOCAL"
          subtitle="Accède à tous les modes de jeu"
          icon={<Icon name="target" size={24} />}
          onClick={() => go("games")}
        />
        <HomeCard
          title="JEU ONLINE"
          subtitle="Parties à distance (mode à venir)"
          icon={<Icon name="online" size={24} />}
          disabled
        />
        <HomeCard
          title="STATS"
          subtitle="Statistiques et historiques"
          icon={<Icon name="stats" size={24} />}
          onClick={() => go("stats")}
        />
      </div>

      {/* Spacer bas = hauteur BottomNav */}
      <div style={{ height: "var(--bottomnav-h)" }} />
    </div>
  );
}

/* ---------- Hook: charge les stats basiques pour un profil ---------- */
function useBasicStats(pid: string | null) {
  const [cache, setCache] = React.useState<Record<string, BasicProfileStats | undefined>>({});
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pid) return;
      if (cache[pid]) return;
      try {
        const s = await getBasicProfileStats(pid);
        if (!cancelled) setCache((m) => ({ ...m, [pid]: s }));
      } catch {
        /* no-op */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);
  return pid ? cache[pid] : undefined;
}

/* ---------- Carte dorée du profil connecté ---------- */
function ActiveProfileCard({
  profile,
  status,
  onNameClick,
  basicStats,
}: {
  profile: Profile;
  status: "online" | "away" | "offline";
  onNameClick: () => void;
  basicStats?: BasicProfileStats;
}) {
  const legacy = (profile as any).stats || {};
  const s = {
    avg3: isNum(basicStats?.avg3) ? basicStats!.avg3 : (isNum(legacy.avg3) ? legacy.avg3 : 0),
    bestVisit: isNum(basicStats?.bestVisit) ? basicStats!.bestVisit : (isNum(legacy.bestVisit) ? legacy.bestVisit : 0),
    highestCheckout: isNum(basicStats?.highestCheckout) ? basicStats!.highestCheckout : (isNum(legacy.bestCheckout) ? legacy.bestCheckout : 0),
    legsPlayed: isNum(basicStats?.legsPlayed) ? basicStats!.legsPlayed : (isNum(legacy.legsPlayed) ? legacy.legsPlayed : 0),
    legsWon: isNum(basicStats?.legsWon) ? basicStats!.legsWon : (isNum(legacy.legsWon) ? legacy.legsWon : 0),
  };

  const avg3 = (Math.round((s.avg3 || 0) * 10) / 10).toFixed(1);
  const best = String(s.bestVisit || 0);
  const co = String(s.highestCheckout || 0);
  const wr = s.legsPlayed > 0 ? Math.round((s.legsWon / s.legsPlayed) * 100) : null;

  const statusLabel =
    status === "away" ? "Absent" : status === "offline" ? "Hors ligne" : "En ligne";
  const statusColor =
    status === "away" ? "var(--gold-2)" : status === "offline" ? "#9aa" : "var(--ok)";

  return (
    <div
      className="card"
      style={{
        width: "100%",
        maxWidth: 420,
        margin: "0 auto",
        background:
          "linear-gradient(180deg, rgba(240,177,42,.25), rgba(240,177,42,.10))",
        borderColor: "rgba(240,177,42,.45)",
        borderWidth: 1,
        borderStyle: "solid",
        borderRadius: 18,
        padding: 16,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 25px rgba(240,177,42,.15)",
        gap: 6,
      }}
    >
      {/* Médaillon : image brute centrée + zoom anti-bords */}
      <div
        style={{
          position: "relative",
          width: "var(--avatar-size)",
          height: "var(--avatar-size)",
          borderRadius: "50%",
          marginBottom: 6,
          border: "2px solid rgba(240,177,42,.5)",
          boxShadow: "0 0 20px rgba(240,177,42,.25)",
          overflow: "hidden",
          background: "#000",
        }}
        aria-label="avatar-medallion"
      >
        { (profile as any).avatarDataUrl ? (
          <img
            src={(profile as any).avatarDataUrl}
            alt={profile.name}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "50% 50%",
              transform: `translate(var(--avatar-dx), var(--avatar-dy)) scale(var(--avatar-scale))`,
              transformOrigin: "50% 50%",
              display: "block",
              background: "transparent",
            }}
            draggable={false}
          />
        ) : (
          <ProfileAvatar
            size={parseInt(getComputedStyle(document.documentElement)
              .getPropertyValue("--avatar-size").replace("px","")) || 92}
            dataUrl={undefined}
            label={profile.name[0]?.toUpperCase()}
          />
        )}
        {/* anneau décoratif interne */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            boxShadow: "inset 0 0 0 3px rgba(240,177,42,.25)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Nom cliquable */}
      <button
        className="btn ghost"
        onClick={onNameClick}
        style={{
          padding: 0,
          margin: 0,
          color: "var(--gold-2)",
          fontWeight: 900,
          fontSize: 20,
          textShadow: "0 0 12px rgba(240,177,42,.35)",
        }}
        title="Voir mes statistiques"
      >
        {profile.name}
      </button>

      {/* Statut */}
      <div
        className="subtitle"
        style={{
          marginTop: 0,
          fontSize: 13,
          color: statusColor,
          fontWeight: 500,
        }}
      >
        {statusLabel}
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          marginTop: 6,
          fontSize: 12,
          color: "rgba(255,255,255,.9)",
          flexWrap: "wrap",
        }}
      >
        <StatMini label="Moy/3" value={avg3} />
        <StatMini label="Best" value={best} />
        <StatMini label="CO" value={co} />
        <StatMini label="Win%" value={wr !== null ? `${wr}%` : "—"} />
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div className="subtitle" style={{ fontSize: 10.5, opacity: 0.8, lineHeight: 1.1 }}>
        {label}
      </div>
      <div style={{ fontWeight: 800, color: "var(--gold-2)", textShadow: "0 0 8px rgba(240,177,42,.3)" }}>
        {value}
      </div>
    </div>
  );
}

function HomeCard({
  title,
  subtitle,
  icon,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="item"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        paddingTop: 14,
        paddingBottom: 14,
        paddingInline: 10,
        background: "linear-gradient(180deg, rgba(20,20,26,.55), rgba(14,14,18,.75))",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.75 : 1,
        textAlign: "center",
        transition: "all .2s ease",
        borderRadius: 14,
      }}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow =
          "0 0 18px rgba(240,177,42,.18), 0 8px 18px rgba(0,0,0,.38)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div
        className="badge"
        aria-hidden
        style={{
          width: 50,
          height: 50,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: "rgba(255,255,255,.05)",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: "var(--gold-2)",
          fontWeight: 900,
          letterSpacing: 0.6,
          fontSize: "var(--menu-title)",
          textShadow: "0 0 12px rgba(240,177,42,.4)",
        }}
      >
        {title}
      </div>

      <div
        className="subtitle"
        style={{
          marginTop: 0,
          maxWidth: 420,
          fontSize: "var(--menu-sub)",
          lineHeight: 1.3,
          color: "var(--muted)",
        }}
      >
        {subtitle}
      </div>
    </button>
  );
}

/* ---------- Icônes ---------- */
function Icon({
  name,
  size = 22,
}: {
  name: "profiles" | "target" | "online" | "stats";
  size?: number;
}) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  switch (name) {
    case "profiles":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path {...p} d="M4 20a6.5 6.5 0 0 1 16 0" />
          <circle {...p} cx="12" cy="8" r="3.6" />
        </svg>
      );
    case "target":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <circle {...p} cx="12" cy="12" r="9" />
          <circle {...p} cx="12" cy="12" r="5.5" />
          <circle {...p} cx="12" cy="12" r="2" fill="currentColor" />
          <path {...p} d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </svg>
      );
    case "online":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <circle {...p} cx="12" cy="12" r="8" />
          <path {...p} d="M2 12h20" />
          <path {...p} d="M12 2a15 15 0 0 1 0 20" />
          <path {...p} d="M12 2a15 15 0 0 0 0 20" />
        </svg>
      );
    case "stats":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path {...p} d="M4 20V7" />
          <path {...p} d="M10 20V4" />
          <path {...p} d="M16 20v-6" />
          <path {...p} d="M22 20V9" />
        </svg>
      );
  }
  return null;
}

/* ---------- Utils ---------- */
function isNum(v: any): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}
