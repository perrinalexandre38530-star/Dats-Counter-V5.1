// ============================================
// src/App.tsx — Navigation + wiring propre (v5 sécurisé)
// ============================================
import React from "react";
import BottomNav from "./components/BottomNav";

// Persistance (IndexedDB via storage.ts)
import { loadStore, saveStore } from "./lib/storage";
// OPFS / StorageManager — demande la persistance une fois au boot
import { ensurePersisted } from "./lib/deviceStore";

// Types
import type { Store, Profile, MatchRecord } from "./lib/types";

// Pages
import Home from "./pages/Home";
import Games from "./pages/Games";
import Profiles from "./pages/Profiles";
import FriendsPage from "./pages/FriendsPage";
import SettingsPage from "./pages/SettingsPage";
import X01Setup from "./pages/X01Setup";
import X01Play from "./pages/X01Play";
import CricketPlay from "./pages/CricketPlay";
import KillerPlay from "./pages/KillerPlay";
import ShanghaiPlay from "./pages/ShanghaiPlay";
import LobbyPick from "./pages/LobbyPick";
import StatsHub from "./pages/StatsHub";
import X01End from "./pages/X01End";
// ✅ Nouvelle page
import AvatarCreator from "./pages/AvatarCreator";

// Historique (pour StatsDetail / upsert / get)
import { History } from "./lib/history";

// DEV uniquement
import { installHistoryProbe } from "./dev/devHistoryProbe";
if (import.meta.env.DEV) installHistoryProbe();

// --------------------------------------------
type Tab =
  | "home"
  | "games"
  | "profiles"
  | "friends"
  | "stats"
  | "statsDetail"
  | "settings"
  | "x01setup"
  | "x01"
  | "x01_end"
  | "cricket"
  | "killer"
  | "shanghai"
  // ✅ nouvelle route par onglet
  | "avatar";

// Store initial minimal (empêche les crashes pendant le chargement)
const initialStore: Store = {
  profiles: [],
  activeProfileId: null,
  friends: [],
  selfStatus: "online" as any,
  settings: {
    defaultX01: 501,
    doubleOut: true,
    randomOrder: false,
    lang: "fr",
    ttsOnThird: false,
    neonTheme: true,
  } as any,
  history: [],
} as any;

// ===== Service Worker update prompt =====
function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = React.useState<ServiceWorker | null>(null);
  const [showPrompt, setShowPrompt] = React.useState(false);

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowPrompt(true);
          }
        });
      });
    });
  }, []);

  function updateNow() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    setShowPrompt(false);
  }

  return { showPrompt, updateNow, dismiss: () => setShowPrompt(false) };
}

