// ============================================
// src/pages/AvatarCreator.tsx
// Créateur d'avatar — transforme une photo en "cartoon" et l'insère dans un médaillon
// - Upload (drag & drop ou bouton)
// - Recadrage/zoom + déplacement dans un cercle
// - Effets : Posterize (palettes), Netteté, Contours (Sobel), Lissage
// - Export PNG 512x512 (avatar seul transparence) + version médaillon
// - AUCUNE dépendance externe (React + canvas)
// ============================================

import React, { useEffect, useRef, useState } from "react";

/* -------------------------------------------------
   Utils
------------------------------------------------- */
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function quantizeChannel(x: number, steps: number) {
  const s = Math.max(2, steps);
  const r = Math.floor((x / 255) * (s - 1));
  return Math.round((r / (s - 1)) * 255);
}
function convolve(src: Uint8ClampedArray, w: number, h: number, kernel: number[], ksize: number) {
  const half = (ksize - 1) >> 1;
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let ky = -half; ky <= half; ky++) {
        const yy = clamp(y + ky, 0, h - 1);
        for (let kx = -half; kx <= half; kx++) {
          const xx = clamp(x + kx, 0, w - 1);
          const wgt = kernel[(ky + half) * ksize + (kx + half)];
          const off = (yy * w + xx) * 4;
          r += src[off + 0] * wgt;
          g += src[off + 1] * wgt;
          b += src[off + 2] * wgt;
          a += src[off + 3] * wgt;
        }
      }
      const o = (y * w + x) * 4;
      out[o + 0] = clamp(Math.round(r), 0, 255);
      out[o + 1] = clamp(Math.round(g), 0, 255);
      out[o + 2] = clamp(Math.round(b), 0, 255);
      out[o + 3] = clamp(Math.round(a), 0, 255);
    }
  }
  return out;
}
function makeGaussianKernel(size: number, sigma: number) {
  const k = new Array(size * size);
  const half = (size - 1) / 2;
  const s2 = 2 * sigma * sigma;
  let sum = 0;
  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      const v = Math.exp(-(x * x + y * y) / s2);
      k[(y + half) * size + (x + half)] = v;
      sum += v;
    }
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}
function sobel(src: Uint8ClampedArray, w: number, h: number) {
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < src.length; i += 4, j++) {
    gray[j] = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) | 0;
  }
  const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const mag = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sx = 0, sy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const yy = clamp(y + ky, 0, h - 1);
        for (let kx = -1; kx <= 1; kx++) {
          const xx = clamp(x + kx, 0, w - 1);
          const pix = gray[yy * w + xx];
          const idx = (ky + 1) * 3 + (kx + 1);
          sx += pix * Gx[idx];
          sy += pix * Gy[idx];
        }
      }
      const m = Math.sqrt(sx * sx + sy * sy);
      mag[y * w + x] = clamp(Math.round((m / 1448) * 255), 0, 255);
    }
  }
  return mag;
}
function applyCartoonish(imgData: ImageData, opts: {
  blur: number;
  posterizeSteps: number;
  edgeStrength: number;
  edgeThreshold: number;
  sharpen: number;
}) {
  const { width: w, height: h } = imgData;
  let data = new Uint8ClampedArray(imgData.data);

  if (opts.blur > 0) {
    const size = 3 + 2 * Math.round(opts.blur);
    const sigma = 0.8 + 0.6 * opts.blur;
    const kernel = makeGaussianKernel(size, sigma);
    data = convolve(data, w, h, kernel, size);
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = quantizeChannel(data[i + 0], opts.posterizeSteps);
    data[i + 1] = quantizeChannel(data[i + 1], opts.posterizeSteps);
    data[i + 2] = quantizeChannel(data[i + 2], opts.posterizeSteps);
  }
  if (opts.sharpen > 0) {
    const blurK = makeGaussianKernel(3, 0.8);
    const blurred = convolve(data, w, h, blurK, 3);
    for (let i = 0; i < data.length; i += 4) {
      data[i + 0] = clamp(data[i + 0] + (data[i + 0] - blurred[i + 0]) * opts.sharpen, 0, 255);
      data[i + 1] = clamp(data[i + 1] + (data[i + 1] - blurred[i + 1]) * opts.sharpen, 0, 255);
      data[i + 2] = clamp(data[i + 2] + (data[i + 2] - blurred[i + 2]) * opts.sharpen, 0, 255);
    }
  }
  const edges = sobel(data, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = edges[y * w + x];
      if (e >= opts.edgeThreshold) {
        const o = (y * w + x) * 4;
        const k = lerp(0, 1, opts.edgeStrength);
        data[o + 0] = data[o + 0] * (1 - k);
        data[o + 1] = data[o + 1] * (1 - k);
        data[o + 2] = data[o + 2] * (1 - k);
      }
    }
  }
  return new ImageData(data, w, h);
}

