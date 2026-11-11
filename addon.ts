/**
 * Forge Launcher — addon.ts · the addons data layer (client side).
 * Addons are attached zips in library/.addons — Minecraft-style behavior
 * addons (.mcaddon/.mcpack), plain mods, and resource packs. The server keeps
 * the registry; mods.ts and resorces pack.ts slice it by kind.
 */

export type AddonKind = "addon" | "mod" | "resource";

export type Addon = {
  id: string;
  name: string;
  kind: AddonKind;
  file: string; // zip file name inside library/.addons
  bytes: number;
  enabled: boolean;
  attached: string[]; // game ids this pack rides with
  addedAt: string;
};

type Post = (path: string, body: Record<string, unknown>) => Promise<unknown>;
const post: Post = (path, body) =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) throw new Error(String(data.error ?? `refused (${r.status})`));
    return data;
  });

export const addonsApi = {
  list: () => fetch("/api/addons").then((r) => r.json()) as Promise<Addon[]>,
  install: (src: { url?: string; zipPath?: string }, opts: { name?: string; kind?: AddonKind } = {}) =>
    post("/api/addons/install", { ...src, name: opts.name, kind: opts.kind }) as Promise<{ addon: Addon }>,
  toggle: (id: string) => post("/api/addons/toggle", { id }) as Promise<{ addon: Addon }>,
  remove: (id: string) => post("/api/addons/remove", { id }) as Promise<{ ok: boolean }>,
  attach: (id: string, gameId: string) => post("/api/addons/attach", { id, gameId }) as Promise<{ addon: Addon }>,
};

/** Tiny stateful hook for views — reload after every action. */
export function addonsActions(reload: () => void) {
  return {
    install: async (src: { url?: string; zipPath?: string }, opts?: { name?: string; kind?: AddonKind }) => {
      const r = await addonsApi.install(src, opts);
      reload();
      return r.addon;
    },
    toggle: async (id: string) => {
      const r = await addonsApi.toggle(id);
      reload();
      return r.addon;
    },
    remove: async (id: string) => {
      await addonsApi.remove(id);
      reload();
    },
    attach: async (id: string, gameId: string) => {
      const r = await addonsApi.attach(id, gameId);
      reload();
      return r.addon;
    },
  };
}
