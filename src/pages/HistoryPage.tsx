import React from "react";
import Section from "../components/Section";
import type { Store } from "../lib/types";
import { profileMap } from "../lib/selectors";

export default function HistoryPage({ store }: { store: Store }) {
  const items = (store.history ?? []).slice().reverse();
  const { nameOf } = profileMap(store);

  return (
    <div className="container">
      <Section title="Historique des parties">
        <div className="list">
          {items.length === 0 && (
            <div className="item">Aucune partie pour l’instant.</div>
          )}

          {items.map((h) => (
            <div key={h.header.id} className="item">
              <div>
                <b style={{ color: "var(--gold)" }}>{h.header.mode}</b> ·{" "}
                {new Date(h.header.startedAt).toLocaleString()}
                <div className="small">{h.header.players.map(nameOf).join(" · ")}</div>
              </div>
              <div>
                {h.header.winner ? `🏆 ${nameOf(h.header.winner)}` : "—"}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