/* -------------------------------------------------
   Composant principal
------------------------------------------------- */
export default function AvatarCreator({
  size = 512,
  overlaySrc = "/assets/medallion.svg",
  onExport,
}: {
  size?: number;
  overlaySrc?: string;
  onExport?: (files: { avatarPng: string; medallionPng: string }) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [zoom, setZoom] = useState(1.1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef({ x: 0, y: 0 });

  // Effets
  const [posterize, setPosterize] = useState(6);
  const [blur, setBlur] = useState(1);
  const [edgeStrength, setEdgeStrength] = useState(1.2);
  const [edgeThreshold, setEdgeThreshold] = useState(120);
  const [sharpen, setSharpen] = useState(0.6);

  // Canvas & overlay
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLImageElement | null>(null);

  // Charge overlay
  useEffect(() => {
    const o = new Image();
    o.crossOrigin = "anonymous";
    o.onload = () => { overlayRef.current = o; render(); };
    o.onerror = () => { overlayRef.current = null; render(); };
    o.src = overlaySrc;
  }, [overlaySrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-rendu quand l'image source finit de charger
  useEffect(() => {
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      render();
      return;
    }
    const onLoad = () => render();
    const onErr = () => render();
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onErr);
    return () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onErr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  // ----- Rendu sécurisé -----
  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Masque circulaire
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const s = zoom * (size / Math.min(iw, ih));
      const dw = iw * s;
      const dh = ih * s;
      const dx = (size - dw) / 2 + offset.x;
      const dy = (size - dh) / 2 + offset.y;

      const tmp = document.createElement("canvas");
      tmp.width = size; tmp.height = size;
      const tctx = tmp.getContext("2d")!;
      tctx.clearRect(0, 0, size, size);

      try {
        tctx.drawImage(img, dx, dy, dw, dh);
        const id = tctx.getImageData(0, 0, size, size);
        const cartoon = applyCartoonish(id, {
          blur,
          posterizeSteps: posterize,
          edgeStrength,
          edgeThreshold,
          sharpen,
        });
        ctx.putImageData(cartoon, 0, 0);
      } catch (e) {
        console.warn("[AvatarCreator] drawImage error:", e);
      }
    } else {
      // Placeholder quadrillage
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#d1d5db";
      for (let y = 0; y < size; y += 16) {
        for (let x = 0; x < size; x += 16) {
          if (((x + y) / 16) % 2 === 0) {
            ctx.fillStyle = "#f3f4f6"; ctx.fillRect(x, y, 16, 16);
          }
        }
      }
    }

    ctx.restore();
  }, [img, zoom, offset.x, offset.y, size, posterize, blur, edgeStrength, edgeThreshold, sharpen]);

  useEffect(() => { render(); }, [render]);

  // ----- Upload -----
  function handleFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    const f = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const i = new Image();
      i.onload = () => setImg(i);
      i.onerror = () => setImg(null);
      i.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  }

  // ----- Gestes -----
  function onPointerDown(e: React.PointerEvent) {
    setIsPanning(true);
    panRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!isPanning) return;
    setOffset({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y });
  }
  function onPointerUp(e: React.PointerEvent) {
    setIsPanning(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.05;
    setZoom((z) => clamp(z + delta, 0.5, 4));
  }

  // ----- Export -----
  function exportPngs() {
    const src = canvasRef.current!;
    // 1) Avatar seul (déjà masqué)
    const a = document.createElement("canvas");
    a.width = size; a.height = size;
    const actx = a.getContext("2d")!;
    actx.save();
    actx.beginPath();
    actx.arc(a.width / 2, a.height / 2, a.width / 2 - 2, 0, Math.PI * 2);
    actx.closePath();
    actx.clip();
    try { actx.drawImage(src, 0, 0); } catch {}
    actx.restore();
    const avatarPng = a.toDataURL("image/png");

    // 2) Version avec médaillon
    const m = document.createElement("canvas");
    m.width = size; m.height = size;
    const mctx = m.getContext("2d")!;
    mctx.drawImage(a, 0, 0);
    const overlay = overlayRef.current;
    try {
      if (overlay && overlay.complete && overlay.naturalWidth > 0) {
        mctx.drawImage(overlay, 0, 0, size, size);
      } else {
        // fallback anneau
        mctx.strokeStyle = "rgba(212,175,55,0.95)";
        mctx.lineWidth = Math.max(8, size * 0.04);
        mctx.beginPath();
        mctx.arc(size / 2, size / 2, size / 2 - mctx.lineWidth, 0, Math.PI * 2);
        mctx.stroke();
      }
    } catch (e) {
      console.warn("[AvatarCreator] overlay draw error:", e);
    }
    const medallionPng = m.toDataURL("image/png");

    onExport?.({ avatarPng, medallionPng });

    // Téléchargements
    const dl1 = document.createElement("a");
    dl1.href = avatarPng; dl1.download = "avatar.png"; dl1.click();
    const dl2 = document.createElement("a");
    dl2.href = medallionPng; dl2.download = "avatar-medallion.png"; dl2.click();
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-4">Créateur d'avatar</h1>

      <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Zone d'édition */}
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={`relative border rounded-xl overflow-hidden ${dragOver ? "ring-2 ring-blue-500" : "border-gray-300"}`}
          >
            <canvas
              ref={canvasRef}
              width={size}
              height={size}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onWheel={onWheel}
              className="w-full h-auto touch-none cursor-grab bg-transparent"
              style={{ aspectRatio: "1/1", display: "block" }}
            />
            {!img && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                <p className="text-gray-600 text-sm md:text-base">Glissez-déposez une photo ici</p>
                <p className="text-gray-500 text-xs">ou utilisez le bouton ci-dessous</p>
              </div>
            )}
          </div>

          {/* ✅ Bloc boutons : input en absolu + z-index pour garantir l'ouverture du sélecteur */}
          <div className="mt-3 flex items-center gap-3 relative z-10">
            <label
              className="inline-flex items-center px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer"
              style={{ position: "relative", zIndex: 10 }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <span>Choisir une image…</span>
            </label>

            <button
              className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
              onClick={exportPngs}
              disabled={!img}
              title={!img ? "Importer une image d’abord" : "Exporter en PNG"}
            >
              Exporter PNG
            </button>
          </div>
        </div>

        {/* Réglages */}
        <div className="p-4 border rounded-xl bg-white/80 backdrop-blur">
          <h2 className="font-semibold mb-2">Réglages</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-700">Zoom ({zoom.toFixed(2)}x)</label>
              <input type="range" min={0.5} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700">Posterize ({posterize})</label>
                <input type="range" min={3} max={12} step={1} value={posterize} onChange={(e) => setPosterize(parseInt(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Lissage ({blur.toFixed(1)})</label>
                <input type="range" min={0} max={3} step={0.1} value={blur} onChange={(e) => setBlur(parseFloat(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Contours (force {edgeStrength.toFixed(1)})</label>
                <input type="range" min={0} max={2} step={0.1} value={edgeStrength} onChange={(e) => setEdgeStrength(parseFloat(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Seuil contours ({edgeThreshold})</label>
                <input type="range" min={0} max={255} step={1} value={edgeThreshold} onChange={(e) => setEdgeThreshold(parseInt(e.target.value))} className="w-full" />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-700">Netteté ({sharpen.toFixed(1)})</label>
                <input type="range" min={0} max={2} step={0.1} value={sharpen} onChange={(e) => setSharpen(parseFloat(e.target.value))} className="w-full" />
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Astuce : déplacez l'image en maintenant appuyé dans le cercle. Utilisez la molette pour zoomer.
            </div>

            <div className="pt-3 border-t">
              <h3 className="font-medium mb-2">Médaillon</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Overlay :</span>
                <code className="px-2 py-1 bg-gray-100 rounded">{overlaySrc}</code>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Remplacez <code>/assets/medallion.svg</code> par votre médaillon transparent (PNG ou SVG) avec zone centrale évidée.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Aperçus */}
      <div className="mt-8">
        <h2 className="font-semibold mb-3">Aperçus export</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Preview canvasRef={canvasRef} overlayRef={overlayRef} size={128} />
          <Preview canvasRef={canvasRef} overlayRef={overlayRef} size={192} />
          <Preview canvasRef={canvasRef} overlayRef={overlayRef} size={256} />
          <Preview canvasRef={canvasRef} overlayRef={overlayRef} size={320} />
        </div>
      </div>
    </div>
  );
}

function Preview({
  canvasRef,
  overlayRef,
  size,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>,
  overlayRef: React.RefObject<HTMLImageElement>,
  size: number
}) {
  const [url, setUrl] = useState<string>("");
  const [urlM, setUrlM] = useState<string>("");

  useEffect(() => {
    const src = canvasRef.current;
    if (!src) return;

    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    try { ctx.drawImage(src, 0, 0, size, size); } catch {}
    ctx.restore();
    setUrl(c.toDataURL("image/png"));

    const m = document.createElement("canvas");
    m.width = size; m.height = size;
    const mctx = m.getContext("2d")!;
    mctx.drawImage(c, 0, 0);
    const overlay = overlayRef.current;
    try {
      if (overlay && overlay.complete && overlay.naturalWidth > 0) {
        mctx.drawImage(overlay, 0, 0, size, size);
      }
    } catch {}
    setUrlM(m.toDataURL("image/png"));
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <img src={url} alt="avatar" className="rounded-full border" style={{ width: size, height: size }} />
      <img src={urlM} alt="medallion" className="rounded-full border" style={{ width: size, height: size }} />
    </div>
  );
}
