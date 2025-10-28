// ============================================
// src/components/EndOfLegOverlay.tsx
// Overlay "Classement de la manche" — compact + libellés FR
// - Accordéons
// - Tables compactes qui tiennent en largeur
// - Renommages: "Stats rapides", "Stats Darts", "Stats globales"
// - Colonnes: DB/TP/Bull/DBull + % dans "Stats globales"
// - Résumé: vainqueur, Min Darts, Best Moy./3D, Best Volée, Best %DB, Best %TP, Best BULL
// - Guards Recharts (montage seulement si conteneur >= 220×240)
// ============================================

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

/* ---- Types légers (compat) ---- */
type PlayerMini = { id: string; name: string; avatarDataUrl?: string | null };

export type LegResult = {
  legNo: number;
  winnerId: string;
  order: string[];
  finishedAt: number;
  remaining: Record<string, number>;
  darts: Record<string, number>;
  visits: Record<string, number>;
  avg3: Record<string, number>;
  bestVisit: Record<string, number>;
  bestCheckout: Record<string, number | null>;
  x180: Record<string, number>;
  doubles: Record<string, number>;
  triples: Record<string, number>;
  bulls: Record<string, number>;
  visitSumsByPlayer?: Record<string, number[]>;
  checkoutDartsByPlayer?: Record<string, number[]>;
  hitsBySector?: Record<string, Record<string, number>>; // pour OB/IB
  h60?: Record<string, number>;
  h100?: Record<string, number>;
  h140?: Record<string, number>;
  h180?: Record<string, number>;
};

/* ====== WRAPPER (sans hooks) ====== */
export default function EndOfLegOverlay({
  open,
  result,
  playersById,
  onClose,
  onReplay,
  onSave,
}: {
  open: boolean;
  result: LegResult | null;
  playersById: Record<string, PlayerMini>;
  onClose: () => void;
  onReplay?: () => void;
  onSave?: (res: LegResult) => void;
}) {
  if (!open || !result) return null;
  return (
    <OverlayInner
      result={result}
      playersById={playersById}
      onClose={onClose}
      onReplay={onReplay}
      onSave={onSave}
    />
  );
}

