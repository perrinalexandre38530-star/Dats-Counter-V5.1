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

// Historique (pour StatsDetail minimal)
import { History } from "./lib/history";

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
  | "shanghai";

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
      // Quand le nouveau SW prend le relais → recharge la page
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

  // Demander la persistance de stockage une fois au boot (silencieux si déjà accordée)
  React.useEffect(() => {
    ensurePersisted().catch(() => {});
  }, []);

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

  // Fin de partie → ajoute à l’historique + va sur Stats (onglet Historique)
  function pushHistory(m: MatchRecord) {
    update((s) => ({ ...s, history: [...(s.history ?? []), m] }));
    go("stats", { tab: "history" }); // 👈 ouvre direct l’historique
  }

  // --------------------------------------------
  // Routes
  let page: React.ReactNode = null;

  if (loading) {
    page = (
      <div
        className="container"
        style={{ padding: 40, textAlign: "center", color: "#ccc" }}
      >
        Chargement...
      </div>
    );
  } else {
    switch (tab) {
      case "home":
        page = (
          <Home
            store={store}
            update={update}
            go={(t: any) => go(t)}
            onConnect={() => go("profiles")}
          />
        );
        break;

      case "games":
        page = <Games setTab={(t: any) => go(t)} />;
        break;

      case "profiles":
        page = (
          <Profiles
            store={store}
            update={update}
            setProfiles={setProfiles}
          />
        );
        break;

      case "friends":
        page = <FriendsPage />;
        break;

      case "settings":
        page = (
          <SettingsPage
            value={store.settings}
            onChange={(s) => update((st) => ({ ...st, settings: s }))}
          />
        );
        break;

      case "stats":
        page = (
          <StatsHub
            go={go}                       // reprise & “voir stats”
            {...(routeParams ?? {})}      // ex: { tab: "history" }
          />
        );
        break;

      case "statsDetail": {
        const rec = History.get(routeParams?.matchId);
        page = rec ? (
          <div style={{ padding: 16 }}>
            <button onClick={() => go("stats", { tab: "history" })} style={{ marginBottom: 12 }}>
              ← Retour
            </button>
            <h2 style={{ margin: 0 }}>
              {(rec.kind || "").toUpperCase()} —{" "}
              {new Date(rec.updatedAt).toLocaleString()}
            </h2>
            <div style={{ opacity: 0.85, marginTop: 8 }}>
              Joueurs : {(rec.players || []).map((p: any) => p.name).join(" · ")}
            </div>
            {rec.winnerId && (
              <div style={{ marginTop: 6 }}>
                Vainqueur : 🏆{" "}
                {(rec.players || []).find((p: any) => p.id === rec.winnerId)?.name ?? "—"}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            <button onClick={() => go("stats", { tab: "history" })} style={{ marginBottom: 12 }}>
              ← Retour
            </button>
            Aucune donnée
          </div>
        );
        break;
      }

      // ---------- X01 ----------
      case "x01setup":
        page = (
          <X01Setup
            profiles={store.profiles ?? []}
            defaults={{
              start: store.settings.defaultX01,
              doubleOut: store.settings.doubleOut,
            }}
            onStart={(ids, start, doubleOut) => {
              const players = store.settings.randomOrder
                ? ids.slice().sort(() => Math.random() - 0.5)
                : ids;
              setX01Config({ playerIds: players, start, doubleOut });
              go("x01");
            }}
            onBack={() => go("games")}
          />
        );
        break;

      case "x01":
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
              params={routeParams}               // ← transporte { resumeId } pour la reprise
              onFinish={(m) => pushHistory(m)}
              onExit={() => go("x01setup")}
            />
          );
        }
        break;

      case "x01_end":
        page = <X01End go={go} params={routeParams} />;
        break;

      // ---------- Autres jeux ----------
      case "cricket":
        page = (
          <LobbyPick
            title="Lobby — Cricket"
            profiles={store.profiles ?? []}
            onStart={(ids) => {
              const players = store.settings.randomOrder
                ? ids.slice().sort(() => Math.random() - 0.5)
                : ids;
              // à brancher quand Cricket prêt
              go("cricket");
            }}
          />
        );
        // Place-holder de jeu Cricket :
        page = <CricketPlay playerIds={[]} onFinish={pushHistory} />;
        break;

      case "killer":
        page = <KillerPlay playerIds={[]} onFinish={pushHistory} />;
        break;

      case "shanghai":
        page = <ShanghaiPlay playerIds={[]} onFinish={pushHistory} />;
        break;

      default:
        page = (
          <Home
            store={store}
            update={update}
            go={(t: any, p?: any) => go(t, p)}
            onConnect={() => go("profiles")}
          />
        );
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
