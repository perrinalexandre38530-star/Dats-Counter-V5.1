// ============================================
// src/lib/deviceStore.ts
// OPFS (Origin Private File System) + Persistance + GZIP
// API exportée : ensurePersisted(), estimate(), writeJSON(), readJSON(), remove()
// ============================================

/** Demande au navigateur d’accorder la persistance (évite le nettoyage automatique). */
export async function ensurePersisted(): Promise<boolean> {
    try {
      if (!('storage' in navigator) || !('persist' in navigator.storage)) return false;
      // Déjà persistant ?
      // @ts-ignore
      if (navigator.storage && (await navigator.storage.persisted?.())) return true;
      // Demander la persistance
      // @ts-ignore
      return (await navigator.storage.persist?.()) ?? false;
    } catch {
      return false;
    }
  }
  
  /** Estimation du quota et de l’usage courant. */
  export async function estimate() {
    // @ts-ignore
    const est = (await navigator.storage?.estimate?.()) || {};
    const quota = Number(est.quota || 0);
    const usage = Number(est.usage || 0);
    return { quota, usage, free: Math.max(0, quota - usage) };
  }
  
  /** Accès racine OPFS (Chromium/Android/desktop). */
  async function getRootDir(): Promise<FileSystemDirectoryHandle> {
    // @ts-ignore
    if (!navigator.storage || !navigator.storage.getDirectory) {
      throw new Error('OPFS non disponible sur ce navigateur.');
    }
    // @ts-ignore
    return await navigator.storage.getDirectory();
  }
  
  /** Assure l’existence d’un sous-dossier et retourne le handle. */
  async function getDir(path: string): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/').filter(Boolean);
    let dir = await getRootDir();
    for (const p of parts) {
      dir = await dir.getDirectoryHandle(p, { create: true });
    }
    return dir;
  }
  
  async function getFileHandle(path: string, create = true): Promise<FileSystemFileHandle> {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    const dir = await getDir(parts.join('/'));
    return await dir.getFileHandle(fileName, { create });
  }
  
  /** GZIP si disponible, sinon écrit brut. */
  async function gzipIfPossible(data: string): Promise<Blob> {
    // @ts-ignore
    const has = typeof CompressionStream !== 'undefined';
    if (!has) return new Blob([data], { type: 'application/json' });
    // @ts-ignore
    const cs = new CompressionStream('gzip');
    const stream = new Blob([data]).stream().pipeThrough(cs);
    const buf = await new Response(stream).arrayBuffer();
    return new Blob([buf], { type: 'application/gzip' });
  }
  
  /** Dé-GZIP si nécessaire. */
  async function gunzipIfNeeded(blob: Blob): Promise<string> {
    const type = blob.type || '';
    // @ts-ignore
    const has = typeof DecompressionStream !== 'undefined';
    if (has && (type.includes('gzip') || type === 'application/octet-stream')) {
      // @ts-ignore
      const ds = new DecompressionStream('gzip');
      const stream = blob.stream().pipeThrough(ds);
      return await new Response(stream).text();
    }
    return await blob.text();
  }
  
  /** Écrit un objet JSON (gzip) dans OPFS, en remplaçant le fichier. */
  export async function writeJSON(path: string, obj: unknown) {
    const json = JSON.stringify(obj);
    const fh = await getFileHandle(path, true);
    const writable = await fh.createWritable({ keepExistingData: false });
    try {
      const blob = await gzipIfPossible(json);
      await writable.write(blob);
    } finally {
      await writable.close();
    }
  }
  
  /** Lit un JSON (gzip ou non) depuis OPFS. Retourne null si absent. */
  export async function readJSON<T = any>(path: string): Promise<T | null> {
    try {
      const fh = await getFileHandle(path, false);
      const file = await fh.getFile();
      const text = await gunzipIfNeeded(file);
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }
  
  /** Supprime un fichier dans OPFS. */
  export async function remove(path: string) {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    const dir = await getDir(parts.join('/'));
    // @ts-ignore
    await dir.removeEntry(fileName, { recursive: false });
  }
  
  /** Helper : rotation si fichier trop gros */
  export async function writeJSONWithRotate(path: string, obj: unknown, maxBytes = 2_000_000) {
    try {
      // si le fichier existe et est trop gros -> rotate
      const fh = await getFileHandle(path, false);
      const f = await fh.getFile();
      if (f.size > maxBytes) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const rotated = path.replace(/\.json(\.gz)?$/i, `.${ts}.json`);
        // sauvegarder l’ancienne version
        const arrBuf = await f.arrayBuffer();
        const w = await (await getFileHandle(rotated, true)).createWritable();
        await w.write(new Blob([arrBuf], { type: f.type || 'application/octet-stream' }));
        await w.close();
        // supprimer l’original
        await remove(path);
      }
    } catch {
      // pas de fichier : rien à faire
    }
    await writeJSON(path, obj);
  }
  