/**
 * Forge Launcher — CLI.tsx · the in-app terminal.
 * Every launcher action, no mouse required: list, install, launch,
 * open, quit, remove. Lives inside the Console tab of the UI.
 */
import { useEffect, useRef, useState } from "react";
import type { Game, LogLine } from "./client.ts";
import { forge, listWorlds } from "./client.ts";
import { gcStats, collect, setGcAuto } from "./GC.ts";
import { listVms, suspendVm, resumeVm, killVm, focusVm } from "./VM.ts";
import { downloadAndInstall, isValidDownloadUrl } from "./DOWLOAD-VERSION.ts";
import { fetchBedrock, syncBedrockRes } from "./bedrock_client.ts";

type Line = { text: string; cls?: string };

const BANNER: Line[] = [
  "  __ _  ___  _ __ ___  ___ | |__   ___ ",
  " / _` |/ _ \\| '_ ` _ \\/ _ \\| '_ \\ / _ \\",
  "| (_| | (_) | | | | | | (_) | |_) |  __/",
  " \\__, |\\___/|_| |_| |_|\\___/|_.__/ \\___|",
  " |___/                                console ready",
  "",
  "type `help` for commands.",
].map((text) => ({ text, cls: "dim" }));

const HELP: [string, string][] = [
  ["help", "show this list"],
  ["list", "show your library"],
  ["install [path]", "forge a game from a .zip (auto-spots one in Downloads)"],
  ["launch <id|name>", "launch a game"],
  ["open <id|name>", "play a web game in a browser tab"],
  ["quit <id|name>", "stop a running game"],
  ["remove <id|name>", "uninstall it from the library"],
  ["signin <name>", "switch profile (local accounts)"],
  ["signout", "log out of the launcher"],
  ["server add <addr> [label]", "bookmark a multiplayer server"],
  ["server list", "show bookmarked servers"],
  ["server del <addr|label>", "forget a bookmarked server"],
  ["worlds", "list world saves of the signed-in game"],
  ["boot <id|name> [window|browser]", "boot a web game outside the Forge-VM"],
  ["vm list", "show running VM slots"],
  ["vm kill|suspend|resume <id|name>", "control the active VM"],
  ["gc [collect|stats|auto on/off]", "heap pressure + collector control"],
  ["version [set <ver> [channel]]", "show or rewrite the launcher version (VERSION.json)"],
  ["bedrock [res]", "Cinnabar bedrock profile — status / res-mirror sync"],
  ["download <zip-url>", "fetch a remote game zip and forge it (CDN presets live in Runtime)"],
  ["clear", "wipe the terminal"],
];

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function match(games: Game[], key: string): Game | undefined {
  const k = (key || "").toLowerCase().trim();
  return games.find((g) => g.id.startsWith(k)) ?? games.find((g) => g.name.toLowerCase().includes(k));
}

const LOG_CLS: Record<string, string> = { info: "", install: "", launch: "ok", warn: "err", err: "err" };

