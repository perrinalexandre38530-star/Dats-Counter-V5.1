case "statsDetail": {
  // helper: récupère un enregistrement quel que soit l’implémentation
  const getRec = (id?: string) => {
    if (!id) return null as any;
    const api: any = History || {};
    try {
      return api.get?.(id) ?? api.getX01?.(id) ?? null;
    } catch {
      return null;
    }
  };

  const rec: any = getRec(routeParams?.matchId);

  const toArr = (v: any) => (Array.isArray(v) ? v : []);
  const N = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

  if (rec) {
    const when = N(rec.updatedAt ?? rec.createdAt ?? Date.now(), Date.now());
    const dateStr = new Date(when).toLocaleString();

    // joueurs : essaye rec.players, sinon payload.players
    const players = toArr(rec.players?.length ? rec.players : rec.payload?.players);
    const names = players.map((p: any) => p?.name ?? "—").join(" · ");

    const winnerName =
      rec.winnerId
        ? (players.find((p: any) => p?.id === rec.winnerId)?.name ?? "—")
        : null;

    page = (
      <div style={{ padding: 16 }}>
        <button onClick={() => go("stats", { tab: "history" })} style={{ marginBottom: 12 }}>
          ← Retour
        </button>
        <h2 style={{ margin: 0 }}>
          {(rec.kind || "MATCH").toUpperCase()} — {dateStr}
        </h2>
        <div style={{ opacity: 0.85, marginTop: 8 }}>Joueurs : {names || "—"}</div>
        {winnerName && (
          <div style={{ marginTop: 6 }}>
            Vainqueur : 🏆 {winnerName}
          </div>
        )}
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