function SWUpdateBanner() {
  const { showPrompt, updateNow, dismiss } = useServiceWorkerUpdate();
  if (!showPrompt) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(20,20,20,.9)",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: 12,
        boxShadow: "0 0 15px rgba(0,0,0,.4)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span>🔄 Nouvelle version disponible</span>
      <button
        onClick={updateNow}
        style={{
          background: "linear-gradient(180deg,#ffc63a,#ffaf00)",
          color: "#000",
          border: "none",
          borderRadius: 8,
          padding: "6px 10px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Recharger
      </button>
      <button
        onClick={dismiss}
        style={{
          background: "transparent",
          color: "#aaa",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
        }}
        title="Ignorer"
      >
        ✕
      </button>
    </div>
  );
}
// ===== fin SW update prompt =====

// --------------------------------------------
export default function App() {
  const [store, setStore] = React.useState<Store>(initialStore);
  const [tab, setTab] = React.useState<Tab>("home");
  const [routeParams, setRouteParams] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  // Demander la persistance une fois au boot (silencieux si déjà accordée)
  React.useEffect(() => {
    ensurePersisted().catch(() => {});
  }, []);

  // ⚠️ Expose le store en global pour les fallbacks (X01End / autres)
  React.useEffect(() => {
    (window as any).__appStore = store;
  }, [store]);

  // Mémo config X01
  const [x01Config, setX01Config] = React.useState<{
    start: 301 | 501 | 701 | 1001;
    doubleOut: boolean;
    playerIds: string[];
  } | null>(null);

  // -------- Navigation centralisée (avec params) --------
  function go(next: Tab, params?: any) {
    setRouteParams(params ?? null);
    setTab(next);
  }

  /* ----------------------------------------
     Chargement initial depuis IndexedDB
     (migration automatique depuis localStorage)
  ---------------------------------------- */
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await loadStore<Store>();
        if (mounted && saved) {
          setStore({
            ...initialStore,
            ...saved,
            profiles: saved.profiles ?? [],
            friends: saved.friends ?? [],
            history: saved.history ?? [],
          });
        }
      } catch (err) {
        console.warn("[App] erreur loadStore:", err);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Sauvegarde à chaque modification
  React.useEffect(() => {
    if (!loading) saveStore(store);
  }, [store, loading]);

  /* ----------------------------------------
     Mutateur centralisé
  ---------------------------------------- */
  function update(mut: (s: Store) => Store) {
    setStore((s) => {
      const next = mut({ ...s });
      queueMicrotask(() => saveStore(next));
      return next;
    });
  }

  // Helpers profils
  function setProfiles(fn: (p: Profile[]) => Profile[]) {
    update((s) => ({ ...s, profiles: fn(s.profiles ?? []) }));
  }

  // Fin de partie → normalise, dédupe, persiste, route vers Historique
  function pushHistory(m: MatchRecord) {
    const now = Date.now();
    const id =
      (m as any)?.id ||
      (m as any)?.matchId ||
      `x01-${now}-${Math.random().toString(36).slice(2, 8)}`;

    const players =
      (m as any)?.players ??
      (m as any)?.payload?.players ??
      [];

    const summary =
      (m as any)?.summary ??
      (m as any)?.payload?.summary ??
      null;

    const saved: any = {
      id,
      kind: (m as any)?.kind || "x01",
      status: (m as any)?.status || "finished",
      players,
      winnerId: (m as any)?.winnerId || (m as any)?.payload?.winnerId || null,
      createdAt: (m as any)?.createdAt || now,
      updatedAt: now,
      summary,
      payload: m, // brut (History.upsert pourra compacter si besoin)
    };

    // 1) mémoire (dédupe sur id)
    update((s) => {
      const list = [...(s.history ?? [])];
      const i = list.findIndex((r: any) => r.id === saved.id);
      if (i >= 0) list[i] = saved; else list.unshift(saved);
      return { ...s, history: list };
    });

    // 2) persistant (best effort)
    try { (History as any)?.upsert?.(saved); } catch (e) { console.warn("[App] History.upsert failed:", e); }

    // 3) route
    go("stats", { tab: "history" });
  }

  // --------------------------------------------
  // Routes
  let page: React.ReactNode = null;

  if (loading) {
    page = (
      <div className="container" style={{ padding: 40, textAlign: "center", color: "#ccc" }}>
        Chargement...
      </div>
    );
  } else {
    switch (tab) {
      case "home": {
        page = <Home store={store} update={update} go={(t: any, p?: any) => go(t, p)} onConnect={() => go("profiles")} />;
        break;
      }

      case "games": {
        page = <Games setTab={(t: any) => go(t)} />;
        break;
      }

      case "profiles": {
        page = <Profiles store={store} update={update} setProfiles={setProfiles} />;
        break;
      }

      case "friends": {
        page = <FriendsPage />;
        break;
      }

      case "settings": {
        page = (
          <SettingsPage
            value={store.settings}
            onChange={(s) => update((st) => ({ ...st, settings: s }))}
          />
        );
        break;
      }

      case "stats": {
        page = (
          <StatsHub
            go={go}
            tab={(routeParams?.tab as any) ?? "history"}
            memHistory={store.history ?? []}
          />
        );
        break;
      }

      case "statsDetail": {
        // robuste: accepte un record complet passé par StatsHub,
        // sinon tente History.get, sinon fallback store.history
        const rec: any =
          routeParams?.rec ||
          (History as any)?.get?.(routeParams?.matchId) ||
          (store.history || []).find((r: any) => r.id === routeParams?.matchId);

        const toArr = (v: any) => (Array.isArray(v) ? v : []);
        const N = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

        if (routeParams?.showEnd && rec) {
          // Option : afficher directement l’overlay de fin si demandé
          page = (
            <X01End
              go={go}
              params={{
                matchId: rec.id,
                resumeId: rec.resumeId ?? rec.payload?.resumeId,
                showEnd: true,
              }}
            />
          );
          break;
        }

        if (rec) {
          const when = N(rec.updatedAt ?? rec.createdAt ?? Date.now(), Date.now());
          const dateStr = new Date(when).toLocaleString();
          const players = toArr(rec.players?.length ? rec.players : rec.payload?.players);
          const names = players.map((p: any) => p?.name ?? "—").join(" · ");
          const winnerName = rec.winnerId
            ? (players.find((p: any) => p?.id === rec.winnerId)?.name ?? "—")
            : null;

          // Placeholder léger tant que la page détaillée finale n’est pas branchée :
          page = (
            <div style={{ padding: 16 }}>
              <button onClick={() => go("stats", { tab: "history" })} style={{ marginBottom: 12 }}>
                ← Retour
              </button>
              <h2 style={{ margin: 0 }}>
                {(rec.kind || "MATCH").toUpperCase()} — {dateStr}
              </h2>
              <div style={{ opacity: 0.85, marginTop: 8 }}>Joueurs : {names || "—"}</div>
              {winnerName && <div style={{ marginTop: 6 }}>Vainqueur : 🏆 {winnerName}</div>}
            </div>
          );
        } else {
          page = (
            <div style={{ padding: 16 }}>
              <button onClick={() => go("stats", { tab: "history" })} style={{ marginBottom: 12 }}>
                ← Retour
              </button>
              Aucune donnée
            </div>
          );
        }
        break;
      }

      // ---------- X01 ----------
      case "x01setup": {
        page = (
          <X01Setup
            profiles={store.profiles ?? []}
            defaults={{
              start: store.settings.defaultX01,
              doubleOut: store.settings.doubleOut,
            }}
            onStart={(ids, start, doubleOut) => {
              const players = store.settings.randomOrder ? ids.slice().sort(() => Math.random() - 0.5) : ids;
              setX01Config({ playerIds: players, start, doubleOut });
              go("x01");
            }}
            onBack={() => go("games")}
          />
        );
        break;
      }

      case "x01": {
        if (!x01Config && !routeParams?.resumeId) {
          page = (
            <div className="container" style={{ padding: 16 }}>
              <button onClick={() => go("x01setup")}>← Retour</button>
              <p>Configuration X01 manquante.</p>
            </div>
          );
        } else {
          page = (
            <X01Play
              profiles={store.profiles ?? []}
              playerIds={x01Config?.playerIds ?? []}
              start={x01Config?.start ?? store.settings.defaultX01}
              doubleOut={x01Config?.doubleOut ?? store.settings.doubleOut}
              params={routeParams}               // transporte { resumeId } pour la reprise
              onFinish={(m) => pushHistory(m)}
              onExit={() => go("x01setup")}
            />
          );
        }
        break;
      }

      case "x01_end": {
        // Reçoit params.rec | params.matchId | params.resumeId
        // X01End doit afficher l’overlay quand showEnd === true
        page = <X01End go={go} params={routeParams} />;
        break;
      }

      // ---------- Autres jeux ----------
      case "cricket": {
        page = (
          <LobbyPick
            title="Lobby — Cricket"
            profiles={store.profiles ?? []}
            onStart={(ids) => {
              const players = store.settings.randomOrder
                ? ids.slice().sort(() => Math.random() - 0.5)
                : ids;
              go("cricket");
            }}
          />
        );
        // Placeholder jeu
        page = <CricketPlay playerIds={[]} onFinish={pushHistory} />;
        break;
      }

      case "killer": {
        page = <KillerPlay playerIds={[]} onFinish={pushHistory} />;
        break;
      }

      case "shanghai": {
        page = <ShanghaiPlay playerIds={[]} onFinish={pushHistory} />;
        break;
      }

      // ✅ Nouvelle page : Créateur d'avatar
      case "avatar": {
        page = (
          <div style={{ padding: 16 }}>
            <button onClick={() => go("profiles")} style={{ marginBottom: 12 }}>
              ← Retour
            </button>
            <AvatarCreator
              size={512}
              overlaySrc="/assets/medallion.svg" // remplace par ton médaillon étoilé
            />
          </div>
        );
        break;
      }

      default: {
        page = <Home store={store} update={update} go={(t: any, p?: any) => go(t, p)} onConnect={() => go("profiles")} />;
      }
    }
  }

  // --------------------------------------------
  return (
    <>
      <div className="container" style={{ paddingBottom: 88 }}>
        {page}
      </div>
      <BottomNav value={tab as any} onChange={(k: any) => go(k)} />
      {/* Bannière de mise à jour PWA */}
      <SWUpdateBanner />
    </>
  );
}