/* ====== INNER (avec hooks) ====== */
function OverlayInner({
  result,
  playersById,
  onClose,
  onReplay,
  onSave,
}: {
  result: LegResult;
  playersById: Record<string, PlayerMini>;
  onClose: () => void;
  onReplay?: () => void;
  onSave?: (res: LegResult) => void;
}) {
  const nameOf = React.useCallback(
    (id?: string | null) => playersById[id || ""]?.name ?? (id ? id : "—"),
    [playersById]
  );
  const avatarOf = React.useCallback(
    (id?: string | null) => playersById[id || ""]?.avatarDataUrl ?? null,
    [playersById]
  );

  const order = result?.order ?? [];
  const num = (n?: number | null) => (typeof n === "number" && isFinite(n) ? n : 0);
  const pct = (a: number, b: number) =>
    b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0.0%";
  const fmt2 = (n?: number | null) =>
    typeof n === "number" && isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : "0.00";
  const avg = (arr?: number[]) =>
    arr && arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 100) / 100 : 0;

  // rows + dérivés (OB/IB & %)
  const rows = React.useMemo(() => {
    return order.map((pid, i) => {
      const darts = num(result?.darts?.[pid]);
      const doubles = num(result?.doubles?.[pid]);
      const triples = num(result?.triples?.[pid]);
      const hits = result?.hitsBySector?.[pid] || {};
      const ob = num(hits["OB"]);
      const ib = num(hits["IB"]);
      const bulls = ob + ib;

      return {
        pid,
        rank: i + 1,
        name: nameOf(pid),
        remaining: result?.remaining?.[pid] ?? 0,
        avg3: num(result?.avg3?.[pid]),
        best: num(result?.bestVisit?.[pid]),
        darts,
        visits: num(result?.visits?.[pid]),
        x180: num(result?.x180?.[pid]),
        doubles,
        triples,
        bulls, // total OB+IB
        ob,
        ib,
        h60: num(result?.h60?.[pid]),
        h100: num(result?.h100?.[pid]),
        h140: num(result?.h140?.[pid]),
        h180: num(result?.h180?.[pid]),
        coCount: result?.checkoutDartsByPlayer?.[pid]?.length ?? 0,
        coDartsAvg: avg(result?.checkoutDartsByPlayer?.[pid]),
        // % :
        pDB: pct(doubles, darts),
        pTP: pct(triples, darts),
        pBull: pct(ob, darts),
        pDBull: pct(ib, darts),
      };
    });
  }, [order, result, nameOf]);

  // Best-of pour Résumé
  const winnerId = result?.winnerId ?? order[0] ?? null;

  const minDarts = Math.min(...rows.map((r) => r.darts || Infinity));
  const minDartsRow = rows.find((r) => r.darts === minDarts);

  const bestAvg = Math.max(...rows.map((r) => r.avg3 || 0));
  const bestAvgRow = rows.find((r) => r.avg3 === bestAvg);

  const bestVol = Math.max(...rows.map((r) => r.best || 0));
  const bestVolRow = rows.find((r) => r.best === bestVol);

  const bestPDB = Math.max(...rows.map((r) => parseFloat(r.pDB) || 0));
  const bestPDBRow =
    rows.find((r) => parseFloat(r.pDB) === bestPDB) ?? null;

  const bestPTP = Math.max(...rows.map((r) => parseFloat(r.pTP) || 0));
  const bestPTPRow =
    rows.find((r) => parseFloat(r.pTP) === bestPTP) ?? null;

  const bestBullTotal = Math.max(...rows.map((r) => r.bulls || 0));
  const bestBullRow = rows.find((r) => r.bulls === bestBullTotal);

  // Graph data
  const barData = React.useMemo(
    () => rows.map((r) => ({ name: r.name, avg3: Number(fmt2(r.avg3)) })),
    [rows]
  );
  const radarKeys = React.useMemo(() => {
    const m = result?.hitsBySector || {};
    const first = order[0];
    if (!first || !m[first]) return null;
    const entries = Object.entries(m[first])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k]) => k);
    return entries.length ? entries : null;
  }, [result, order]);

  // UI
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
          borderRadius: 14,
          background: "linear-gradient(180deg, #17181c, #101116)",
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 16px 44px rgba(0,0,0,.45)",
          color: "#e7e7e7",
          fontSize: 12, // 👈 compact
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            background: "linear-gradient(180deg, #1a1b20, #13141a)",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            padding: "8px 10px",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 900, color: "#f0b12a", fontSize: 14 }}>
            Classement de la manche
          </div>
          <div style={{ opacity: 0.7, fontSize: 11, marginLeft: 6 }}>
            Manche terminée — {new Date(result?.finishedAt ?? Date.now()).toLocaleTimeString()}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} title="Fermer" style={btn("transparent", "#ddd", "#ffffff22")}>
            ✕
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: 10, paddingTop: 8 }}>
          {/* Classement */}
          <div
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.07)",
              background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
              marginBottom: 10,
            }}
          >
            {rows.map((r) => {
              const avatar = avatarOf(r.pid);
              const finished = (result?.remaining?.[r.pid] ?? 0) === 0;
              return (
                <div
                  key={r.pid}
                  style={{
                    padding: "6px 8px",
                    display: "grid",
                    gridTemplateColumns: "26px 36px 1fr auto",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: "1px solid rgba(255,255,255,.06)",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: "rgba(255,255,255,.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      color: "#ffcf57",
                      fontSize: 12,
                    }}
                  >
                    {r.rank}
                  </div>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "rgba(255,255,255,.08)",
                    }}
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#999",
                          fontWeight: 700,
                        }}
                      >
                        ?
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, color: "#ffcf57", fontSize: 13 }}>{r.name}</div>
                  <div style={{ fontWeight: 900, color: finished ? "#7fe2a9" : "#ffcf57" }}>
                    {finished ? "0" : result?.remaining?.[r.pid] ?? "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===== Accordéons ===== */}
          <Accordion title="Résumé de la partie" defaultOpen>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <KV label="Vainqueur" value={nameOf(winnerId)} strong />
              <KV
                label="Min Darts"
                value={
                  minDartsRow ? (
                    <>
                      <b style={{ color: "#ffcf57" }}>{minDartsRow.name}</b> — {minDartsRow.darts}
                    </>
                  ) : (
                    "—"
                  )
                }
                right
              />
              <KV
                label="Best Moy./3D"
                value={
                  bestAvgRow ? (
                    <>
                      <b style={{ color: "#ffcf57" }}>{bestAvgRow.name}</b> — {fmt2(bestAvgRow.avg3)}
                    </>
                  ) : (
                    "—"
                  )
                }
              />
              <KV
                label="Best Volée"
                value={
                  bestVolRow ? (
                    <>
                      <b style={{ color: "#ffcf57" }}>{bestVolRow.name}</b> — {bestVolRow.best}
                    </>
                  ) : (
                    "—"
                  )
                }
                right
              />
              <KV
                label="Best %DB"
                value={
                  bestPDBRow ? (
                    <>
                      <b style={{ color: "#ffcf57" }}>{bestPDBRow.name}</b> — {bestPDBRow.pDB}
                    </>
                  ) : (
                    "—"
                  )
                }
              />
              <KV
                label="Best %TP"
                value={
                  bestPTPRow ? (
                    <>
                      <b style={{ color: "#ffcf57" }}>{bestPTPRow.name}</b> — {bestPTPRow.pTP}
                    </>
                  ) : (
                    "—"
                  )
                }
                right
              />
              <KV
                label="Best BULL"
                value={
                  bestBullRow ? (
                    <>
                      <b style={{ color: "#ffcf57" }}>{bestBullRow.name}</b> — {bestBullRow.bulls}{" "}
                      <span style={{ opacity: 0.8 }}>
                        ({bestBullRow.ob} + {bestBullRow.ib})
                      </span>
                    </>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
          </Accordion>

          <Accordion title="Stats rapides">
            <div style={{ overflowX: "auto" }}>
              <table style={tableBase}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,.05)" }}>
                    <TH>Joueur</TH>
                    <TH>Volées</TH>
                    <TH>Darts</TH> {/* Fléchettes → Darts */}
                    <TH>Moy./3D</TH>
                    <TH>60+</TH>
                    <TH>100+</TH>
                    <TH>140+</TH>
                    <TH>180</TH>
                    <TH>Best Visit</TH>
                    <TH>CO best</TH>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pid} style={rowLine}>
                      <TDStrong>{r.name}</TDStrong>
                      <TD>{r.visits}</TD>
                      <TD>{r.darts}</TD>
                      <TD>{fmt2(r.avg3)}</TD>
                      <TD>{r.h60}</TD>
                      <TD>{r.h100}</TD>
                      <TD>{r.h140}</TD>
                      <TD>{r.h180}</TD>
                      <TD>{r.best}</TD>
                      <TD>{result?.bestCheckout?.[r.pid] ?? 0}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>

          <Accordion title="Stats Darts">
            <div style={{ overflowX: "auto" }}>
              <table style={tableBase}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,.05)" }}>
                    <TH>Joueur</TH>
                    <TH>CO</TH>
                    <TH>Darts CO</TH>
                    <TH>DB</TH>
                    <TH>TP</TH>
                    <TH>Bull</TH>
                    <TH>DBull</TH>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pid} style={rowLine}>
                      <TDStrong>{r.name}</TDStrong>
                      <TD>{r.coCount}</TD>
                      <TD>{r.coCount ? fmt2(r.coDartsAvg) : "—"}</TD>
                      <TD>{r.doubles}</TD>
                      <TD>{r.triples}</TD>
                      <TD>{r.ob}</TD>
                      <TD>{r.ib}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>

          <Accordion title="Stats globales">
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...tableBase, minWidth: 620 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,.05)" }}>
                    <TH>#</TH>
                    <TH>Joueur</TH>
                    <TH>Moy./3D</TH>
                    <TH>Pts Max</TH>
                    <TH>Darts</TH>
                    <TH>%DB</TH>
                    <TH>%TP</TH>
                    <TH>%Bull</TH>
                    <TH>%DBull</TH>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pid} style={rowLine}>
                      <TD>{r.rank}</TD>
                      <TDStrong>{r.name}</TDStrong>
                      <TD>{fmt2(r.avg3)}</TD>
                      <TD>{r.best}</TD>
                      <TD>{r.darts}</TD>
                      <TD>{r.pDB}</TD>
                      <TD>{r.pTP}</TD>
                      <TD>{r.pBull}</TD>
                      <TD>{r.pDBull}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>

          <Accordion title="Graphiques — hits par secteur & moyennes">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <ChartCard>
                <ChartMountGuard minW={220} minH={220}>
                  {() =>
                    radarKeys ? (
                      <ResponsiveContainer width="100%" height={230}>
                        <RadarChart
                          data={radarKeys.map((k) => ({
                            sector: k,
                            v: result?.hitsBySector?.[order[0]]?.[k] ?? 0,
                          }))}
                        >
                          <PolarGrid />
                          <PolarAngleAxis dataKey="sector" />
                          <Radar name="Hits" dataKey="v" />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartPlaceholder />
                    )
                  }
                </ChartMountGuard>
              </ChartCard>

              <ChartCard>
                <ChartMountGuard minW={220} minH={220}>
                  {() => (
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={barData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avg3" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartMountGuard>
              </ChartCard>
            </div>
          </Accordion>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
            {onReplay && (
              <button onClick={onReplay} style={btn("transparent", "#ddd", "#ffffff22")}>
                Rejouer la manche
              </button>
            )}
            {onSave && result && (
              <button
                onClick={() => onSave(result)}
                style={btn("linear-gradient(180deg, #f0b12a, #c58d19)", "#141417")}
              >
                Sauvegarder
              </button>
            )}
            <button onClick={onClose} style={btn("transparent", "#ddd", "#ffffff22")}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Accordéon ---------- */
function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,.08)",
        background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          color: "#e7e7e7",
          cursor: "pointer",
          fontWeight: 900,
          fontSize: 12,
        }}
      >
        <span style={{ color: "#f0b12a" }}>{title}</span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            border: "1px solid rgba(255,255,255,.12)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .15s",
          }}
        >
          ▾
        </span>
      </button>
      <div
        style={{
          overflow: "hidden",
          transition: "grid-template-rows 180ms ease",
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
        }}
      >
        <div style={{ overflow: "hidden", padding: open ? "0 10px 10px" : "0 10px 0" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------- Hook & Guards Charts ---------- */
function useSizeReady<T extends HTMLElement>(minW = 220, minH = 220) {
  const ref = React.useRef<T | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setReady(w >= minW && h >= minH);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minW, minH]);

  return { ref, ready };
}

