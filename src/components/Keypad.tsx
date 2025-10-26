// ============================================
// src/components/Keypad.tsx
// Keypad stylé — boutons ANNULER & VALIDER en or
// ============================================
import React from "react";
import type { Dart as UIDart } from "../lib/types";

type Props = {
  /** Volée en cours (0..3 flèches) */
  currentThrow: UIDart[];
  /** Multiplicateur actif (1 par défaut, 2 = DOUBLE, 3 = TRIPLE) */
  multiplier: 1 | 2 | 3;

  // Actions
  onSimple: () => void;           // repasse à S (après un appui D/T)
  onDouble: () => void;           // active D
  onTriple: () => void;           // active T
  onBackspace?: () => void;       // supprime la dernière entrée (clic droit sur ANNULER)
  onCancel: () => void;           // vide la volée courante (ou annule la dernière volée côté écran)
  onNumber: (n: number) => void;  // 0..20 (0 = MISS)
  onBull: () => void;             // OB/DBULL (25/50)
  onValidate: () => void;         // bouton Valider

  /** Masquer les 3 badges d’aperçu (si affichés ailleurs) */
  hidePreview?: boolean;
};

/* ---------- Helpers ---------- */
function fmt(d?: UIDart) {
  if (!d) return "—";
  if (d.v === 0) return "MISS";
  if (d.v === 25) return d.mult === 2 ? "DBULL" : "BULL";
  return `${d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"}${d.v}`;
}
function throwTotal(throwDarts: UIDart[]) {
  return (throwDarts || []).reduce((acc, d) => {
    if (!d) return acc;
    if (d.v === 0) return acc;                           // MISS
    if (d.v === 25) return acc + (d.mult === 2 ? 50 : 25); // BULL / DBULL
    return acc + d.v * d.mult;
  }, 0);
}

/* ---------- Styles ---------- */
const wrapCard: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(22,22,23,.85), rgba(12,12,14,.95))",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,.35)",
  userSelect: "none",
};

const btnBase: React.CSSProperties = {
  height: 52,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.08)",
  background: "rgba(255,255,255,.04)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = { ...btnBase, background: "rgba(255,255,255,.06)" };
const btnDouble: React.CSSProperties = { ...btnBase, background: "rgba(46,150,193,.2)", color: "#bfeaff" };
const btnTriple: React.CSSProperties = { ...btnBase, background: "rgba(179,68,151,.2)", color: "#ffccff" };
const btnGold: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(180deg, #ffc63a, #ffaf00)",
  color: "#1a1a1a",
  border: "1px solid rgba(255,180,0,.3)",
  boxShadow: "0 10px 22px rgba(255,170,0,.28)",
};
const btnCancel: React.CSSProperties = btnGold; // ANNULER en or comme VALIDER
const btnBull: React.CSSProperties = { ...btnBase, background: "rgba(22,92,66,.35)", color: "#8be0b8" };
const cell: React.CSSProperties = { ...btnBase, width: "100%" };

const chip: React.CSSProperties = {
  display: "inline-block",
  minWidth: 56,
  textAlign: "center",
  padding: "10px 14px",
  borderRadius: 14,
  background: "rgba(0,0,0,.55)",
  border: "1px solid rgba(255,255,255,.08)",
  fontWeight: 800,
  letterSpacing: 0.5,
  marginRight: 12,
  color: "#e9d7ff",
  boxShadow: "0 0 22px rgba(250,213,75,.25)",
};

const totalPill: React.CSSProperties = {
  background: "rgba(255,187,51,.12)",
  border: "1px solid rgba(255,187,51,.4)",
  borderRadius: 12,
  padding: "8px 14px",
  color: "#ffc63a",
  fontWeight: 900,
  minWidth: 54,
  textAlign: "center",
  fontSize: 22,
};

/* ---------- Composant ---------- */
export default function Keypad({
  currentThrow,
  multiplier,
  onSimple,
  onDouble,
  onTriple,
  onBackspace,
  onCancel,
  onNumber,
  onBull,
  onValidate,
  hidePreview = false,
}: Props) {
  const rows = [
    [0, 1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12, 13],
    [14, 15, 16, 17, 18, 19, 20],
  ];

  return (
    <div style={wrapCard}>
      {/* Barre Flèche 1 / 2 / 3 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        {[0, 1, 2].map((i) => {
          const filled = Boolean(currentThrow[i]);
          return (
            <div
              key={i}
              style={{
                ...btnGhost,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: filled
                  ? "linear-gradient(180deg, rgba(152,117,40,.5), rgba(83,65,22,.35))"
                  : btnGhost.background,
              }}
            >
              <span style={{ opacity: 0.9 }}>{`Flèche ${i + 1}`}</span>
              <span style={{ marginLeft: 6 }}>{filled ? "✓" : "• •"}</span>
            </div>
          );
        })}
      </div>

      {/* DOUBLE / TRIPLE / ANNULER */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <button
          type="button"
          style={{ ...btnDouble, borderColor: multiplier === 2 ? "#9bd7ff" : "rgba(255,255,255,.08)" }}
          aria-pressed={multiplier === 2}
          onClick={onDouble}
          onMouseUp={onSimple}
          title="Double"
        >
          DOUBLE
        </button>

        <button
          type="button"
          style={{ ...btnTriple, borderColor: multiplier === 3 ? "#ffd0ff" : "rgba(255,255,255,.08)" }}
          aria-pressed={multiplier === 3}
          onClick={onTriple}
          onMouseUp={onSimple}
          title="Triple"
        >
          TRIPLE
        </button>

        <button
          type="button"
          style={btnCancel}
          onClick={onCancel}
          onContextMenu={(e) => {
            e.preventDefault();
            onBackspace?.();
          }} // clic droit = supprimer la dernière
          title="Annuler la volée (clic droit : annuler la dernière entrée)"
          aria-label="Annuler"
        >
          ANNULER
        </button>
      </div>

      {/* Grille chiffres */}
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
            {row.map((n) => (
              <button
                key={n}
                type="button"
                style={cell}
                onClick={() => onNumber(n)}
                title={n === 0 ? "MISS" : String(n)}
              >
                {n}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* BULL + TOTAL CENTRÉ + VALIDER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
        }}
      >
        {/* Colonne gauche : BULL aligné à gauche */}
        <div style={{ display: "flex" }}>
          <button type="button" style={{ ...btnBull, minWidth: 96 }} onClick={onBull}>
            BULL
          </button>
        </div>

        {/* Colonne centrale : TOTAL parfaitement centré */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={totalPill}>{throwTotal(currentThrow)}</span>
        </div>

        {/* Colonne droite : VALIDER aligné à droite */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" style={{ ...btnGold, width: 140 }} onClick={onValidate}>
            VALIDER
          </button>
        </div>
      </div>

      {/* Badges d’aperçu en bas (optionnels) */}
      {!hidePreview && (
        <div style={{ marginTop: 12 }}>
          <span style={{ ...chip, color: "#eec7ff" }}>{fmt(currentThrow[0])}</span>
          <span style={{ ...chip, color: "#cfe6ff" }}>{fmt(currentThrow[1])}</span>
          <span style={{ ...chip, color: "#ffe7c0" }}>{fmt(currentThrow[2])}</span>
        </div>
      )}
    </div>
  );
}
