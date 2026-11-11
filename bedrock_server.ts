/**
 * Forge Launcher — bedrock_server.ts · Bedrock Edition support (server side).
 *
 * The bedrock profile Forge tracks is Cinnabar — the independent, unofficial
 * Minecraft: Bedrock Edition client (Rust workspace + Go core, pinned to
 * Bedrock 1.26.40 / protocol 2168):
 *   https://github.com/mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1
 *
 * This module owns:
 *   · the res link the user pinned — app/src/acceptance (the Rust acceptance tree)
 *   · mirroring those resources into library/.bedrock/res (raw.githubusercontent)
 *   · /api/bedrock status · POST /api/bedrock/res (force resync)
 *   · /bedrock/res/<path> serving · the /bedrock/ deep link (play or landing)
 */

/* ---------------------------------------------- res link (the pinned source) */
export const BEDROCK_REPO = "mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1";
export const BEDROCK_BRANCH = "main";
export const BEDROCK_RES_PATH = "app/src/acceptance";
export const BEDROCK_RES_LINK = `https://github.com/${BEDROCK_REPO}/tree/${BEDROCK_BRANCH}/${BEDROCK_RES_PATH}`;
const GH_API = `https://api.github.com/repos/${BEDROCK_REPO}/contents/${BEDROCK_RES_PATH}?ref=${BEDROCK_BRANCH}`;
const GH_RAW = `https://raw.githubusercontent.com/${BEDROCK_REPO}/${BEDROCK_BRANCH}/`;

export type BedrockResFile = { path: string; bytes: number; sha: string };
export type BedrockResManifest = {
  link: string;
  repo: string;
  branch: string;
  resPath: string;
  files: BedrockResFile[];
  updatedAt: string | null;
};

/* ---------------------------------------------- host context (no cycles) */
type BedrockCtx = {
  LIB: string;
  pushLog: (level: "info" | "install" | "launch" | "warn" | "err", text: string) => void;
  findGame: (match: (g: { id: string; name: string; kind: string }) => boolean) =>
    | { id: string; name: string; kind: string }
    | undefined;
};

let ctx: BedrockCtx | null = null;
export function initBedrock(host: BedrockCtx) {
  ctx = host;
}

const need = (): BedrockCtx => {
  if (!ctx) throw new Error("bedrock module not initialised");
  return ctx;
};

const resDir = () => {
  const dir = join(need().LIB, ".bedrock", "res");
  mkdirSync(dir, { recursive: true });
  return dir;
};

/* node imports — lazily kept local so this file stays portable */
import { join, dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";

/* ---------------------------------------------- res manifest cache */
const manifestFile = () => join(need().LIB, ".bedrock", "res.json");

function loadResManifest(): BedrockResManifest | null {
  try {
    return JSON.parse(readFileSync(manifestFile(), "utf8")) as BedrockResManifest;
  } catch {
    return null;
  }
}

function saveResManifest(m: BedrockResManifest) {
  const f = manifestFile();
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(m, null, 2) + "\n");
}

/* ---------------------------------------------- the res sync */
export async function bedrockResSync(force = false): Promise<BedrockResManifest> {
  const cached = loadResManifest();
  if (cached && !force) return cached;

  need().pushLog("install", `bedrock res sync — mirroring ${BEDROCK_RES_PATH} from ${BEDROCK_REPO} …`);
  const list = (await fetch(GH_API, {
    headers: { accept: "application/vnd.github+json", "user-agent": "forge-launcher" },
    signal: AbortSignal.timeout(30_000),
  }).then((r) => {
    if (!r.ok) throw new Error(`github refused the res listing (HTTP ${r.status})`);
    return r.json();
  })) as Array<{ type: string; path: string; size: number; sha: string; download_url: string }>;

  const files: BedrockResFile[] = [];
  for (const item of list) {
    if (item.type !== "file") continue;
    const rel = item.path.slice(BEDROCK_RES_PATH.length + 1); // "acceptance/<name>.rs"
    const dest = join(resDir(), ...rel.split("/"));
    mkdirSync(dirname(dest), { recursive: true });
    const text = await fetch(item.download_url, {
      headers: { "user-agent": "forge-launcher" },
      signal: AbortSignal.timeout(30_000),
    }).then((r) => {
      if (!r.ok) throw new Error(`res fetch failed for ${item.path} (HTTP ${r.status})`);
      return r.text();
    });
    writeFileSync(dest, text);
    files.push({ path: item.path, bytes: Buffer.byteLength(text), sha: item.sha.slice(0, 12) });
  }

  const manifest: BedrockResManifest = {
    link: BEDROCK_RES_LINK,
    repo: BEDROCK_REPO,
    branch: BEDROCK_BRANCH,
    resPath: BEDROCK_RES_PATH,
    files,
    updatedAt: new Date().toISOString(),
  };
  saveResManifest(manifest);
  need().pushLog("install", `✔ bedrock res synced — ${files.length} files → library/.bedrock/res`);
  return manifest;
}

