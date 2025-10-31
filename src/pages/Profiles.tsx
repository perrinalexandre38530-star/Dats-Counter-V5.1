import React from "react";
import ProfileAvatar from "../components/ProfileAvatar";
import type { Store, Profile, Friend } from "../lib/types";

// ★ NEW: stats basiques unifiées (History ⇄ Stats)
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
    if (!store.activeProfileId) {
      update((s) => ({ ...s, activeProfileId: p.id }));
    }
  }

  const active = profiles.find((p) => p.id === activeProfileId) || null;

  // ★ NEW: charger/mettre en cache les stats basiques du profil actif
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const pid = active?.id;
      if (!pid) return;
      // si déjà en cache, on ne relance pas
      if (statsMap[pid]) return;
      try {
        const s = await getBasicProfileStats(pid);
        if (!cancelled) {
          setStatsMap((m) => ({ ...m, [pid]: s }));
        }
      } catch {
        /* no-op: on garde l’UI */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const activeStats = active?.id ? statsMap[active.id] : undefined;

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      {/* ===== Profil actif ===== */}
      <Card title="Profil connecté">
        {active ? (
          <div className="row" style={{ gap: 14, alignItems: "center" }}>
            {/* Médaillon avatar agrandi */}
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
              <ProfileAvatar
                size={96}
                dataUrl={active?.avatarDataUrl}
                label={active?.name?.[0]?.toUpperCase() || "?"}
              />
            </div>

            {/* Colonne infos (centrées) */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              {/* Nom en doré + lien stats */}
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

              {/* Statut coloré */}
              <div className="row" style={{ gap: 8, alignItems: "center", marginTop: 4 }}>
                <StatusDot kind={selfStatus === "away" ? "away" : selfStatus === "offline" ? "offline" : "online"} />
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      selfStatus === "away" ? "#f0b12a" : selfStatus === "offline" ? "#9aa0a6" : "#1fb46a",
                  }}
                >
                  {selfStatus === "away" ? "Absent" : selfStatus === "offline" ? "Hors ligne" : "En ligne"}
                </span>
              </div>

              {/* Stats principales (★ reliées aux stats unifiées) */}
              <div className="subtitle" style={{ marginTop: 6, whiteSpace: "nowrap" }}>
                {/* fallback propre si pas encore calculé */}
                Moy/3: {fmt(activeStats?.avg3 ?? 0)} · Best: {activeStats?.bestVisit ?? 0} · Win: {winPctFromBasics(activeStats)}
              </div>

              {/* Actions compactes sous les stats (une ligne, centrée) */}
              <div
                className="row"
                style={{
                  gap: 8,
                  marginTop: 10,
                  justifyContent: "center",
                  flexWrap: "nowrap",
                }}
              >
                {/* ÉDITER */}
                <EditInline
                  initialName={active?.name || ""}
                  onSave={(n, f) => {
                    if (active) {
                      if (n && n !== active.name) renameProfile(active.id, n);
                      if (f) changeAvatar(active.id, f);
                    }
                  }}
                  onDisconnect={undefined}
                  compact={true}
                />

                {/* ABSENT (toggle) */}
                <button
                  className="btn sm"
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      selfStatus: s.selfStatus === "away" ? ("online" as const) : ("away" as const),
                    }))
                  }
                  title="Basculer le statut (En ligne / Absent)"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  {/* petit point de statut */}
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                  </svg>
                  {selfStatus === "away" ? "EN LIGNE" : "ABSENT"}
                </button>

                {/* QUITTER */}
                <button
                  className="btn danger sm"
                  onClick={() => setActiveProfile(null)}
                  title="Quitter la session"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3h-8v2h8v14h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" fill="currentColor" />
                  </svg>
                  QUITTER
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ConnectBlock
            profiles={profiles}
            onConnect={setActiveProfile}
            onCreate={addProfile}
            autoFocusCreate={autoCreate}
          />
        )}
      </Card>

      {/* ===== Amis ===== */}
      <Card title="Amis">
        <FriendsBlock friends={friends} />
      </Card>

      {/* ===== Profils locaux ===== */}
      <Card title="Profils locaux">
        {/* Formulaire d’ajout rapide (ne défile pas) */}
        <AddLocalProfile onCreate={addProfile} />

        {/* Liste scrollable (seulement ce bloc défile) */}
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
            // ★ passer le cache de stats pour afficher les valeurs si disponibles
            statsMap={statsMap}
            // ★ demander (au survol/clic) de “réchauffer” une fiche
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

