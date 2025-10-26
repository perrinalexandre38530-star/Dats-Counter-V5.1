import React from "react";
import type { LegResult } from "../lib/types";

export default function EndOfLegOverlay({
  open,
  result,
  playersById,
  onClose,
  onReplay,
}: {
  open: boolean;
  result: LegResult | null;
  playersById: Record<string, { id: string; name: string; avatarDataUrl?: string }>;
  onClose: () => void;
  onReplay?: () => void;
}) {
  if (!open || !result) return null;
  const { order, remaining } = result;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 9999, padding: 16,
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "linear-gradient(180deg, #17181c, #101116)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 16, padding: 18, boxShadow: "0 20px 60px rgba(0,0,0,.4)"
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22 }}>Classement de la manche</h2>
        <p style={{ opacity: .75, marginTop: 4 }}>
          Manche terminée — {new Date(result.finishedAt).toLocaleTimeString()}
        </p>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {order.map((pid, i) => {
            const p = playersById[pid];
            const place = i + 1;
            return (
              <div key={pid}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.07)",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, overflow: "hidden",
                  background: "rgba(255,255,255,.08)"
                }}>
                  {p?.avatarDataUrl ? (
                    <img src={p.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 16 }}>{place}.</strong>
                  <span>{p?.name ?? pid}</span>
                </div>
                <div style={{ opacity: .8, fontVariantNumeric: "tabular-nums" }}>
                  Reste: {remaining[pid] ?? 0}
                </div>
                <div style={{ opacity: .7 }}>
                  Moy/3: {result.avg3[pid] ?? 0}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mini-stats agrégées */}
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <h3 style={{ margin: "14px 0 6px" }}>Stats rapides</h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
          }}>
            {order.map(pid => (
              <div key={pid}
                style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}
              >
                <div style={{ fontWeight: 600 }}>{playersById[pid]?.name ?? pid}</div>
                <div style={{ fontSize: 12, opacity: .8, marginTop: 6 }}>
                  Volées: {result.visits[pid] ?? 0}<br/>
                  Flèches: {result.darts[pid] ?? 0}<br/>
                  Best Visit: {result.bestVisit[pid] ?? 0}<br/>
                  Best CO: {result.bestCheckout[pid] ?? "—"}<br/>
                  180: {result.x180[pid] ?? 0} — Dbl: {result.doubles[pid] ?? 0} — Tpl: {result.triples[pid] ?? 0} — Bulls: {result.bulls[pid] ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {onReplay ? (
            <button
              onClick={onReplay}
              style={{
                appearance: "none", padding: "10px 14px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "#eee", cursor: "pointer"
              }}
            >
              Rejouer la manche
            </button>
          ) : null}
          <button
            onClick={onClose}
            style={{
              appearance: "none", padding: "10px 14px", borderRadius: 12,
              border: "1px solid transparent", background: "linear-gradient(180deg, #f0b12a, #c58d19)",
              color: "#141417", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 24px rgba(240,177,42,.25)"
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