export function Console({
  logs,
  games,
  toast,
}: {
  logs: LogLine[];
  games: Game[];
  toast?: (t: string, k?: string) => void;
}) {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const outRef = useRef<HTMLDivElement>(null);
  const inpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [lines, logs]);

  const say = (text: string, cls?: string) =>
    setLines((ls) => [...ls.slice(-600), { text, cls }]);

  async function run(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    say(`forge ❯ ${cmd}`, "echo");
    setHistory((h) => [cmd, ...h].slice(0, 50));
    setHIdx(-1);

    const [verb, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");

    try {
      switch (verb.toLowerCase()) {
        case "help":
          for (const [c, d] of HELP) say(`  ${c.padEnd(22)} ${d}`);
          break;

        case "list":
          if (!games.length) {
            say("library is empty — try `install`.", "dim");
            break;
          }
          for (const g of games)
            say(
              `  ${g.id.padEnd(30)} ${g.kind.padEnd(7)} ${g.name}` +
                `${g.version ? ` v${g.version}` : ""}${g.running ? "  ▶ running" : ""}`,
            );
          break;

        case "install": {
          const found = await forge.discover();
          const spot = arg || found[0]?.path || "";
          if (!spot) {
            say("no zips found and no path given.", "err");
            break;
          }
          say(`forging ${spot} …`, "dim");
          const { game } = await forge.install(spot);
          say(`✔ ${game.name} → library/${game.id}`, "ok");
          break;
        }

        case "launch": {
          const g = match(games, arg);
          if (!g) {
            say(`no game matches "${arg}".`, "err");
            break;
          }
          if (g.kind === "web") {
            window.open(`/play/${g.id}/`, "_blank", "noopener");
            say(`▶ ${g.name} → browser tab`, "ok");
            break;
          }
          await forge.launch(g.id);
          say(`▶ ${g.name} launched`, "ok");
          break;
        }

        case "open": {
          const g = match(games, arg);
          if (!g) {
            say(`no game matches "${arg}".`, "err");
            break;
          }
          window.open(`/play/${g.id}/`, "_blank", "noopener");
          say(`▶ ${g.name} → browser tab`, "ok");
          break;
        }

        case "quit": {
          const g = match(games, arg);
          if (!g) {
            say(`no game matches "${arg}".`, "err");
            break;
          }
          await forge.quit(g.id);
          say(`■ ${g.name} stopped`, "ok");
          break;
        }

        case "remove": {
          const g = match(games, arg);
          if (!g) {
            say(`no game matches "${arg}".`, "err");
            break;
          }
          await forge.remove(g.id);
          say(`✔ ${g.name} removed`, "ok");
          break;
        }

        case "clear":
          setLines([]);
          break;

        case "signin": {
          if (!arg) {
            say("usage: signin <nickname>", "err");
            break;
          }
          const a = await forge.signin(arg.trim());
          say(`✔ signed in as ${a.name}`, "ok");
          break;
        }

        case "signout": {
          await forge.signout();
          say("✔ logged out", "ok");
          break;
        }

        case "server": {
          const [sub, first, ...rest] = cmd.split(/\s+/).slice(1);
          if (!sub || sub.startsWith("list")) {
            const list = await forge.servers();
            if (!list.length) {
              say("no servers bookmarked — `server add play.example.net`", "dim");
              break;
            }
            for (const s of list) say(`  ${s.name.padEnd(20)} ${s.address}`);
            break;
          }
          if (sub === "add") {
            if (!first) {
              say("usage: server add <address> [label]", "err");
              break;
            }
            const s = await forge.addServer(first, rest.join(" ") || undefined);
            say(`✔ ${s.name} → ${s.address}`, "ok");
            break;
          }
          if (sub === "del") {
            const key = first || "";
            const list = await forge.servers();
            const hit = list.find((s) => s.address === key) ?? list.find((s) => s.name.toLowerCase() === key.toLowerCase());
            if (!hit) {
              say(`no bookmark matches "${key}".`, "err");
              break;
            }
            await forge.removeServer(hit.address);
            say(`✔ removed ${hit.name}`, "ok");
            break;
          }
          say("usage: server add|list|del …", "err");
          break;
        }

        case "worlds": {
          const list = listWorlds();
          if (!list.length) {
            say("no world saves yet — start the game and create one.", "dim");
            break;
          }
          for (const w of list) say(`  ${w.world.padEnd(24)} ${(w.bytes * 2).toLocaleString()} bytes  (${w.key})`);
          break;
        }

        case "version": {
          const parts = cmd.split(/\s+/);
          if (parts[1] === "set") {
            const val = parts[2];
            if (!val) {
              say("usage: version set <version> [channel] — rewrites VERSION.json", "err");
              break;
            }
            try {
              const v = await forge.setVersion({
                launcher: { version: val, ...(parts[3] ? { channel: parts[3] } : {}) },
              });
              say(`✔ launcher is now v${v.launcher.version} (${v.launcher.channel}) — VERSION.json written`, "ok");
              toast?.(`launcher v${v.launcher.version} (${v.launcher.channel})`, "good");
            } catch (e) {
              say(`✘ ${errMsg(e)}`, "err");
            }
            break;
          }
          const v = await forge.version();
          say(`  launcher   ${v.launcher.name} v${v.launcher.version} (${v.launcher.channel})`);
          say(`  engine     ${v.engine.path ?? "none"} ${v.engine.version ? `v${v.engine.version}` : ""} ${v.engine.wasmGc ? "· WASM-GC ✔" : "· no wasm-gc"}`);
          say(`  vm config  ${JSON.stringify(v.manifest?.vm ?? {})}`);
          say(`  catalog    ${(v.manifest?.downloads ?? []).length} game(s) served by the Eaglercraft CDN`);
          break;
        }

        case "bedrock": {
          const sub = cmd.split(/\s+/)[1];
          try {
            if (sub === "res") {
              say("mirroring the Cinnabar acceptance tree …", "dim");
              const st = await syncBedrockRes();
              say(`✔ res mirrored — ${st.res.files} files (${(st.res.bytes / 1024).toFixed(1)} KB) → library/.bedrock/res`, "ok");
              say(`  updated ${new Date(st.res.updatedAt as string).toLocaleTimeString()}`, "dim");
              break;
            }
            const st = await fetchBedrock();
            say(`  profile   ${st.profile.name} — ${st.profile.edition} · protocol ${st.profile.protocol}`);
            say(`  stack     ${st.profile.language}`);
            say(`  res       ${st.res.synced ? `${st.res.files} files mirrored (${(st.res.bytes / 1024).toFixed(1)} KB)` : "not mirrored — run: bedrock res"}`);
            say(`  res link  ${st.resLink}`);
            say(`  game      ${st.game ? `${st.game.name} (${st.game.kind}) → ${st.playable}` : "no bedrock build installed"}`);
          } catch (e) {
            say(`✘ ${errMsg(e)}`, "err");
          }
          break;
        }

        case "download": {
          if (!arg || !isValidDownloadUrl(arg.trim())) {
            say("usage: download <https://…/game.zip>", "err");
            break;
          }
          say(`fetching ${new URL(arg.trim()).host} …`, "dim");
          const r = await downloadAndInstall(arg.trim());
          say(`✔ ${r.game?.name ?? "game"} forged → library/${r.game?.id}`, "ok");
          break;
        }

        case "gc": {
          const [sub, arg2] = cmd.split(/\s+/).slice(1);
          if (!sub || sub === "stats") {
            const s = gcStats();
            say(`  heap ${s.heapUsed ? `${(s.heapUsed / 1048576).toFixed(0)} MB` : "n/a"} / ${s.heapLimit ? `${(s.heapLimit / 1048576).toFixed(0)} MB` : "n/a"} · auto ${s.auto ? "on" : "off"}`);
            say(`  sweeps ×${s.swept} · reclaimed frames ${s.reclaimed} · last ${s.lastSweep ? new Date(s.lastSweep).toLocaleTimeString() : "never"}`);
            break;
          }
          if (sub === "collect") {
            const s = collect("cli");
            say(`✔ sweep done · total ×${s.swept}`, "ok");
            break;
          }
          if (sub === "auto") {
            const s = setGcAuto(arg2 === "on");
            say(`✔ auto-GC ${s.auto ? "on" : "off"}`, "ok");
            break;
          }
          say("usage: gc collect|stats|auto on/off", "err");
          break;
        }

        case "vm": {
          const [sub, rest0] = cmd.split(/\s+/).slice(1);
          if (!sub || sub === "list") {
            const vms = listVms();
            if (!vms.length) {
              say("no VM slots running — hit PLAY on a web game.", "dim");
              break;
            }
            for (const s of vms)
              say(`  #${s.id} ${s.gameName.padEnd(20)} ${s.state}${s.clean ? " (clean boot)" : ""}`);
            break;
          }
          const g = match(games, rest0 || "");
          if (!g) {
            say(`no game matches "${rest0}".`, "err");
            break;
          }
          if (sub === "kill") {
            killVm(g.id, "cli");
            say(`✔ VM for ${g.name} killed`, "ok");
            break;
          }
          if (sub === "suspend") {
            suspendVm(g.id);
            say(`✔ VM for ${g.name} suspended`, "ok");
            break;
          }
          if (sub === "resume") {
            const host = document.body;
            resumeVm(g.id, document.querySelector(".vm-host") ?? host);
            say(`✔ VM for ${g.name} resuming (open the VM view to see it)`, "ok");
            break;
          }
          say("usage: vm list|kill|suspend|resume <id|name>", "err");
          break;
        }

        case "boot": {
          const parts = cmd.split(/\s+/).slice(1);
          const g = match(games, parts[0] || "");
          if (!g) {
            say("usage: boot <id|name> [window|browser] — the default PLAY boot runs inside the app.", "err");
            break;
          }
          const mode = (parts[1] || "window").toLowerCase();
          if (mode === "browser") {
            window.open(`/play/${g.id}/`, "_blank", "noopener");
            say(`▶ ${g.name} → browser tab`, "ok");
            break;
          }
          const r = await forge.launch(g.id);
          if (r.engine) say(`▶ ${g.name} → external app window (${g.id})`, "ok");
          else {
            window.open(r.url ?? `/play/${g.id}/`, "_blank", "noopener");
            say(`▶ ${g.name} → fallback browser tab (no engine found)`, "ok");
          }
          break;
        }

        default:
          say(`unknown command "${verb}" — try help`, "err");
      }
    } catch (e) {
      say(`✘ ${errMsg(e)}`, "err");
      toast?.(errMsg(e), "err");
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const v = value;
      setValue("");
      void run(v);
    } else if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const next = Math.min(hIdx + 1, history.length - 1);
      setHIdx(next);
      setValue(history[next] ?? "");
    } else if (e.key === "ArrowDown") {
      if (hIdx <= 0) {
        setHIdx(-1);
        setValue("");
      } else {
        const next = hIdx - 1;
        setHIdx(next);
        setValue(history[next] ?? "");
      }
    }
  }

  return (
    <>
      <h2 className="sect">Console</h2>
      <p className="sub">Raw access to the launcher — the same commands, no mouse required.</p>
      <section className="console" onClick={() => inpRef.current?.focus()}>
        <div className="titlebar">
          <span>forge://console</span>
          <span className="t3">● ● ●</span>
        </div>
        <div className="out" ref={outRef}>
          {lines.map((l, i) => (
            <div key={`c${i}`} className={`ln${l.cls ? ` ${l.cls}` : ""}`}>
              {l.text}
            </div>
          ))}
          {logs.map((l, i) => (
            <div key={`s${i}`} className={`ln ${LOG_CLS[l.level] ?? ""}`}>
              {`[${l.level}] ${l.text}`}
            </div>
          ))}
        </div>
        <div className="prompt">
          <span className="pp">forge ❯</span>
          <input
            ref={inpRef}
            value={value}
            spellCheck={false}
            autoComplete="off"
            placeholder="help"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
          />
        </div>
      </section>
    </>
  );
}