function ConnectBlock({
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
  const createRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (autoFocusCreate) createRef.current?.focus();
  }, [autoFocusCreate]);

  return (
    <div className="grid2">
      <div className="card" style={{ background: "transparent", border: "1px dashed var(--stroke)" }}>
        <div className="subtitle" style={{ marginBottom: 6 }}>
          Se connecter
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select className="input" value={chosen} onChange={(e) => setChosen(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn primary sm" onClick={() => chosen && onConnect(chosen)}>
            Connexion
          </button>
        </div>
      </div>

      <div className="card" style={{ background: "transparent", border: "1px dashed var(--stroke)" }}>
        <div className="subtitle" style={{ marginBottom: 6 }}>
          Créer un profil
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            ref={createRef}
            className="input"
            placeholder="Nom du profil"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="btn sm">
            Choisir avatar
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button className="btn primary sm" onClick={() => onCreate(name, file)}>
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function FriendsBlock({ friends }: { friends?: Friend[] }) {
  const safe: Friend[] = Array.isArray(friends) ? friends : [];

  const groups = {
    online: safe.filter((f) => f.status === "online"),
    away: safe.filter((f) => f.status === "away"),
    offline: safe.filter((f) => f.status === "offline"),
  };

  return (
    <div className="list">
      {(["online", "away", "offline"] as const).map((key) => (
        <div key={key} className="card" style={{ background: "#111118" }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <StatusDot kind={key} />
            <b>{key === "online" ? "Connectés" : key === "away" ? "Absents" : "Hors-ligne"}</b>
            <span className="subtitle">· {groups[key].length}</span>
          </div>

          {groups[key].length === 0 ? (
            <div className="subtitle">Aucun ami ici pour l’instant</div>
          ) : (
            <div className="list">
              {groups[key].map((f) => (
                <div className="item" key={f.id} style={{ background: "#0f0f14" }}>
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <ProfileAvatar size={44} dataUrl={f.avatarDataUrl} label={f.name?.[0]?.toUpperCase() || "?"} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{f.name || "—"}</div>
                      <div className="subtitle" style={{ whiteSpace: "nowrap" }}>
                        {/* Friends restent comme avant si tu stockes déjà des stats côté Friend */}
                        Moy/3: {fmt(f.stats?.avg3 ?? 0)} · Best: {f.stats?.bestVisit ?? 0} · Win: {Math.round((f.stats?.winrate ?? 0) * 100)}%
                      </div>
                    </div>
                  </div>
                  <span className="subtitle">
                    {key === "online" ? "En ligne" : key === "away" ? "Absent" : "Hors-ligne"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ----- Formulaire d’ajout local (séparé) ----- */
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
  // ★ NEW
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
        const s = statsMap[p.id]; // ★ stats unifiées si déjà chargées
        return (
          <div className="item" key={p.id} style={{ gap: 10, alignItems: "center" }}>
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
                        onMouseEnter={() => warmup(p.id)} // ★ pré-charge au survol
                        style={{ color: "#f0b12a", textDecoration: "none" }}
                        title="Voir les statistiques"
                      >
                        {p.name || "—"}
                      </a>
                    </div>
                    <div className="subtitle" style={{ whiteSpace: "nowrap" }}>
                      {/* ★ affiche les stats unifiées si présentes, sinon fallback éventuel */}
                      Moy/3: {fmt(s?.avg3 ?? 0)} · Best: {s?.bestVisit ?? 0} · Win: {winPctFromBasics(s)}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {isEdit ? (
                <>
                  <button className="btn ok sm" onClick={() => saveEdit(p.id)}>Enregistrer</button>
                  <button className="btn sm" onClick={() => setEditing(null)}>Annuler</button>
                </>
              ) : (
                <button className="btn sm" onClick={() => startEdit(p)}>Éditer</button>
              )}
              <button className="btn danger sm" onClick={() => onDelete(p.id)}>Suppr.</button>
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

  // Bouton compact "ÉDITER" quand non en édition
  if (!edit) {
    return (
      <button
        className="btn sm"
        onClick={() => setEdit(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 12, lineHeight: 1 }}
        title="Éditer le profil"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
        </svg>
        ÉDITER
      </button>
    );
  }

  // Zone édition inline
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
        <img
          src={avatarUrl ?? ""}
          alt="avatar"
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: avatarUrl ? 1 : 0.2 }}
        />
        {!avatarUrl && (
          <span style={{ position: "absolute", color: "#999", fontSize: 12, bottom: 6 }}>
            Cliquer
          </span>
        )}
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
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 12, lineHeight: 1 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 16.17l-3.88-3.88L3.7 13.7 9 19l12-12-1.41-1.41z" fill="currentColor" />
        </svg>
        Enregistrer
      </button>
      <button
        className="btn sm"
        onClick={() => {
          setEdit(false);
          setFile(null);
          setAvatarUrl(null);
        }}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 12, lineHeight: 1 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" />
        </svg>
        Annuler
      </button>
      {onDisconnect && (
        <button className="btn danger sm" onClick={onDisconnect} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 12, lineHeight: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3h-8v2h8v14h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" fill="currentColor" />
          </svg>
          QUITTER
        </button>
      )}
    </div>
  );
}

function StatusDot({ kind }: { kind: "online" | "away" | "offline" }) {
  const color = kind === "online" ? "#1fb46a" : kind === "away" ? "#f0b12a" : "#777";
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 10px ${color}`,
        display: "inline-block",
      }}
    />
  );
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

// ★ Calcule un “Win %” basique à partir des stats unifiées
function winPctFromBasics(s?: BasicProfileStats) {
  if (!s) return "0%";
  const pct = s.legsPlayed > 0 ? Math.round((s.legsWon / s.legsPlayed) * 100) : 0;
  return `${pct}%`;
}

// ★ Chauffe (lazy) les stats d’un profil et les met en cache
async function warmProfileStats(
  id: string,
  setStatsMap: React.Dispatch<React.SetStateAction<Record<string, BasicProfileStats | undefined>>>
) {
  if (!id) return;
  try {
    const s = await getBasicProfileStats(id);
    setStatsMap((m) => (m[id] ? m : { ...m, [id]: s }));
  } catch {
    /* no-op */
  }
}
