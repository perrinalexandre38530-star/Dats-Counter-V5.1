// ============================================
// src/components/EndOfLegOverlay.tsx
// Overlay "Classement de la manche" (UI + Stats + Graphiques)
// - Accordéon (un seul panneau ouvert)
// - Scroll interne
// - Cartes stats rapides
// - Onglets: Rapides | Volées | Checkouts | Hits | Graphiques
// - Graphiques Recharts: Radar (volume par secteur) + BarStack (anneaux)
// ============================================
import React from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  CartesianGrid,
} from "recharts";
import ResponsiveChartBox from "./ResponsiveChartBox";

/* ---- Types légers (compat) ---- */
type PlayerMini = { id: string; name: string; avatarDataUrl?: string | null };

type LegResult = {
  legNo: number;
  winnerId: string;
  order: string[]; // classement (ids)
  finishedAt: number;
  remaining: Record<string, number>;
  darts: Record<string, number>;
  visits: Record<string, number>;
  avg3: Record<string, number>;
  bestVisit: Record<string, number>;
  bestCheckout: Record<string, number | null>;

  // Compat anciens champs :
  x180?: Record<string, number>;

  // Bins EXCLUSIFS par volée :
  h60?: Record<string, number>;
  h100?: Record<string, number>;
  h140?: Record<string, number>;
  h180?: Record<string, number>;
  doubles: Record<string, number>;
  triples: Record<string, number>;
  bulls: Record<string, number>;

  // Données détaillées :
  visitSumsByPlayer?: Record<string, number[]>; // Volées: score par volée
  checkoutDartsByPlayer?: Record<string, number[]>; // nb de fléchettes lors du CO réussi
  hitsBySector?: Record<string, Record<string, number>>; // S20/D20/T20/… IB/OB/MISS
};

