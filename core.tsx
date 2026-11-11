/**
 * Forge Launcher — core.tsx · the core UI.
 * Sign-in gate → top bar → Play / Server / World / Load Game / Console.
 * The terminal lives in CLI.tsx · the look lives in css.css.
 */
import { useCallback, useEffect, useState } from "react";
import type { Account, DiscoverItem, Game, ServerEntry, WorldEntry, VersionResponse } from "./client.ts";
import { forge, useForge, listWorlds, eraseGameStorage } from "./client.ts";
import { Console } from "./CLI.tsx";
import { ServeView } from "./Serve.tsx";
import { BedrockTab } from "./BedrockTab.tsx";
import { BootMenu, type BootMode } from "./BOOTMENU.ts";
import { ForgeVmView } from "./FORGE-VM.ts";
import { getVm } from "./VM.ts";
import { GcPanel } from "./GC.tsx";
import { downloadAndInstall } from "./DOWLOAD-VERSION.ts";
import { RsHandler } from "./RsHandeler.Jsx";
import type { RsIr } from "./RsCOMPILERcore.ts";

/* ---------------------------------------------- helpers */
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const fmtSize = (n: number) =>
  n >= 1 << 30
    ? `${(n / (1 << 30)).toFixed(1)} GB`
    : n >= 1 << 20
      ? `${(n / (1 << 20)).toFixed(0)} MB`
      : `${Math.max(1, Math.round(n / 1024))} KB`;
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Toast = { id: number; text: string; kind: "info" | "good" | "err" };
type View = "play" | "server" | "world" | "system" | "serve" | "bedrock" | "install" | "console";
type BootPick = { game: Game; clean: boolean; mode: BootMode; server?: string };
let toastSeq = 0;

/* ---------------------------------------------- flame logo */
function Flame({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="forge-flame" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#ffb340" />
        </linearGradient>
      </defs>
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        fill="url(#forge-flame)"
      />
    </svg>
  );
}