function ChartMountGuard({
  children,
  minW = 220,
  minH = 220,
}: {
  children: (containerRef: React.RefObject<HTMLDivElement>) => React.ReactNode;
  minW?: number;
  minH?: number;
}) {
  const { ref, ready } = useSizeReady<HTMLDivElement>(minW, minH);
  return (
    <div ref={ref} style={{ width: "100%", minHeight: minH }}>
      {ready ? children(ref) : <ChartPlaceholder />}
    </div>
  );
}

/* ---------- UI helpers ---------- */
function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 10,
        background: "rgba(255,255,255,.03)",
        padding: 6,
        minHeight: 200,
        minWidth: 260,
      }}
    >
      {children}
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div
      style={{
        height: 230,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.6,
        fontStyle: "italic",
      }}
    >
      Préparation du graphe…
    </div>
  );
}

const tableBase: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 520,
  fontSize: 12,
};

const rowLine: React.CSSProperties = { borderBottom: "1px solid rgba(255,255,255,.06)" };

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "6px 8px",
        fontSize: 11,
        color: "#ffcf57",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}
function TD({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "6px 8px",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
function TDStrong({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "6px 8px",
        fontSize: 12,
        fontWeight: 800,
        color: "#ffcf57",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function KV({
  label,
  value,
  right,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  right?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 8,
        padding: "6px 8px",
        background: "rgba(255,255,255,.03)",
        display: "flex",
        gap: 8,
        justifyContent: right ? "space-between" : "flex-start",
        fontSize: 12,
      }}
    >
      <div style={{ opacity: 0.8 }}>{label}</div>
      <div style={{ marginLeft: "auto", fontWeight: strong ? 900 : 700, color: "#ffcf57" }}>
        {value}
      </div>
    </div>
  );
}

function btn(bg: string, fg: string, border?: string): React.CSSProperties {
  return {
    appearance: "none" as React.CSSProperties["appearance"],
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${border ?? "transparent"}`,
    background: bg,
    color: fg,
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  };
}