export default function EndOfLegOverlay({
  open,
  result,
  playersById,
  onReplay,
  onClose,
  onSave,
}: {
  open: boolean;
  result: LegResult | null;
  playersById: Record<string, PlayerMini>;
  onReplay: () => void;
  onClose: () => void;
  onSave?: (r: LegResult) => void;
}) {
  if (!open || !result) return null;

  const {
    order = [],
    remaining,
    avg3,
    visits,
    darts,
    bestVisit,
    bestCheckout,
    doubles,
    triples,
    bulls,
    visitSumsByPlayer = {},
    checkoutDartsByPlayer = {},
    hitsBySector = {},
  } = result;

  // Bins exclusifs (fallback avec compat x180)
  const h60 = result.h60 ?? {};
  const h100 = result.h100 ?? {};
  const h140 = result.h140 ?? {};
  const h180 = result.h180 ?? result.x180 ?? {};

  // État accordéon (un seul panneau ouvert)
  const [openKey, setOpenKey] = React.useState<string>("rapides");
  const toggle = (key: string) => setOpenKey((k) => (k === key ? "" : key));

  // Sélection joueur pour les graphiques
  const [selectedPid, setSelectedPid] = React.useState<string>(order[0] || "");
  React.useEffect(() => {
    if (!selectedPid && order.length) setSelectedPid(order[0]);
  }, [order, selectedPid]);

  function two(n?: number) {
    if (n == null) return "—";
    const v = Math.round(n * 100) / 100;
    return v.toFixed(2).replace(/\.00$/, "");
  }
  function durationLabel(ts: number) {
    const ms = Math.max(0, Date.now() - ts);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // ====== Helpers Graphiques (à partir de hitsBySector[pid]) ======
  const SECTORS = Array.from({ length: 20 }, (_, i) => String(i + 1)).concat("25");

  function aggregateSectorTotals(hits: Record<string, number> = {}) {
    // total par secteur (1..20, 25)
    const map: Record<string, number> = Object.fromEntries(SECTORS.map((s) => [s, 0]));
    for (const [k, v] of Object.entries(hits)) {
      if (k === "MISS" || !v) continue;
      if (k === "IB" || k === "OB") {
        map["25"] += v;
        continue;
      }
      // clefs S20/D20/T20 -> extraire numéro de secteur
      const m = k.match(/^[SDT](\d{1,2})$/);
      if (m) {
        map[m[1]] = (map[m[1]] || 0) + v;
      }
    }
    return map;
  }

  function buildRadarData(pid: string) {
    const hits = hitsBySector[pid] || {};
    const totals = aggregateSectorTotals(hits);
    return SECTORS.map((s) => ({ sector: s, value: totals[s] || 0 }));
  }

  function buildBarStackData(pid: string) {
    const hits = hitsBySector[pid] || {};
    // pour lisibilité: on ne garde que les 6 secteurs les plus touchés
    const totals = aggregateSectorTotals(hits);
    const top = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([s]) => s);

    const get = (key: string) => hits[key] || 0;

    const rows = top.map((s) => {
      return {
        sector: s,
        Inner: s === "25" ? get("IB") : 0,
        Outer: (s === "25" ? get("OB") : 0) + get(`S${s}`),
        Double: get(`D${s}`),
        Triple: get(`T${s}`),
        Miss: s === top[0] ? hits["MISS"] || 0 : 0, // on met MISS sur une seule barre pour visual
      };
    });

    // Si aucun top (partie vide), renvoyer au moins une ligne
    if (!rows.length) {
      return [{ sector: "—", Inner: 0, Outer: 0, Double: 0, Triple: 0, Miss: hits["MISS"] || 0 }];
    }
    return rows;
  }

  const radarData = React.useMemo(() => buildRadarData(selectedPid), [selectedPid, hitsBySector]);
  const barData = React.useMemo(() => buildBarStackData(selectedPid), [selectedPid, hitsBySector]);

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={title}>Classement de la manche</div>
          <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>
            Manche terminée — {durationLabel(result.finishedAt)}
          </div>
        </div>

        {/* Scroll area */}
        <div style={scrollCol}>
          {/* CLASSEMENT — ordre strictement basé sur result.order */}
          <div style={board}>
            {order.map((pid, i) => {
              const p = playersById[pid];
              const score = remaining[pid] ?? 0;
              const a3 = avg3[pid] ?? 0;
              return (
                <div key={pid} style={line}>
                  <div style={rankBox(i + 1)}>{i + 1}</div>

                  <div style={avatarWrap}>
                    {p?.avatarDataUrl ? <img src={p.avatarDataUrl} alt="" style={avatar} /> : null}
                  </div>

                  <div style={name} title={p?.name || ""}>
                    {p?.name || "—"}
                  </div>

                  <div style={scoreWrap}>
                    <div style={scoreGold}>{score}</div>
                    <div style={moy}>Moy/3 : {two(a3)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===== Accordéon ===== */}
          <AccordionSection
            label="Stats rapides"
            open={openKey === "rapides"}
            onToggle={() => toggle("rapides")}
          >
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              }}
            >
              {order.map((pid) => {
                const p = playersById[pid];
                return (
                  <div key={pid} style={card()}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <div style={miniAvatarWrap}>
                        {p?.avatarDataUrl ? (
                          <img
                            src={p.avatarDataUrl}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : null}
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#ffcf57",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p?.name || "—"}
                      </div>
                    </div>

                    <Row label="Volées" value={visits[pid] ?? 0} />
                    <Row label="Fléchettes" value={darts[pid] ?? 0} />
                    <Row label="Moy/3" value={two(avg3[pid])} />
                    <Row label="Best visit" value={bestVisit[pid] ?? 0} />
                    <Row label="Best CO" value={bestCheckout[pid] ?? 0} />

                    <hr style={hr} />
                    <Row label="60+" value={h60[pid] ?? 0} />
                    <Row label="100+" value={h100[pid] ?? 0} />
                    <Row label="140+" value={h140[pid] ?? 0} />
                    <Row label="180" value={h180[pid] ?? 0} />

                    <hr style={hr} />
                    <Row label="Doubles" value={doubles[pid] ?? 0} />
                    <Row label="Triples" value={triples[pid] ?? 0} />
                    <Row label="Bulls" value={bulls[pid] ?? 0} />
                  </div>
                );
              })}
            </div>
          </AccordionSection>

          <AccordionSection
            label="Volées"
            open={openKey === "volees"}
            onToggle={() => toggle("volees")}
          >
            <div style={card({ padding: 10, maxHeight: 300, overflow: "auto" })}>
              {order.map((pid) => (
                <div key={pid} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, color: "#e9ebf2", marginBottom: 6 }}>
                    {playersById[pid]?.name || "—"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(visitSumsByPlayer[pid] || []).map((v, i) => (
                      <span key={i} style={pill}>
                        {v}
                      </span>
                    ))}
                    {(visitSumsByPlayer[pid] || []).length === 0 && (
                      <span style={{ color: "#cfd3dd" }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            label="Checkouts (nb de fléchettes)"
            open={openKey === "checkouts"}
            onToggle={() => toggle("checkouts")}
          >
            <div style={card({ padding: 10, maxHeight: 300, overflow: "auto" })}>
              {order.map((pid) => {
                const arr = checkoutDartsByPlayer[pid] || [];
                const tries = arr.length;
                const min = tries ? Math.min(...arr) : 0;
                const max = tries ? Math.max(...arr) : 0;
                const mid = tries
                  ? Math.round((arr.reduce((s, x) => s + x, 0) / tries) * 100) / 100
                  : 0;
                return (
                  <div key={pid} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, color: "#e9ebf2", marginBottom: 6 }}>
                      {playersById[pid]?.name || "—"}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Tag label="CO réussis" value={tries} />
                      <Tag label="Min darts" value={min} />
                      <Tag label="Moy darts" value={mid} />
                      <Tag label="Max darts" value={max} />
                    </div>
                  </div>
                );
              })}
            </div>
          </AccordionSection>

          <AccordionSection
            label="Hits par secteur"
            open={openKey === "hits"}
            onToggle={() => toggle("hits")}
          >
            <div style={card({ padding: 10, maxHeight: 360, overflow: "auto" })}>
              {order.map((pid) => {
                const hits = hitsBySector[pid] || {};
                const entries = Object.entries(hits).sort();
                return (
                  <div key={pid} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, color: "#e9ebf2", marginBottom: 6 }}>
                      {playersById[pid]?.name || "—"}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 6,
                        gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                      }}
                    >
                      {entries.map(([k, v]) => (
                        <div key={k} style={hitCell}>
                          <span style={{ opacity: 0.75 }}>{k}</span>
                          <b>{v}</b>
                        </div>
                      ))}
                      {entries.length === 0 && <span style={{ color: "#cfd3dd" }}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </AccordionSection>

          {/* ====== Graphiques ====== */}
          <AccordionSection
            label="Graphiques"
            open={openKey === "charts"}
            onToggle={() => toggle("charts")}
          >
            <div style={card({ padding: 12 })}>
              {/* Sélecteur joueur */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {order.map((pid) => {
                  const active = pid === selectedPid;
                  return (
                    <button
                      key={pid}
                      onClick={() => setSelectedPid(pid)}
                      style={{
                        appearance: "none" as React.CSSProperties["appearance"],
                        borderRadius: 10,
                        padding: "6px 10px",
                        border: active
                          ? "1px solid rgba(255,207,87,.8)"
                          : "1px solid rgba(255,255,255,.12)",
                        background: active ? "rgba(255,207,87,.12)" : "transparent",
                        color: active ? "#ffcf57" : "#e7e7e7",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {playersById[pid]?.name || "—"}
                    </button>
                  );
                })}
              </div>

              {/* Grille des deux graphiques */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.4fr",
                  gap: 14,
                  minHeight: 260,
                }}
              >
                {/* Radar */}
                <div style={card({ padding: 8 })}>
                  <div style={{ fontWeight: 800, color: "#e9ebf2", marginBottom: 6 }}>
                    Volume par secteur
                  </div>
                  <ResponsiveChartBox active={openKey === "charts"} minHeight={260}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="sector" />
                        <Radar
                          name="Hits"
                          dataKey="value"
                          stroke="#ffcf57"
                          fill="#ffcf57"
                          fillOpacity={0.35}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </ResponsiveChartBox>
                </div>

                {/* Histogramme empilé */}
                <div style={card({ padding: 8 })}>
                  <div style={{ fontWeight: 800, color: "#e9ebf2", marginBottom: 6 }}>
                    Répartition par anneau (top secteurs)
                  </div>
                  <ResponsiveChartBox active={openKey === "charts"} minHeight={260}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="sector" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Inner" stackId="a" />
                        <Bar dataKey="Outer" stackId="a" />
                        <Bar dataKey="Double" stackId="a" />
                        <Bar dataKey="Triple" stackId="a" />
                        <Bar dataKey="Miss" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ResponsiveChartBox>
                </div>
              </div>
            </div>
          </AccordionSection>
        </div>

        {/* Footer */}
        <div style={footer}>
          <button onClick={onReplay} style={ghostBtnStyle}>
            Rejouer la manche
          </button>
          {onSave && (
            <button onClick={() => onSave(result)} style={goldBtnStyle}>
              Sauvegarder
            </button>
          )}
          <button onClick={onClose} style={darkBtnStyle}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Composants internes ===== */
function AccordionSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={sectionStyle}>
      <button
        onClick={onToggle}
        style={summaryStyle as React.CSSProperties}
        aria-expanded={open}
        aria-controls={`${label}-panel`}
      >
        <span>{label}</span>
        <span style={{ marginLeft: "auto", opacity: 0.7 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div id={`${label}-panel`} style={{ padding: 12, display: "grid", gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={row()}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

/** IMPORTANT : composant Tag (majuscule) + style renommé tagStyle */
function Tag({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span style={tagStyle}>
      <span style={{ opacity: 0.75, marginRight: 6 }}>{label}</span>
      <b>{value}</b>
    </span>
  );
}

/* ===== Styles ===== */
const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(0,0,0,.55)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
};
const panel: React.CSSProperties = {
  width: "min(980px, 96vw)",
  maxHeight: "92vh",
  background: "linear-gradient(180deg, #17181c, #101116)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 16,
  boxShadow: "0 18px 40px rgba(0,0,0,.45)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
};
const title: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 22,
  letterSpacing: 0.3,
  color: "#ffcf57",
  textShadow: "0 6px 24px rgba(255,195,26,.25)",
};
const scrollCol: React.CSSProperties = {
  overflow: "auto",
  paddingRight: 6,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const board: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(22,22,26,.9), rgba(14,14,16,.96))",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12,
  padding: 8,
};
const line: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto auto 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.06)",
  background:
    "radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.06), transparent 55%)",
  marginBottom: 8,
};
const rankBox = (n: number): React.CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 8,
  background:
    n === 1
      ? "linear-gradient(180deg,#ffd351,#f1b027)"
      : n === 2
      ? "linear-gradient(180deg,#d8dbe3,#a9afbd)"
      : "linear-gradient(180deg,#e7c59f,#b58b64)",
  color: "#141417",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 8px 18px rgba(0,0,0,.25)",
});
const avatarWrap: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "2px solid rgba(255,207,87,.7)",
  overflow: "hidden",
  background: "linear-gradient(180deg,#1b1b1f,#101114)",
  boxShadow: "0 6px 18px rgba(255,195,26,.18)",
};
const miniAvatarWrap: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
  flex: "0 0 auto",
};
const avatar: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const name: React.CSSProperties = {
  fontWeight: 800,
  color: "#e9ebf2",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};
const scoreWrap: React.CSSProperties = {
  justifySelf: "end",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  minWidth: 92,
};
const scoreGold: React.CSSProperties = {
  color: "#ffcf57",
  fontWeight: 900,
  fontSize: 18,
  lineHeight: 1,
};
const moy: React.CSSProperties = { color: "#cfd3dd", fontSize: 11, opacity: 0.9 };

const sectionStyle: React.CSSProperties = {
  marginTop: 6,
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid #26262b",
};
const summaryStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#1a1a1f",
  color: "#e9ebf2",
  fontWeight: 800,
  padding: "12px 14px",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
};

const footer: React.CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
  alignItems: "center",
  paddingTop: 8,
  borderTop: "1px solid #1c1c21",
  marginTop: 10,
};

const goldBtnStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: "10px 14px",
  border: "1px solid transparent",
  background: "linear-gradient(180deg, #f0b12a, #c58d19)",
  color: "#141417",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 0 24px rgba(240,177,42,.25)",
};
const darkBtnStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: "10px 14px",
  border: "1px solid #2a2a2f",
  background: "#101015",
  color: "#e7e7e7",
  cursor: "pointer",
  fontWeight: 800,
};
const ghostBtnStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: "10px 14px",
  border: "1px solid rgba(255,255,255,.14)",
  background: "transparent",
  color: "#eee",
  cursor: "pointer",
};

const card = (extra?: Partial<React.CSSProperties>): React.CSSProperties => ({
  border: "1px solid rgba(255,255,255,.08)",
  background: "linear-gradient(180deg, rgba(26,26,30,.96), rgba(14,14,16,.98))",
  borderRadius: 12,
  padding: 10,
  ...extra,
});
const pill: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.04)",
  borderRadius: 10,
  padding: "4px 8px",
  fontWeight: 700,
  color: "#ffcf57",
};
const hitCell: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 10,
  border: "1px solid #2a2a2f",
  fontSize: 12,
  background: "#141418",
  display: "flex",
  justifyContent: "space-between",
  color: "#e9ebf2",
};
const row = (): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 13,
  color: "#e9ebf2",
  padding: "2px 0",
});
const hr: React.CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,.06)",
  margin: "6px 0",
  border: "none",
};

/** Style du composant Tag (renommé pour éviter toute ambiguïté) */
const tagStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.04)",
  borderRadius: 10,
  padding: "4px 8px",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#e9ebf2",
};
