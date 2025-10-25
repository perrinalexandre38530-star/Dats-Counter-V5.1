import React from "react";
export default function ProfileAvatar({
  dataUrl, label, size = 56,
}: { dataUrl?: string; label?: string; size?: number }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        <img src={dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <b>{label || "P"}</b>
      )}
    </div>
  );
}