/* ---------------------------------------------- status */
export function bedrockStatus() {
  const host = need();
  const m = loadResManifest();
  const game = host.findGame((g) => /bedrock|cinnabar/i.test(`${g.id} ${g.name}`)) ?? null;
  return {
    profile: {
      name: "Cinnabar",
      edition: "Minecraft: Bedrock Edition 1.26.40",
      protocol: 2168,
      language: "Rust (Bevy render) + Go (net core)",
      note: "independent unofficial bedrock client — not affiliated with Mojang/Microsoft",
    },
    resLink: BEDROCK_RES_LINK,
    res: {
      synced: !!m,
      files: m?.files.length ?? 0,
      updatedAt: m?.updatedAt ?? null,
      bytes: m?.files.reduce((n, f) => n + f.bytes, 0) ?? 0,
    },
    game: game ? { id: game.id, name: game.name, kind: game.kind } : null,
    playable: game ? `/play/${game.id}/` : "/bedrock/",
  };
}

/* ---------------------------------------------- /bedrock/res/<path> serving */
const TEXTY = /\.(rs|md|toml|txt|json|lock)$/i;
export function serveBedrockRes(rel: string): Response | null {
  const dir = join(need().LIB, ".bedrock", "res");
  const norm = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  const abs = join(dir, norm);
  if (!abs.startsWith(dir) || !existsSync(abs) || !statSync(abs).isFile()) return null;
  const body = readFileSync(abs);
  return new Response(body, {
    headers: {
      "content-type": TEXTY.test(norm) ? "text/plain; charset=utf-8" : "application/octet-stream",
      "cache-control": "no-cache",
    },
  });
}

/* ---------------------------------------------- the /bedrock/ deep link */
export function bedrockLanding(): Response {
  const st = bedrockStatus();
  const resRow = st.res.synced
    ? `${st.res.files} files mirrored · ${(st.res.bytes / 1024).toFixed(1)} KB · updated ${new Date(st.res.updatedAt as string).toLocaleString()}`
    : "not mirrored yet — hit “Sync bedrock res” in the Runtime tab";
  const gameRow = st.game
    ? `<a href="/play/${st.game.id}/">▶ Play ${st.game.name}</a> — boots through the Forge Boot Menu like any web game`
    : `no bedrock build installed — drop a Cinnabar/bedrock zip into Downloads and open <b>Load Game</b> (auto-discovered), or forge one natively from the Cinnabar workspace (<code>cargo build --release -p bedrock-client</code>) and install the exe.`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Forge · Bedrock</title>
<style>
  body { background:#0b0a10; color:#eceaf4; font:15px/1.6 "Segoe UI",system-ui,sans-serif; display:grid; place-items:center; min-height:100vh; margin:0 }
  .card { max-width:660px; background:#15121f; border:1px solid #ffffff12; border-radius:16px; padding:28px 30px }
  h1 { margin:0 0 4px; font-size:22px } .tag { color:#ffd9ad; font:700 11px Consolas,monospace; letter-spacing:1.5px }
  .row { padding:10px 0; border-bottom:1px dashed #ffffff12; display:flex; gap:10px; flex-wrap:wrap }
  .k { color:#9a95b3; min-width:110px; font-size:12px; text-transform:uppercase; letter-spacing:.8px }
  a { color:#ffb340 } code { color:#9fb8a9 } .foot { color:#6e6887; font-size:12px; margin-top:16px }
</style></head><body><div class="card">
  <div class="tag">⬛ FORGE · BEDROCK EDITION</div>
  <h1>Cinnabar — Minecraft: Bedrock on Forge</h1>
  <div class="row"><span class="k">profile</span><span>${st.profile.name} · ${st.profile.edition} · protocol ${st.profile.protocol}</span></div>
  <div class="row"><span class="k">stack</span><span>${st.profile.language}</span></div>
  <div class="row"><span class="k">res link</span><span><a href="${st.resLink}">${st.resLink.replace("https://github.com/", "github/")}</a><br><small>${resRow}</small></span></div>
  <div class="row"><span class="k">play</span><span>${gameRow}</span></div>
  <div class="foot">bedrock resources live in <code>library/.bedrock/res</code> · served at <code>/bedrock/res/…</code> · nothing leaves this machine</div>
</div></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
