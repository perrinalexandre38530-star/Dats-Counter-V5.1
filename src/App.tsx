import React from "react";
import BottomNav from "./components/BottomNav";
import { loadStore, saveStore } from "./lib/storage";
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
import StatsHub from "./pages/StatsHub"; // 👈 nouveau hub Stats+Historique

type Tab =
  | "home" | "games" | "profiles" | "friends" | "stats" | "settings"
  | "x01setup" | "x01" | "cricket" | "killer" | "shanghai" | "lobby";

export default function App() {
  const [store, setStore] = React.useState<Store>(loadStore());
  function update(mut: (s: Store) => Store) {
    setStore((s) => saveStore(mut({ ...s })));
  }

  // navigation
  const [tab, setTab] = React.useState<Tab>("home");
  const [runtime, setRuntime] = React.useState<any>(null); // params en cours (joueurs, mode, etc.)

  // profils helpers
  function setProfiles(fn: (p: Profile[]) => Profile[]) {
    update((s) => ({ ...s, profiles: fn(s.profiles) }));
  }
  function pushHistory(m: MatchRecord) {
    update((s) => ({ ...s, history: [...s.history, m] }));
    setTab("stats"); // 👈 après une partie on atterrit dans l’onglet Stats (avec sous-onglet Historique dispo)
  }

  // UI
  const page = (() => {
    switch (tab) {
      case "home":
        return (
          <Home
            store={store}                     // 🔹 on transmet tout le store (profils, statut, etc.)
            go={(t: any) => setTab(t)}        // 🔹 navigation entre les onglets
            showConnect={!store.activeProfileId} // 🔹 optionnel : vrai si aucun profil connecté
            onConnect={() => {                // 🔹 si on veut forcer l’ouverture du bloc création
              setRuntime({ focus: "createProfile" });
              setTab("profiles");
            }}
          />
        );
      

      case "games":
        return (
          <Games
            onChoose={(m) => {
              if (m === "X01") {
                setRuntime(null);
                setTab("x01setup");
              } else {
                setRuntime({ mode: m });
                setTab("lobby");
              }
            }}
          />
        );

        case "profiles":
         return (
         <Profiles
           store={store}
           update={update}
           setProfiles={setProfiles}
          autoCreate={runtime?.focus === "createProfile"}    // 👈 autofocus création
    />
  );

      case "friends":
        return <FriendsPage />;

      case "settings":
        return (
          <SettingsPage
            value={store.settings}
            onChange={(s) => update((st) => ({ ...st, settings: s }))}
          />
        );

      case "stats":
        return <StatsHub store={store} />; // 👈 HUB combiné

      // ---------- X01 ----------
      case "x01setup":
        return (
          <X01Setup
            profiles={store.profiles}
            defaults={{
              start: store.settings.defaultX01,
              doubleOut: store.settings.doubleOut,
            }}
            onStart={(ids, start, doubleOut) => {
              const players = store.settings.randomOrder
                ? ids.slice().sort(() => Math.random() - 0.5)
                : ids;
              setRuntime({ players, start, doubleOut });
              setTab("x01");
            }}
          />
        );

      case "x01":
        return (
          <X01Play
            playerIds={runtime.players}
            start={runtime.start}
            doubleOut={runtime.doubleOut}
            onFinish={(m) => pushHistory(m)}
          />
        );

      // ---------- Lobby générique pour Cricket / Killer / Shanghai ----------
      case "lobby":
        return (
          <LobbyPick
            title={`Lobby — ${(runtime?.mode || "").toString()}`}
            profiles={store.profiles}
            onStart={(ids) => {
              const players = store.settings.randomOrder
                ? ids.slice().sort(() => Math.random() - 0.5)
                : ids;
              if (runtime.mode === "Cricket") {
                setRuntime({ players });
                setTab("cricket");
              }
              if (runtime.mode === "Killer") {
                setRuntime({ players });
                setTab("killer");
              }
              if (runtime.mode === "Shanghai") {
                setRuntime({ players });
                setTab("shanghai");
              }
            }}
          />
        );

      case "cricket":
        return <CricketPlay playerIds={runtime.players} onFinish={(m) => pushHistory(m)} />;

      case "killer":
        return <KillerPlay playerIds={runtime.players} onFinish={(m) => pushHistory(m)} />;

      case "shanghai":
        return <ShanghaiPlay playerIds={runtime.players} onFinish={(m) => pushHistory(m)} />;
    }
  })();

  return (
    <>
      <div className="container" style={{ paddingBottom: 88 }}>{page}</div>
      <BottomNav value={tab as any} onChange={(k: any) => setTab(k)} />
    </>
  );
}