/* ---------------------------------------------- toast host */
function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------- sign in / log out */
function SignIn({ accounts }: { accounts: string[] }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async (n: string) => {
    setBusy(true);
    setErr("");
    try {
      await forge.signin(n);
      // the SSE session broadcast flips the app into the launcher
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <Flame size={48} />
        <h1>
          Forge<span>Launcher</span>
        </h1>
        <p className="login-sub">Local sign-in — your profile lives on this PC, nothing is uploaded.</p>
        <input
          className="field big"
          autoFocus
          spellCheck={false}
          placeholder="Choose a nickname  (a–z A–Z 0–9 _, 3–16)"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void go(name);
          }}
        />
        {err && <div className="login-err">{err}</div>}
        <button className="btn big" disabled={busy || !name.trim()} onClick={() => void go(name)}>
          🔥 Sign in
        </button>
        {accounts.length > 0 && (
          <div className="login-profiles">
            <span className="dim-label">previous profiles</span>
            <div className="profile-row">
              {accounts.map((a) => (
                <button key={a} className="chip profile" onClick={() => void go(a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------- featured hero (PLAY) */
function Hero({
  game,
  busy,
  onPlay,
  onQuit,
}: {
  game: Game;
  busy: boolean;
  onPlay: (g: Game) => void;
  onQuit: (g: Game) => void;
}) {
  const running = !!game.running;
  const v = `v${hash(game.id) % 6}`;
  return (
    <section className={`hero ${v}`}>
      <div className="hero-glow" />
      <div className="hero-letter">{game.name.charAt(0).toUpperCase()}</div>
      <div className="hero-info">
        <div className="chips">
          {game.version && <span className="chip ac">v{game.version}</span>}
          <span className="chip">{game.kind === "web" ? "web · chromium · wasm-gc" : "native"}</span>
          {running && <span className="chip ok">▶ playing</span>}
        </div>
        <h2>{game.name}</h2>
        <p className="dim">
          {fmtSize(game.sizeBytes)} · installed {fmtDay(game.installedAt)} · plays{game.kind === "web" ? " in an app window (WASM-GC engine)" : " detached"}
        </p>
        <div className="hero-actions">
          {running && game.kind === "native" ? (
            <>
              <button className="btn big" disabled={busy} onClick={() => onPlay(game)}>
                ▶ Play again
              </button>
              <button className="btn big danger" disabled={busy} onClick={() => onQuit(game)}>
                ■ Quit
              </button>
            </>
          ) : (
            <button className="btn big" disabled={busy} onClick={() => onPlay(game)}>
              ▶ PLAY
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------- game card */
function GameCard({
  game,
  busy,
  onPlay,
  onQuit,
  onRemove,
}: {
  game: Game;
  busy: boolean;
  onPlay: (g: Game) => void;
  onQuit: (g: Game) => void;
  onRemove: (g: Game) => void;
}) {
  const running = !!game.running;
  const v = `v${hash(game.id) % 6}`;
  return (
    <article className={`card${running ? " running" : ""}`}>
      {running && <span className="playing">▶ Playing</span>}
      <button
        className="kill"
        title="Remove from library"
        onClick={() => {
          if (window.confirm(`Remove ${game.name} from the library?`)) onRemove(game);
        }}
      >
        ✕
      </button>
      <div className={`cover ${v}`}>
        <span className="let">{game.name.charAt(0).toUpperCase() || "?"}</span>
      </div>
      <div className="body">
        <div className="titl" title={game.name}>
          {game.name}
        </div>
        <div className="chips">
          {game.version && <span className="chip ac">v{game.version}</span>}
          <span className="chip">{game.kind === "web" ? "web · index.html" : "native"}</span>
        </div>
        <div className="foot">
          <span className="meta">
            {fmtSize(game.sizeBytes)} · {fmtDay(game.installedAt)}
          </span>
          {game.kind === "web" || !running ? (
            <button className="btn" disabled={busy} onClick={() => onPlay(game)}>
              {game.kind === "web" ? "▶ Play" : "▶ Launch"}
            </button>
          ) : (
            <button className="btn danger" disabled={busy} onClick={() => onQuit(game)}>
              ■ Quit
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------------------- play view (hero + shelf) */
function PlayView({
  games,
  busy,
  play,
  quit,
  remove,
  goInstall,
}: {
  games: Game[];
  busy: boolean;
  play: (g: Game) => void;
  quit: (g: Game) => void;
  remove: (g: Game) => void;
  goInstall: () => void;
}) {
  if (!games.length)
    return (
      <div className="empty">
        <div className="fl">🔥</div>
        <h3>No games forged yet</h3>
        <p>Take me to Load Game — point Forge at a .zip (with an index.html or an .exe inside) and it shelves it.</p>
        <button className="btn" onClick={goInstall}>
          ⚡ Load a game
        </button>
      </div>
    );
  return (
    <>
      <Hero game={games[0]} busy={busy} onPlay={play} onQuit={quit} />
      <h2 className="shelf-title">Shelf</h2>
      <div className="grid">
        {games.map((g) => (
          <GameCard key={g.id} game={g} busy={busy} onPlay={play} onQuit={quit} onRemove={remove} />
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------- server view */
function ServerView({
  servers,
  games,
  toast,
}: {
  servers: ServerEntry[];
  games: Game[];
  toast: (t: string, k?: Toast["kind"]) => void;
}) {
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const webGame = games.find((g) => g.kind === "web");

  const add = async () => {
    if (!addr.trim()) {
      toast("Enter a server address first", "err");
      return;
    }
    setBusy(true);
    try {
      await forge.addServer(addr.trim(), label.trim() || undefined);
      toast(`${label.trim() || addr.trim()} bookmarked`, "good");
      setAddr("");
      setLabel("");
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const join = (s: ServerEntry) => {
    if (!webGame) {
      toast("Load a web game (index.html) first, then it can join", "err");
      return;
    }
    window.open(`/play/${webGame.id}/?server=${encodeURIComponent(s.address)}`, "_blank", "noopener");
  };

  return (
    <>
      <h2 className="sect">Server</h2>
      <p className="sub">Bookmark multiplayer addresses — the web game talks to them over websocket (ws:// / wss://).</p>
      <div className="panel">
        <div className="fieldrow">
          <input
            className="field"
            spellCheck={false}
            placeholder="play.example.net  ·  wss://host:port  ·  ws://host:port"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
          <input
            className="field mini"
            placeholder="label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
          <button className="btn" disabled={busy} onClick={() => void add()}>
            + Add
          </button>
        </div>
      </div>
      <div className="disc">
        {servers.map((s) => (
          <div className="disc-item" key={s.address}>
            <span className="n">{s.name}</span>
            <span className="p" title={s.address}>
              {s.address}
            </span>
            <button className="btn" disabled={busy} onClick={() => join(s)}>
              Join
            </button>
            <button
              className="btn ghost"
              onClick={() => void forge.removeServer(s.address).catch((e: unknown) => toast(errMsg(e), "err"))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {servers.length === 0 && <div className="note">No servers bookmarked yet — add one above and hit Join.</div>}
      <p className="note">
        Join opens the game and passes the address as <code>?server=…</code> — if this build doesn't auto-join, it's
        right there in the game's Multiplayer screen.
      </p>
    </>
  );
}

/* ---------------------------------------------- world view */
function WorldView({
  games,
  toast,
}: {
  games: Game[];
  toast: (t: string, k?: Toast["kind"]) => void;
}) {
  const webGame = games.find((g) => g.kind === "web");
  const [worlds, setWorlds] = useState<WorldEntry[]>([]);
  const refresh = () => setWorlds(listWorlds());

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  const wipe = async () => {
    if (!window.confirm("Erase ALL game data on this machine (worlds, settings, caches)?")) return;
    const r = await eraseGameStorage();
    toast(`game data erased — ${r.keys} keys, ${r.dbs} storage zones`, "good");
    refresh();
  };

  return (
    <>
      <h2 className="sect">World</h2>
      <p className="sub">Worlds are saved by the game on this machine, in this app's own storage — manage them here.</p>
      <div className="world-actions">
        <button
          className="btn big"
          disabled={!webGame}
          onClick={() => webGame && window.open(`/play/${webGame.id}/`, "_blank", "noopener")}
        >
          🌍 Open singleplayer
        </button>
        <button className="btn danger" onClick={() => void wipe()}>
          ⚠ Erase game data
        </button>
        <button className="btn ghost" onClick={refresh}>
          ⟳ Refresh
        </button>
      </div>
      <div className="disc">
        {worlds.map((w) => (
          <div className="disc-item" key={w.key}>
            <span className="n">{w.world}</span>
            <span className="p" title={w.key}>
              {w.key}
            </span>
            <span className="s">{fmtSize(w.bytes * 2)}</span>
            <button
              className="btn ghost"
              onClick={() => {
                try {
                  localStorage.removeItem(w.key);
                } catch { /* ignore */ }
                refresh();
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {worlds.length === 0 && (
        <div className="note">No world saves found yet — start the game and create a world; it will appear here.</div>
      )}
    </>
  );
}

/* ---------------------------------------------- load game (install) */
function InstallView({
  toast,
  onInstalled,
}: {
  toast: (t: string, k?: Toast["kind"]) => void;
  onInstalled: () => void;
}) {
  const [path, setPath] = useState("");
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [busy, setBusy] = useState(false);

  const loadDiscover = () => forge.discover().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    void loadDiscover();
  }, []);

  const install = async (p: string) => {
    const zipPath = p.trim();
    if (!zipPath) {
      toast("Give me a path to a game .zip", "err");
      return;
    }
    setBusy(true);
    try {
      const { game } = await forge.install(zipPath.replace(/^"|"$/g, ""));
      toast(`${game.name} forged into your library`, "good");
      setPath("");
      onInstalled();
      void loadDiscover();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="sect">Load Game</h2>
      <p className="sub">
        Requires a <code>.zip</code> that contains an <code>index.html</code> (web game) or an <code>.exe</code>
        (native) — Forge unwraps nested zips and wires up the entry point.
      </p>
      <div className="drop">
        <div className="big">⚡ From your disk</div>
        <div className="hint">
          {items.length ? "Freshly spotted zips on your machine:" : "Scanning Downloads, Desktop and C:\\forge for game zips…"}
        </div>
        <div className="fieldrow">
          <input
            className="field"
            spellCheck={false}
            placeholder="C:\Users\you\Downloads\some-game-1.0.zip"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void install(path);
            }}
          />
          <button className="btn" disabled={busy} onClick={() => void install(path)}>
            Forge it
          </button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="disc">
          {items.map((it) => (
            <div className="disc-item" key={it.path}>
              <span className="n">{it.name}</span>
              <span className="p" title={it.path}>
                {it.path}
              </span>
              <span className="s">{fmtSize(it.size)}</span>
              <button className="btn ghost" disabled={busy} onClick={() => void install(it.path)}>
                Load
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------- runtime view (GC · engine · downloads) */
type RsFileOut = { module: string; js: string; ts: string; fns: number; ir?: RsIr };
type RsCompileResult = {
  ok: boolean;
  modules: number;
  fns: number;
  structs: number;
  enums: number;
  loc: number;
  files: RsFileOut[];
};

function SystemView({
  toast,
  games,
  play,
}: {
  toast: (t: string, k?: Toast["kind"]) => void;
  games: Game[];
  play: (g: Game, serverAddr?: string) => void;
}) {
  const [info, setInfo] = useState<VersionResponse | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  // version editor — the user can change the launcher's version & manifest, written to VERSION.json
  const [vf, setVf] = useState({ version: "", channel: "", minGc: "", slots: "", bootS: "" });
  const [saving, setSaving] = useState(false);
  // rs compiler — compile the mirrored Cinnabar res into src/ ts/ database/ fs/ bedrock/
  const [rsBusy, setRsBusy] = useState(false);
  const [rsOut, setRsOut] = useState<RsCompileResult | null>(null);

  useEffect(() => {
    forge.version().then(setInfo).catch((e: unknown) => toast(errMsg(e), "err"));
  }, []);

  useEffect(() => {
    if (!info) return;
    setVf({
      version: info.launcher?.version ?? "",
      channel: info.launcher?.channel ?? "stable",
      minGc: String(info.manifest?.engine?.minWasmGc ?? 119),
      slots: String(info.manifest?.vm?.maxSlots ?? 2),
      bootS: String((info.manifest?.vm?.bootTimeoutMs ?? 25000) / 1000),
    });
  }, [info]);

  const minGc = info?.manifest?.engine?.minWasmGc ?? 119;
  const major = Number(String(info?.engine?.version || "").split(".")[0]) || 0;
  const gcOk = info?.engine?.wasmGc && major >= minGc;

  const doDownload = () => {
    if (!isValidDownloadUrl(url.trim())) {
      toast("Enter a direct https://…/game.zip URL", "err");
      return;
    }
    const u = url.trim();
    setUrl("");
    void quickFetch(u);
  };

  const saveVersion = async () => {
    const ver = vf.version.trim();
    const chan = vf.channel.trim().toLowerCase();
    const minGc = vf.minGc.trim();
    const slots = vf.slots.trim();
    const bootS = vf.bootS.trim();
    setSaving(true);
    try {
      const v = await forge.setVersion({
        launcher: { ...(ver ? { version: ver } : {}), ...(chan ? { channel: chan } : {}) },
        engine: minGc ? { minWasmGc: Number(minGc) } : undefined,
        vm: slots || bootS
          ? {
              ...(slots ? { maxSlots: Number(slots) } : {}),
              ...(bootS ? { bootTimeoutMs: Math.round(Number(bootS) * 1000) } : {}),
            }
          : undefined,
      });
      setInfo(v);
      setVf({ version: v.launcher.version, channel: v.launcher.channel, minGc, slots, bootS });
      toast(`launcher is now v${v.launcher.version} (${v.launcher.channel}) — written to VERSION.json`, "good");
    } catch (e) {
      toast(errMsg(e), "err");
      forge.version().then(setInfo).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const quickFetch = async (dlUrl: string) => {
    setBusy(true);
    try {
      const res = await downloadAndInstall(dlUrl, { onLog: (l) => setLines((ls) => [...ls.slice(-30), l]) });
      toast(`${res.game?.name ?? "Game"} fetched from the Eaglercraft server & forged into the library`, "good");
      forge.version().then(setInfo).catch(() => {});
    } catch (e) {
      toast(errMsg(e), "err");
      setLines((ls) => [...ls.slice(-30), `✘ ${errMsg(e)}`]);
    } finally {
      setBusy(false);
    }
  };

  const rsCompile = async () => {
    setRsBusy(true);
    try {
      const out = (await fetch("/api/rscompile", { method: "POST" }).then((r) => r.json())) as RsCompileResult;
      setRsOut(out);
      toast(`rs compile — ${out.modules} module(s), ${out.fns} fn(s), ${out.loc} loc → src/ ts/ database/`, "good");
    } catch (e) {
      toast(errMsg(e), "err");
      setRsOut(null);
    } finally {
      setRsBusy(false);
    }
  };

  return (
    <>
      <h2 className="sect">Runtime</h2>
      <p className="sub">The machine room — the in-app VM's collector, the engine compiler's verdict, downloads.</p>

      <h3 className="mini-title">Forge-VM · garbage collector</h3>
      <GcPanel toast={toast} />

      <h3 className="mini-title">Engine · compiled by ENGINE-COMPILER</h3>
      <div className="panel">
        <div className="sys-row">
          <span className="sys-key">engine</span>
          <span className="sys-val">{info?.engine?.path ?? "none found"}</span>
        </div>
        <div className="sys-row">
          <span className="sys-key">version</span>
          <span className="sys-val">
            {info?.engine?.version || "—"}
            {info?.engine?.version && (
              <span className={`chip ${gcOk ? "ok" : "err-chip"}`}>
                {gcOk ? `WASM-GC ready (floor v${minGc})` : "below WASM-GC floor"}
              </span>
            )}
          </span>
        </div>
        <div className="sys-row">
          <span className="sys-key">launcher</span>
          <span className="sys-val">
            {info?.launcher?.version ?? "—"} · channel {info?.launcher?.channel ?? "stable"} · VM slots{" "}
            {info?.manifest?.vm?.maxSlots ?? 2} · boot timeout {(info?.manifest?.vm?.bootTimeoutMs ?? 25000) / 1000}s
          </span>
        </div>
        <div className="sys-row ver-edit">
          <span className="sys-key">edit version</span>
          <input
            className="field-tiny"
            title="launcher version — letters, dots, dashes, pluses (e.g. 1.2.0-nightly)"
            placeholder="1.1.0"
            spellCheck={false}
            value={vf.version}
            onChange={(e) => setVf({ ...vf, version: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") void saveVersion(); }}
          />
          <input
            className="field-tiny"
            title="channel — lowercase letters (stable, beta, nightly…)"
            placeholder="stable"
            spellCheck={false}
            value={vf.channel}
            onChange={(e) => setVf({ ...vf, channel: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") void saveVersion(); }}
          />
          <input
            className="field-tiny"
            title="min engine major with WASM-GC (engine compiler floor)"
            placeholder="119"
            spellCheck={false}
            value={vf.minGc}
            onChange={(e) => setVf({ ...vf, minGc: e.target.value.replace(/[^\d]/g, "") })}
            onKeyDown={(e) => { if (e.key === "Enter") void saveVersion(); }}
          />
          <input
            className="field-tiny"
            title="max Forge-VM slots running at once"
            placeholder="2"
            spellCheck={false}
            value={vf.slots}
            onChange={(e) => setVf({ ...vf, slots: e.target.value.replace(/[^\d]/g, "") })}
            onKeyDown={(e) => { if (e.key === "Enter") void saveVersion(); }}
          />
          <input
            className="field-tiny"
            title="VM boot timeout in seconds"
            placeholder="25"
            spellCheck={false}
            value={vf.bootS}
            onChange={(e) => setVf({ ...vf, bootS: e.target.value.replace(/[^\d]/g, "") })}
            onKeyDown={(e) => { if (e.key === "Enter") void saveVersion(); }}
          />
          <button className="btn small" disabled={saving} onClick={() => void saveVersion()}>
            {saving ? "Forging…" : "💾 Save version"}
          </button>
        </div>
      </div>

      <h3 className="mini-title">RS Compiler · Cinnabar res → src/ ts/ database/</h3>
      <div className="panel">
        <div className="sys-row">
          <span className="sys-key">pipeline</span>
          <span className="sys-val">
            library/.bedrock/res (<code>*.rs</code>) → <code>RsCOMPILERcore</code> IR → src/ + ts/ + database/db.json →{" "}
            <code>RsHandeler</code>
          </span>
        </div>
        <div className="sys-row">
          <span className="sys-key">workspace</span>
          <span className="sys-val">
            <code>src/</code> <code>ts/</code> <code>database/</code> <code>fs/</code> <code>bedrock/</code>
            <span className="chip">js/ · lib.mjs · handlers · X/Y/Z</span>
          </span>
        </div>
        {rsOut && (
          <>
            <div className="sys-row">
              <span className="sys-key">last compile</span>
              <span className="sys-val">
                <span className="chip ok">{rsOut.modules} modules</span>
                <span className="chip">{rsOut.fns} fns</span>
                <span className="chip">{rsOut.structs} structs · {rsOut.enums} enums</span>
                <span className="chip">{rsOut.loc} loc</span>
              </span>
            </div>
            <div className="sys-row">
              <span className="sys-key">modules</span>
              <span className="sys-val">
                {rsOut.files.map((f) => (
                  <span className="chip" key={f.module} title={`${f.js} (+${f.ts})`}>
                    {f.module}
                    <b> ·{f.fns}</b>
                  </span>
                ))}
              </span>
            </div>
          </>
        )}
        <div className="sys-row btns">
          <button className="btn small" disabled={rsBusy} onClick={() => void rsCompile()}>
            {rsBusy ? "Compiling…" : "⚙ Compile res → workspace"}
          </button>
          <a className="btn small ghost" href="/database/db.json" target="_blank" rel="noreferrer">
            ↗ database/db.json
          </a>
        </div>
        {rsOut?.files?.length ? <RsHandler ir={rsOut.files[0].ir as RsIr} /> : null}
      </div>

      <h3 className="mini-title">Download · Eaglercraft server · VERSION.json</h3>
      <div className="panel">
        {(info?.manifest?.downloads?.length ?? 0) > 0 && (
          <div className="dl-chips">
            {(info?.manifest?.downloads ?? []).map((d) => (
              <button
                key={d.url}
                className="chip dl-chip"
                title={d.url}
                disabled={busy}
                onClick={() => void quickFetch(d.url)}
              >
                ⬣ {d.name}
              </button>
            ))}
          </div>
        )}
        <div className="fieldrow">
          <input
            className="field"
            spellCheck={false}
            placeholder="https://releases.example.com/awesome-game-1.2.zip"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void doDownload();
            }}
          />
          <button className="btn" disabled={busy} onClick={() => void doDownload()}>
            {busy ? "Reaching…" : "Download + Forge"}
          </button>
        </div>
        {lines.length > 0 && (
          <div className="vm-log">
            {lines.map((l, i) => (
              <div key={i} className="ln">
                {l}
              </div>
            ))}
          </div>
        )}
        <p className="note">
          A direct <code>.zip</code> URL lands in <code>library/.downloads</code>, gets unpacked, entry-detected and
          shelved — no manual step.
        </p>
      </div>
    </>
  );
}

/* ---------------------------------------------- app */
export function App() {
  const { games, logs, account, accounts, servers, online } = useForge();
  const [view, setView] = useState<View>("play");
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bootPick, setBootPick] = useState<BootPick | null>(null);
  // vmLive = the VM pane the user is looking at · vmHeld = a VM parked (auto-suspended) after a tab switch
  const [vmLive, setVmLive] = useState<{ game: Game; clean: boolean } | null>(null);
  const [vmHeld, setVmHeld] = useState<Game | null>(null);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++toastSeq;
    setToasts((ts) => [...ts, { id, text, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4200);
  }, []);

  // signed out → show the sign-in gate
  if (!account)
    return (
      <>
        <SignIn accounts={accounts} />
        <Toasts toasts={toasts} />
      </>
    );

  const withBusy = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const play = async (g: Game, serverAddr?: string) => {
    if (g.kind === "web") {
      // web games go through the boot menu — default boots INSIDE the app
      setBootPick({ game: g, clean: false, mode: "vm", server: serverAddr });
      return;
    }
    await withBusy(async () => {
      try {
        const r = await forge.launch(g.id);
        if (r.engine) toast(`${g.name} opened in an app window`, "good");
        else if (r.url) window.open(r.url, "_blank", "noopener");
        else toast(r.pid ? `${g.name} launched (pid ${r.pid})` : `${g.name} launched`, "good");
      } catch (e) {
        toast(errMsg(e), "err");
      }
    });
  };

  const quit = async (g: Game) => {
    await withBusy(async () => {
      try {
        await forge.quit(g.id);
        toast(`${g.name} stopped`, "good");
      } catch (e) {
        toast(errMsg(e), "err");
      }
    });
  };

  const remove = async (g: Game) => {
    await withBusy(async () => {
      try {
        await forge.remove(g.id);
        toast(`${g.name} removed from the library`, "good");
      } catch (e) {
        toast(errMsg(e), "err");
      }
    });
  };

  const signOut = () => {
    forge
      .signout()
      .catch((e: unknown) => toast(errMsg(e), "err"));
  };

  const runBoot = async (pick: BootPick) => {
    const { game, mode, clean, server } = pick;
    if (mode === "vm") {
      setVmHeld(null);
      setVmLive({ game, clean });
      return;
    }
    if (mode === "browser") {
      const q = server ? `?server=${encodeURIComponent(server)}` : "";
      window.open(`/play/${game.id}/${q}`, "_blank", "noopener");
      return;
    }
    // mode === "window" — external engine app window
    await withBusy(async () => {
      try {
        const r = await forge.launch(game.id);
        toast(r.engine ? `${game.name} opened in the external app window` : "no engine found — opened fallback", r.engine ? "good" : "info");
        if (!r.engine && r.url) window.open(r.url, "_blank", "noopener");
      } catch (e) {
        toast(errMsg(e), "err");
      }
    });
  };

  /** Tab switch — parks the VM (auto-suspend) when leaving the Play pane, resumes it on the way back. */
  const go = (v: View) => {
    if (vmLive && v !== "play") {
      setVmHeld(vmLive.game); // ForgeVmView unmount suspends the slot; saves stay
      setVmLive(null);
    } else if (v === "play" && vmHeld && getVm(vmHeld.id)) {
      // coming back to Play → drop right back into the (suspended) VM
      setVmLive({ game: vmHeld, clean: false });
      setVmHeld(null);
    }
    setView(v);
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <Flame />
          <h1>
            Forge<span>Launcher</span>
          </h1>
        </div>
        <nav className="tabs">
          {(
            [
              ["play", "Play"],
              ["server", "Server"],
              ["world", "World"],
              ["system", "Runtime"],
              ["bedrock", "Bedrock"],
              ["serve", "Serve"],
              ["install", "Load Game"],
              ["console", "Console"],
            ] as [View, string][]
          ).map(([v, txt]) => (
            <button key={v} className={`tab${view === v ? " on" : ""}`} onClick={() => go(v)}>
              {txt}
            </button>
          ))}
        </nav>
        <div className="user">
          <span className="dot on" title={online ? "forge online" : "reconnecting…"} />
          <span className="uname" title={account.name}>
            {account.name}
          </span>
          <button className="tab small" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      <main>
        {vmLive ? (
          <ForgeVmView
            game={vmLive.game}
            clean={vmLive.clean}
            onExpand={() => void withBusy(() => runBoot({ game: vmLive.game, clean: false, mode: "window" }))}
            onLeave={() => {
              setVmLive(null);
              setVmHeld(null);
            }}
          />
        ) : (
          <>
            {view === "play" && (
              <PlayView games={games} busy={busy} play={play} quit={quit} remove={remove} goInstall={() => setView("install")} />
            )}
            {view === "server" && <ServerView servers={servers} games={games} toast={toast} />}
            {view === "world" && <WorldView games={games} toast={toast} />}
            {view === "system" && <SystemView toast={toast} games={games} play={play} />}
            {view === "bedrock" && <BedrockTab toast={toast} games={games} play={play} />}
            {view === "serve" && <ServeView toast={toast} games={games} />}
            {view === "install" && <InstallView toast={toast} onInstalled={() => setView("play")} />}
            {view === "console" && <Console logs={logs} games={games} toast={toast} />}
          </>
        )}
      </main>

      <footer>
        Forge Launcher · signed in as {account.name} · nothing leaves this machine
      </footer>

      {bootPick && (
        <BootMenu
          game={bootPick.game}
          onBoot={(mode, clean) => {
            const pick = { ...bootPick, mode, clean };
            setBootPick(null);
            void runBoot(pick);
          }}
          onCancel={() => setBootPick(null)}
        />
      )}
      <Toasts toasts={toasts} />
    </div>
  );
}
