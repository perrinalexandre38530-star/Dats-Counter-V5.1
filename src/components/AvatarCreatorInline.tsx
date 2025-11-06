// ============================================
// src/components/AvatarCreatorInline.tsx
// Stub minimal (compile OK) — remplace-le plus tard par la version complète
// ============================================
import React from "react";

export default function AvatarCreatorInline({
  size = 512,
  initialImage,
  overlaySrc = "/assets/medallion.svg",
  onSave,
  onCancel,
}: {
  size?: number;
  initialImage?: string | null;
  overlaySrc?: string;
  onSave: (avatarPng: string, medallionPng: string) => void;
  onCancel: () => void;
}) {
  const [preview, setPreview] = React.useState<string | null>(initialImage ?? null);

  function handleFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    const r = new FileReader();
    r.onload = () => setPreview(String(r.result));
    r.readAsDataURL(files[0]);
  }

  return (
    <div style={{ border: "1px solid var(--stroke)", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Créateur d’avatar (stub)</div>
      <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            width: 180, height: 180, borderRadius: "50%", overflow: "hidden",
            background: "#111", display: "grid", placeItems: "center", border: "1px solid #333"
          }}
        >
          {preview ? (
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="subtitle">Aperçu</span>
          )}
        </div>

        <label className="btn sm" style={{ position: "relative" }}>
          Choisir une image…
          <input
            type="file"
            accept="image/*"
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        <button
          className="btn ok sm"
          disabled={!preview}
          onClick={() => {
            // on renvoie la même image pour les deux sorties dans le stub
            onSave(preview!, preview!);
          }}
        >
          Enregistrer sur le profil
        </button>

        <button className="btn sm" onClick={onCancel}>Annuler</button>
      </div>

      <div className="subtitle" style={{ marginTop: 8 }}>
        overlay: <code>{overlaySrc}</code> · size: {size}px
      </div>
    </div>
  );
}
