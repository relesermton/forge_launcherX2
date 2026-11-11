/**
 * Forge Launcher — client.ts · the browser client.
 * The data layer lives here: typed API calls, the live SSE hook,
 * local-world storage helpers, and the React bootstrap.
 * UI lives in core.tsx · terminal in CLI.tsx.
 */
import { useEffect, useState } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./core.tsx";
import type { VersionResponse } from "./ENGINE-COMPILER.ts";

export type { VersionResponse };

/* ---------------------------------------------- types */
export type Game = {
  id: string;
  name: string;
  version: string;
  kind: "native" | "web";
  entry: string;
  sizeBytes: number;
  installedAt: string;
  lastLaunched?: string;
  running?: boolean;
  pid?: number;
};

export type Account = { name: string; createdAt: string; lastSeen?: string };
export type ServerEntry = { address: string; name: string; addedAt: string };
export type DiscoverItem = { path: string; name: string; size: number; mtime: number };
export type LogLine = { level: string; text: string };
export type LaunchResult = { url?: string; pid?: number; engine?: string };
export type WorldEntry = { key: string; world: string; bytes: number };

/* ---------------------------------------------- api */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(body.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown) =>
  api<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const forge = {
  games: () => api<Game[]>("/api/games"),
  discover: () => api<DiscoverItem[]>("/api/discover"),
  install: (zipPath: string) => post<{ game: Game }>("/api/install", { zipPath }),
  launch: (id: string) => post<LaunchResult>("/api/launch", { id }),
  quit: (id: string) => post<{ ok: boolean }>("/api/quit", { id }),
  remove: (id: string) => post<{ ok: boolean }>("/api/remove", { id }),

  session: () => api<{ account: Account | null; accounts: string[] }>("/api/session"),
  signin: (name: string) => post<{ account: Account }>("/api/signin", { name }),
  signout: () => post<{ ok: boolean }>("/api/signout", {}),

  servers: () => api<ServerEntry[]>("/api/servers"),
  addServer: (address: string, name?: string) => post<{ server: ServerEntry }>("/api/servers", { address, name }),
  removeServer: (address: string) => post<{ ok: boolean }>("/api/servers/remove", { address }),

  version: () => api<VersionResponse>("/api/version"),
  download: (url: string) => post<{ game: Game }>("/api/download", { url }),
  setVersion: (
    patch: {
      launcher?: { name?: string; version?: string; channel?: string };
      engine?: { minWasmGc?: number };
      vm?: { maxSlots?: number; bootTimeoutMs?: number };
    },
  ) => post<VersionResponse>("/api/version/edit", patch),
};

/* ---------------------------------------------- live state (SSE) */
const LOG_MAX = 400;

export function useForge() {
  const [games, setGames] = useState<Game[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data) as
          | { type: "games"; games: Game[] }
          | { type: "log"; level: string; text: string }
          | { type: "account"; account: Account | null }
          | { type: "servers"; servers: ServerEntry[] };
        if (d.type === "games") setGames(d.games);
        else if (d.type === "account") { setAccount(d.account); }
        else if (d.type === "servers") setServers(d.servers);
        else setLogs((l) => [...l.slice(-(LOG_MAX - 1)), { level: d.level, text: d.text }]);
      } catch {
        /* ignore bad frames */
      }
    };
    forge.games().then(setGames).catch(() => {});
    forge.session().then((s) => { setAccount(s.account); setAccounts(s.accounts); }).catch(() => {});
    forge.servers().then(setServers).catch(() => {});
    return () => es.close();
  }, []);

  return { games, logs, account, accounts, servers, online };
}

/* ---------------------------------------------- world saves (same-origin data of the web games) */
export function listWorlds(): WorldEntry[] {
  const out: WorldEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/world/i.test(key)) continue;
      out.push({
        key,
        world: key.split(/[\\/:]/).pop() || key,
        bytes: (localStorage.getItem(key) || "").length,
      });
    }
  } catch { /* storage can be blocked — ignore */ }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export function eraseGameStorage(): Promise<{ keys: number; dbs: number }> {
  return new Promise((resolve) => {
    let keys = 0;
    try {
      const ks = Object.keys(localStorage);
      keys = ks.length;
      ks.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }

    const idb = indexedDB as unknown as { databases?: () => Promise<Array<{ name: string }>> };
    if (typeof idb.databases === "function") {
      idb
        .databases()
        .then(async (list) => {
          const arr = list || [];
          await Promise.all(
            arr.map(
              (d) =>
                new Promise<void>((res) => {
                  try {
                    const rq = indexedDB.deleteDatabase(d.name);
                    rq.onsuccess = rq.onerror = rq.onblocked = () => res();
                  } catch {
                    res();
                  }
                }),
            ),
          );
          resolve({ keys, dbs: arr.length });
        })
        .catch(() => resolve({ keys, dbs: 0 }));
    } else resolve({ keys, dbs: 0 });
  });
}

/* ---------------------------------------------- bootstrap */
createRoot(document.getElementById("root")!).render(createElement(App));
