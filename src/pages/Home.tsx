import React from "react";
import ProfileAvatar from "../components/ProfileAvatar";
import type { Store, Profile } from "../lib/types";

/* ---------- Props ---------- */
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
  const active = store.profiles.find(p => p.id === store.activeProfileId) || null;

  return (
    <div
      className="container"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 90px)",
        gap: 28,
        textAlign: "center",
      }}
    >
      {/* ===== HERO ===== */}
      <div
        className="card"
        style={{
          padding: 32,
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 25px 45px rgba(0,0,0,.45)",
        }}
      >
        <div className="title-accent" style={{ marginBottom: 12 }}>
          Bienvenue,
        </div>

        <h1
          className="title-xl"
          style={{
            fontSize: 50,
            lineHeight: 1.05,
            marginBottom: 18,
            color: "var(--gold-2)",
            textShadow: "0 6px 18px rgba(240,177,42,.35)",
            whiteSpace: "nowrap",
          }}
        >
          DARTS COUNTER
        </h1>

        {/* --- soit le bouton Connexion, soit la carte dorée du profil actif --- */}
        {(!active && showConnect) ? (
          <button
            className="btn primary"
            style={{
              fontSize: 15,
              padding: "12px 28px",
              borderRadius: 16,
              boxShadow: "0 0 24px rgba(240,177,42,.25)",
            }}
            onClick={onConnect ?? (() => go("profiles"))}
          >
            SE CONNECTER
          </button>
        ) : active ? (
          <ActiveProfileCard
            profile={active}
            status={store.selfStatus ?? "online"}
            onNameClick={() => go("stats")}
          />
        ) : null}
      </div>

      {/* ===== ACCÈS RAPIDES ===== */}
      <div
        className="list"
        style={{
          width: "100%",
          maxWidth: 520,
          gap: 16,
        }}
      >
        <HomeCard
          title="PROFILS"
          subtitle="Création et gestion de profils"
          icon={<Icon name="profiles" size={26} />}
          onClick={() => go("profiles")}
        />
        <HomeCard
          title="JEU LOCAL"
          subtitle="Accède à tous les modes de jeu"
          icon={<Icon name="target" size={26} />}
          onClick={() => go("games")}
        />
        <HomeCard
          title="JEU ONLINE"
          subtitle="Parties à distance (mode à venir)"
          icon={<Icon name="online" size={26} />}
          disabled
        />
        <HomeCard
          title="STATS"
          subtitle="Statistiques et historiques"
          icon={<Icon name="stats" size={26} />}
          onClick={() => go("stats")}
        />
      </div>
    </div>
  );
}

/* ---------- Carte dorée du profil connecté sous le titre ---------- */
function ActiveProfileCard({
  profile,
  status,
  onNameClick,
}: {
  profile: Profile;
  status: "online" | "away" | "offline";
  onNameClick: () => void;
}) {
  const s = profile.stats || {};
  const avg3 = isNum(s.avg3) ? (Math.round(s.avg3 * 10) / 10).toFixed(1) : "—";
  const best = isNum(s.bestVisit) ? s.bestVisit : "—";
  const co = isNum(s.bestCheckout) ? s.bestCheckout : "—";
  const w = isNum(s.wins) ? s.wins : 0;
  const l = isNum(s.losses) ? s.losses : 0;
  const wr = w + l > 0 ? Math.round((w / (w + l)) * 100) : null;

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
        borderRadius: 20,
        padding: 22,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 25px rgba(240,177,42,.15)",
      }}
    >
      {/* Avatar rond au centre */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          overflow: "hidden",
          marginBottom: 12,
          border: "2px solid rgba(240,177,42,.5)",
          boxShadow: "0 0 20px rgba(240,177,42,.25)",
        }}
      >
        <ProfileAvatar
          size={100}
          dataUrl={profile.avatarDataUrl}
          label={profile.name[0]?.toUpperCase()}
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
          fontSize: 22,
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
          marginTop: 4,
          fontSize: 14,
          color: statusColor,
          fontWeight: 500,
        }}
      >
        {statusLabel}
      </div>

      {/* Stats sous le statut */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          marginTop: 10,
          fontSize: 13,
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

/* ---------- Mini-stat centrée ---------- */
function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        className="subtitle"
        style={{
          fontSize: 11,
          opacity: 0.8,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: 800,
          color: "var(--gold-2)",
          textShadow: "0 0 8px rgba(240,177,42,.3)",
        }}
      >
        {value}
      </div>
    </div>
  );
}


/* ---------- Mini stat en ligne ---------- */
function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ textAlign: "left" }}>
      <div className="subtitle" style={{ fontSize: 11 }}>{title}</div>
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
}
function Dot() {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: "var(--gold)",
        opacity: .6,
        display: "inline-block",
        alignSelf: "center",
      }}
    />
  );
}

/* ---------- Cartes d’accès rapide ---------- */
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
        gap: 10,
        paddingTop: 20,
        paddingBottom: 20,
        background:
          "linear-gradient(180deg, rgba(20,20,26,.55), rgba(14,14,18,.75))",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.75 : 1,
        textAlign: "center",
        transition: "all .2s ease",
      }}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow =
          "0 0 20px rgba(240,177,42,.18), 0 10px 25px rgba(0,0,0,.4)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div
        className="badge"
        aria-hidden
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
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
          fontSize: 18,
          textShadow: "0 0 12px rgba(240,177,42,.4)",
        }}
      >
        {title}
      </div>

      <div
        className="subtitle"
        style={{
          marginTop: 2,
          maxWidth: 420,
          fontSize: 13.5,
          lineHeight: 1.35,
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
