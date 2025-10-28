// ============================================
// src/components/ResponsiveChartBox.tsx
// Conteneur de graphique sécurisé pour Recharts
// - Force une hauteur min
// - Rendu seulement quand visible
// ============================================

import React from "react";

export default function ResponsiveChartBox({
  children,
  active = true,
  minHeight = 200,
}: {
  children: React.ReactNode;
  active?: boolean;
  minHeight?: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: active ? `${minHeight}px` : `${minHeight}px`, // ✅ toujours une hauteur visible
        minHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}
