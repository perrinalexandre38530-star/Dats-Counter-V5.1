// ============================================
// src/components/ProfileAvatar.tsx
// Avatar + couronne d’étoiles dorées (moy. 3-darts)
// - Accepte EITHER {dataUrl,label,size,avg3D,showStars}
//   OR      {profile,size,avg3D,showStars}
// - Aucun accès direct non-sécurisé à profile.*
// ============================================
import React from "react";
import ProfileStarRing from "./ProfileStarRing";

type ProfileLike = {
  name?: string;
  avatarDataUrl?: string | null;
  avatarUrl?: string | null;
  stats?: { avg3D?: number | null; avg3?: number | null } | null;
};

type Props =
  | {
      dataUrl?: string;
      label?: string;
      size?: number;
      avg3D?: number | null;
      showStars?: boolean;
      profile?: never;
    }
  | {
      profile?: ProfileLike | null;
      size?: number;
      avg3D?: number | null;    // force/override
      showStars?: boolean;
      dataUrl?: never;
      label?: never;
    };

export default function ProfileAvatar(props: Props) {
  const size = props.size ?? 56;
  const showStars = props.showStars ?? true;

  // Normalisation des données (robuste)
  const p: ProfileLike | null = ("profile" in props ? props.profile : null) ?? null;
  const img =
    ("dataUrl" in props ? props.dataUrl : undefined) ??
    p?.avatarDataUrl ??
    p?.avatarUrl ??
    null;

  const name =
    ("label" in props ? props.label : undefined) ??
    p?.name ??
    "P";

  // Moyenne 3-darts pour les étoiles
  const avg3D =
    ("avg3D" in props ? props.avg3D : undefined) ??
    p?.stats?.avg3D ??
    p?.stats?.avg3 ??
    null;

  return (
    <div
      className="relative avatar inline-block"
      style={{ width: size, height: size, borderRadius: "50%" }}
    >
      {img ? (
        <img
          src={img}
          alt={name ?? "avatar"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
            display: "block",
          }}
        />
      ) : (
        <div
          className="flex items-center justify-center bg-gray-700 text-white rounded-full"
          style={{
            width: "100%",
            height: "100%",
            fontSize: Math.max(10, size * 0.4),
            fontWeight: 700,
            borderRadius: "50%",
          }}
          aria-label={name}
          title={name}
        >
          {(name ?? "P").slice(0, 1).toUpperCase()}
        </div>
      )}

      {/* Couronne d’étoiles (optionnelle) */}
      {showStars && <ProfileStarRing avg3d={avg3D ?? 0} anchorSize={size} />}
    </div>
  );
}
