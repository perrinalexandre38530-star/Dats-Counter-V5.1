// ============================================
// src/pages/Profiles.tsx
// Profils (profil actif, amis fusionnés, profils locaux)
// - Bloc unique Connexion/Création (sans mot de passe)
// - Amis: un seul panneau repliable "Amis (N)" trié par statut
// - Profils locaux: compteur, mini-stats ruban doré, Éditer au-dessus de Suppr.
// ============================================

import React from "react";
import ProfileAvatar from "../components/ProfileAvatar";
import type { Store, Profile, Friend } from "../lib/types";
// ❌ plus d'import MiniStats
import { getBasicProfileStats, type BasicProfileStats } from "../lib/statsBridge";

/* ================================
   Page — Profils
================================ */
export default function Profiles({
  store,
  update,
  setProfiles,
  autoCreate = false,
}: {
  store: Store;
  update: (mut: (s: Store) => Store) => void;
  setProfiles: (fn: (p: Profile[]) => Profile[]) => void;
  autoCreate?: boolean;
}) {
  const {
    profiles = [],
    activeProfileId = null,
    friends = [],
    selfStatus = "online",
  } = store;

  const [statsMap, setStatsMap] = React.useState<Record<string, BasicProfileStats | undefined>>({});

  function setActiveProfile(id: string | null) {
    update((s) => ({ ...s, activeProfileId: id }));
  }

  function renameProfile(id: string, name: string) {
    setProfiles((arr) => arr.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  async function changeAvatar(id: string, file: File) {
    const url = await read(file);
    setProfiles((arr) => arr.map((p) => (p.id === id ? { ...p, avatarDataUrl: url } : p)));
  }

  function delProfile(id: string) {
    setProfiles((arr) => arr.filter((p) => p.id !== id));
    if (store.activeProfileId === id) setActiveProfile(null);
    setStatsMap((m) => {
      const c = { ...m };
      delete c[id];
      return c;
    });
  }

  async function addProfile(name: string, file?: File | null) {
    if (!name.trim()) return;
    const url = file ? await read(file) : undefined;
    const p: Profile = { id: crypto.randomUUID(), name: name.trim(), avatarDataUrl: url };
    setProfiles((arr) => [...arr, p]);
    update((s) => ({ ...s, activeProfileId: s.activeProfileId ?? p.id }));
  }

  const active = profiles.find((p) => p.id === activeProfileId) || null;

  // Cache stats du profil actif
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const pid = active?.id;
      if (!pid || statsMap[pid]) return;
      try {
        const s = await getBasicProfileStats(pid);
        if (!cancelled) setStatsMap((m) => ({ ...m, [pid]: s }));
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      {/* ===== Profil connecté ===== */}
      <Card title="Profil connecté">
        {active ? (
          <ActiveProfileBlock
            selfStatus={selfStatus}
            active={active}
            onToggleAway={() =>
              update((s) => ({ ...s, selfStatus: s.selfStatus === "away" ? ("online" as const) : ("away" as const) }))
            }
            onQuit={() => setActiveProfile(null)}
            onEdit={(n, f) => {
              if (n && n !== active.name) renameProfile(active.id, n);
              if (f) changeAvatar(active.id, f);
            }}
          />
        ) : (
          <UnifiedAuthBlock
            profiles={profiles}
            onConnect={(id) => setActiveProfile(id)}
            onCreate={addProfile}
            autoFocusCreate={autoCreate}
          />
        )}
      </Card>

      {/* ===== Amis (fusion) ===== */}
      <Card title={`Amis (${friends?.length ?? 0})`}>
        <FriendsMergedBlock friends={friends} />
      </Card>

      {/* ===== Profils locaux ===== */}
      <Card title={`Profils locaux (${profiles.length})`}>
        <AddLocalProfile onCreate={addProfile} />
        <div
          style={{
            maxHeight: "min(44vh, 420px)",
            minHeight: 260,
            overflowY: "auto",
            paddingRight: 6,
            marginTop: 6,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.06)",
            background: "linear-gradient(180deg, rgba(15,15,20,.55), rgba(12,12,16,.55))",
          }}
        >
          <LocalProfiles
            profiles={profiles}
            onRename={renameProfile}
            onAvatar={changeAvatar}
            onDelete={delProfile}
            statsMap={statsMap}
            warmup={(id) => warmProfileStats(id, setStatsMap)}
          />
        </div>
      </Card>
    </div>
  );
}

/* ================================
   Sous-composants
================================ */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ------ Profil actif (ruban doré Mini-Stats) ------ */
function ActiveProfileBlock({
  active,
  selfStatus,
  onToggleAway,
  onQuit,
  onEdit,
}: {
  active: Profile;
  selfStatus: "online" | "away" | "offline";
  onToggleAway: () => void;
  onQuit: () => void;
  onEdit: (name: string, avatar?: File | null) => void;
}) {
  return (
    <div className="row" style={{ gap: 14, alignItems: "center" }}>
      {/* Avatar médaillon */}
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: "50%",
          padding: 4,
          background: "linear-gradient(135deg, rgba(240,177,42,.9), rgba(120,80,10,.7))",
          boxShadow: "0 0 26px rgba(240,177,42,.35), inset 0 0 12px rgba(0,0,0,.55)",
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <ProfileAvatar size={96} dataUrl={active?.avatarDataUrl} label={active?.name?.[0]?.toUpperCase() || "?"} />
      </div>

      {/* Infos + actions */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 20, whiteSpace: "nowrap" }}>
          <a
            href={`#/stats?pid=${active?.id}`}
            onClick={(e) => {
              e.preventDefault();
              if (active?.id) location.hash = `#/stats?pid=${active.id}`;
            }}
            style={{ color: "#f0b12a", textDecoration: "none" }}
            title="Voir les statistiques"
          >
            {active?.name || "—"}
          </a>
        </div>

        {/* Statut */}
        <div className="row" style={{ gap: 8, alignItems: "center", marginTop: 4 }}>
          <StatusDot kind={selfStatus === "away" ? "away" : selfStatus === "offline" ? "offline" : "online"} />
          <span
            style={{
              fontWeight: 700,
              color: selfStatus === "away" ? "#f0b12a" : selfStatus === "offline" ? "#9aa0a6" : "#1fb46a",
            }}
          >
            {selfStatus === "away" ? "Absent" : selfStatus === "offline" ? "Hors ligne" : "En ligne"}
          </span>
        </div>

        {/* Ruban doré Mini-Stats */}
        {active?.id && (
          <div style={{ marginTop: 8, width: "100%" }}>
            <GoldMiniStats profileId={active.id} />
          </div>
        )}

        {/* Actions */}
        <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: "center", flexWrap: "nowrap" }}>
          <EditInline initialName={active?.name || ""} onSave={onEdit} compact={true} />
          <button className="btn sm" onClick={onToggleAway} title="Basculer le statut">
            {selfStatus === "away" ? "EN LIGNE" : "ABSENT"}
          </button>
          <button className="btn danger sm" onClick={onQuit} title="Quitter la session">
            QUITTER
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------ Bloc unique Connexion + Création (avec preview avatar) ------ */
function UnifiedAuthBlock({
  profiles,
  onConnect,
  onCreate,
  autoFocusCreate = false,
}: {
  profiles: Profile[];
  onConnect: (id: string) => void;
  onCreate: (name: string, file?: File | null) => void;
  autoFocusCreate?: boolean;
}) {
  const [chosen, setChosen] = React.useState<string>(profiles[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const createRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (autoFocusCreate) createRef.current?.focus();
  }, [autoFocusCreate]);

  React.useEffect(() => {
    if (!file) { setPreview(null); return; }
    const r = new FileReader();
    r.onload = () => setPreview(String(r.result));
    r.readAsDataURL(file);
  }, [file]);

  function submitCreate() {
    if (!name.trim()) return;
    onCreate(name.trim(), file);
    setName("");
    setFile(null);
    setPreview(null);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Connexion existant (sans mot de passe) */}
      <div className="row" style={{ gap: 8 }}>
        <select
          className="input"
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          style={{ flex: 1 }}
        >
          {profiles.length === 0 && <option value="">Aucun profil enregistré</option>}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="btn primary sm"
          onClick={() => chosen && onConnect(chosen)}
        >
          Connexion
        </button>
      </div>

      {/* Création rapide (preview avatar à gauche) */}
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <label
          title="Choisir un avatar"
          style={{
            width: 44, height: 44, borderRadius: "50%", overflow: "hidden",
            border: "1px solid var(--stroke)", display: "grid", placeItems: "center",
            background: "#0f0f14", cursor: "pointer", flex: "0 0 auto"
          }}
        >
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="subtitle" style={{ fontSize: 11 }}>Avatar</span>
          )}
        </label>

        <input
          ref={createRef}
          className="input"
          placeholder="Nom du profil"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitCreate()}
          style={{ flex: 1 }}
        />

        <button className="btn primary sm" onClick={submitCreate}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

