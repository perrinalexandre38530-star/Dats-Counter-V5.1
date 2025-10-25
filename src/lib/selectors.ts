import type { Store } from "./types";

export function profileMap(store: Store) {
  const byId = new Map(store.profiles.map(p => [p.id, p]));
  return {
    nameOf: (id: string) => byId.get(id)?.name || id,
    avatarOf: (id: string) => byId.get(id)?.avatarDataUrl,
  };
}
