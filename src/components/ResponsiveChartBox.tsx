// ============================================
// ResponsiveChartBox.tsx
// - Mesure son container (ResizeObserver)
// - N'affiche les enfants que si width/height > 0
// - Pratique pour Recharts dans des accordéons/overlays
// ============================================
import React from "react";

type Props = {
  className?: string;
  minHeight?: number;         // hauteur mini pour le conteneur
  active?: boolean;           // si false => ne rien rendre (ex: panneau replié)
  children: React.ReactNode;  // mettez ici <ResponsiveContainer> ... </ResponsiveContainer>
};

export default function ResponsiveChartBox({
  className,
  minHeight = 220,
  active = true,
  children,
}: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });

  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Si le panneau est replié ou la taille inconnue -> placeholder silencieux
  const ready = active && size.w > 10 && size.h > 10;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: "100%",
        minHeight,
        // Permet au parent flex/grid de donner de la place
        display: "block",
      }}
    >
      {ready ? children : null}
    </div>
  );
}