/* ------ Amis fusionnés dans un seul panneau repliable ------ */
function FriendsMergedBlock({ friends }: { friends?: Friend[] }) {
  const list: Friend[] = Array.isArray(friends) ? friends : [];
  const [open, setOpen] = React.useState(true);

  // Tri: online -> away -> offline, puis par nom
  const order = { online: 0, away: 1, offline: 2 } as const;
  const merged = [...list].sort((a, b) => {
    const sa = order[(a.status ?? "offline") as keyof typeof order] ?? 2;
    const sb = order[(b.status ?? "offline") as keyof typeof order] ?? 2;
    if (sa !== sb) return sa - sb;
    return (a.name || "").localeCompare(b.name || "");
  });

  return (
    <div className="card" style={{ background: "#111118" }}>
      <button
        className="row-between"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "transparent",
          color: "inherit",
          border: 0,
          padding: "6px 2px",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        <span>Amis ({merged.length})</span>
        <span className="subtitle" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="list" style={{ marginTop: 6 }}>
          {merged.length === 0 ? (
            <div className="subtitle">Aucun ami pour l’instant</div>
          ) : (
            merged.map((f) => (
              <div className="item" key={f.id} style={{ background: "#0f0f14" }}>
                <div className="row" style={{ gap: 10, minWidth: 0 }}>
                  <ProfileAvatar size={44} dataUrl={f.avatarDataUrl} label={f.name?.[0]?.toUpperCase() || "?"} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{f.name || "—"}</div>
                    {f.stats && (
                      <div className="subtitle" style={{ whiteSpace: "nowrap" }}>
                        Moy/3: {fmt(f.stats?.avg3 ?? 0)} · Best: {f.stats?.bestVisit ?? 0} · Win: {Math.round((f.stats?.winrate ?? 0) * 100)}%
                      </div>
                    )}
                  </div>
                </div>
                <span className="subtitle" style={{ whiteSpace: "nowrap" }}>
                  {f.status === "online" ? "En ligne" : f.status === "away" ? "Absent" : "Hors-ligne"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ----- Formulaire d’ajout local ----- */
function AddLocalProfile({ onCreate }: { onCreate: (name: string, file?: File | null) => void }) {
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) { setPreview(null); return; }
    const r = new FileReader();
    r.onload = () => setPreview(String(r.result));
    r.readAsDataURL(file);
  }, [file]);

  function submit() {
    if (!name.trim()) return;
    onCreate(name.trim(), file);
    setName("");
    setFile(null);
    setPreview(null);
  }

  return (
    <div className="item" style={{ gap: 10, alignItems: "center", marginBottom: 8 }}>
      <label
        title="Choisir un avatar"
        style={{
          width: 44, height: 44, borderRadius: "50%", overflow: "hidden",
          border: "1px solid var(--stroke)", display: "grid", placeItems: "center",
          background: "#0f0f14", cursor: "pointer", flex: "0 0 auto"
        }}
      >
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {preview ? (
          <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span className="subtitle" style={{ fontSize: 11 }}>Avatar</span>
        )}
      </label>

      <input
        className="input"
        placeholder="Nom du profil"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ maxWidth: 260 }}
      />

      <div className="row" style={{ gap: 6 }}>
        <button className="btn primary sm" onClick={submit}>Ajouter</button>
        {(name || file) && (
          <button className="btn sm" onClick={() => { setName(""); setFile(null); setPreview(null); }}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}

/* ----- Liste des profils locaux ----- */
function LocalProfiles({
  profiles,
  onRename,
  onAvatar,
  onDelete,
  statsMap,
  warmup,
}: {
  profiles: Profile[];
  onRename: (id: string, name: string) => void;
  onAvatar: (id: string, file: File) => void;
  onDelete: (id: string) => void;
  statsMap: Record<string, BasicProfileStats | undefined>;
  warmup: (id: string) => void;
}) {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [tmpName, setTmpName] = React.useState<string>("");
  const [tmpFile, setTmpFile] = React.useState<File | null>(null);

  function startEdit(p: Profile) {
    setEditing(p.id);
    setTmpName(p.name || "");
    setTmpFile(null);
  }

  function saveEdit(id: string) {
    if (tmpName.trim()) onRename(id, tmpName.trim());
    if (tmpFile) onAvatar(id, tmpFile);
    setEditing(null);
    setTmpFile(null);
  }

  return (
    <div className="list">
      {profiles.map((p) => {
        const isEdit = editing === p.id;
        const s = statsMap[p.id];
        return (
          <div className="item" key={p.id} style={{ gap: 10, alignItems: "center" }}>
            {/* gauche */}
            <div className="row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{ flex: "0 0 auto" }}>
                <ProfileAvatar size={48} dataUrl={p.avatarDataUrl} label={p.name?.[0]?.toUpperCase() || "?"} />
              </div>

              <div style={{ minWidth: 0 }}>
                {isEdit ? (
                  <div className="row" style={{ gap: 8 }}>
                    <input className="input" value={tmpName} onChange={(e) => setTmpName(e.target.value)} style={{ width: 200 }} />
                    <label className="btn sm">
                      Avatar
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setTmpFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", textAlign: "left" }}>
                      <a
                        href={`#/stats?pid=${p.id}`}
                        onClick={(e) => { e.preventDefault(); location.hash = `#/stats?pid=${p.id}`; }}
                        onMouseEnter={() => warmup(p.id)}
                        style={{ color: "#f0b12a", textDecoration: "none" }}
                        title="Voir les statistiques"
                      >
                        {p.name || "—"}
                      </a>
                    </div>

                    {/* ruban doré */}
                    <div style={{ marginTop: 6 }}>
                      <GoldMiniStats profileId={p.id} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* droite: actions en colonne (Éditer au-dessus de Suppr.) */}
            <div className="col" style={{ gap: 6, display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 96 }}>
              {isEdit ? (
                <>
                  <button className="btn ok sm" onClick={() => saveEdit(p.id)}>Enregistrer</button>
                  <button className="btn sm" onClick={() => setEditing(null)}>Annuler</button>
                </>
              ) : (
                <>
                  <button className="btn sm" onClick={() => startEdit(p)}>Éditer</button>
                  <button className="btn danger sm" onClick={() => onDelete(p.id)}>Suppr.</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----- Edition inline du profil actif ----- */
function EditInline({
  initialName,
  onSave,
  onDisconnect,
  compact = true,
}: {
  initialName: string;
  onSave: (name: string, avatar?: File | null) => void;
  onDisconnect?: () => void;
  compact?: boolean;
}) {
  const [edit, setEdit] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [file, setFile] = React.useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setAvatarUrl(String(reader.result));
      reader.readAsDataURL(file);
    } else {
      setAvatarUrl(null);
    }
  }, [file]);

  if (!edit) {
    return (
      <button className="btn sm" onClick={() => setEdit(true)} title="Éditer le profil">
        ÉDITER
      </button>
    );
  }

  return (
    <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
      <label
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid rgba(240,177,42,.4)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          background: "#111118",
          position: "relative",
        }}
      >
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <img src={avatarUrl ?? ""} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: avatarUrl ? 1 : 0.2 }} />
        {!avatarUrl && <span style={{ position: "absolute", color: "#999", fontSize: 12, bottom: 6 }}>Cliquer</span>}
      </label>

      <input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ width: compact ? 160 : 200 }} />

      <button
        className="btn ok sm"
        onClick={() => {
          onSave(name, file);
          setEdit(false);
          setFile(null);
          setAvatarUrl(null);
        }}
      >
        Enregistrer
      </button>
      <button
        className="btn sm"
        onClick={() => {
          setEdit(false);
          setFile(null);
          setAvatarUrl(null);
        }}
      >
        Annuler
      </button>
      {onDisconnect && (
        <button className="btn danger sm" onClick={onDisconnect}>
          QUITTER
        </button>
      )}
    </div>
  );
}

/* ------ Ruban doré Mini-Stats (Moy/3, Best, CO, Win%) ------ */
function GoldMiniStats({ profileId }: { profileId: string }) {
  const [stats, setStats] = React.useState<BasicProfileStats | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getBasicProfileStats(profileId);
        if (!cancelled) setStats(s);
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => { cancelled = true; };
  }, [profileId]);

  const avg3 = stats?.avg3 ?? 0;
  const best = stats?.bestVisit ?? 0;
  const co = (stats as any)?.co ?? (stats as any)?.coCount ?? (stats as any)?.checkouts ?? 0;
  const winPct =
    stats && (stats as any).legsPlayed > 0
      ? Math.round(((stats as any).legsWon / (stats as any).legsPlayed) * 100)
      : null;

  return (
    <div
      style={{
        borderRadius: 10,
        padding: "8px 10px",
        background: "linear-gradient(180deg, rgba(60,42,15,.9), rgba(38,28,12,.9))",
        border: "1px solid rgba(240,177,42,.25)",
        boxShadow: "0 6px 16px rgba(0,0,0,.35), inset 0 0 0 1px rgba(0,0,0,.35)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          alignItems: "center",
        }}
      >
        <GoldStatItem label="Moy/3" value={(Math.round(avg3 * 10) / 10).toFixed(1)} />
        <GoldStatItem label="Best" value={String(best)} />
        <GoldStatItem label="CO" value={String(co)} />
        <GoldStatItem label="Win%" value={winPct === null ? "—" : `${winPct}`} />
      </div>
    </div>
  );
}

function GoldStatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,.66)" }}>{label}</span>
      <span
        style={{
          fontWeight: 800,
          letterSpacing: .2,
          color: "#f0b12a",
          textShadow: "0 0 8px rgba(240,177,42,.28)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusDot({ kind }: { kind: "online" | "away" | "offline" }) {
  const color = kind === "online" ? "#1fb46a" : kind === "away" ? "#f0b12a" : "#777";
  return <span style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 10px ${color}`, display: "inline-block" }} />;
}

/* ================================
   Utils
================================ */
function fmt(n: number) {
  return (Math.round((n ?? 0) * 10) / 10).toFixed(1);
}
function read(f: File) {
  return new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(f);
  });
}
async function warmProfileStats(
  id: string,
  setStatsMap: React.Dispatch<React.SetStateAction<Record<string, BasicProfileStats | undefined>>>
) {
  if (!id) return;
  try {
    const s = await getBasicProfileStats(id);
    setStatsMap((m) => (m[id] ? m : { ...m, [id]: s }));
  } catch {}
}
