# 🔥 Forge Launcher

A local-first game launcher. It lives in one folder, keeps your games in `library/`
next to it, and never phones home.

## The files

| file | role |
|---|---|
| `client.ts` | the browser client — typed API calls, the live SSE hook, world-save helpers, React bootstrap |
| `Server.ts` | the server — game library, accounts, server bookmarks, version manifest, zip downloads, JSON API, static hosting |
| `index.html` | the shell the client mounts into |
| `core.tsx` | the core UI — sign-in gate, top bar, boot-menu flow, Play/Server/World/Runtime/Load Game/Console |
| `CLI.tsx` | the in-app terminal — `help`, `list`, `install`, `launch`, `signin`, `server`, `worlds`, `version`, `download`, `gc`, `vm`, `boot`… |
| `css.css` | the forge theme (loaded **after** Tailwind so it wins) |
| `tw.css` | the Tailwind source — compiled to `tw.compiled.css` at build time, fully offline |
| `BOOTMENU.ts` | the boot menu — 1/2/3 pick boot target, countdown auto-boot, boot beep, clean-boot checkbox |
| `VM.ts` | the Forge-VM runtime — boot → running → suspend → resume → kill, one slot per game |
| `FORGE-VM.ts` | the in-app game view — HUD, boot journal, suspend/resume/reboot/kill controls (createElement, plain `.ts`) |
| `GC.ts` | the garbage-collector core — heap pressure, sweep bookkeeping, auto-collect policy |
| `GC.tsx` | the collector on screen — HUD gauge `GcMeter` + Runtime-tab panel `GcPanel` |
| `ENGINE-COMPILER.ts` | engine profiles — asks the server for the detected Chromium, checks the WASM-GC floor, compiles launch flags |
| `DOWLOAD-VERSION.ts` | the download/version stack (client side) — `/api/version` reader + remote-zip installer |
| `bedrock_client.ts` | Bedrock profile (client) — Cinnabar status, res sync, `isBedrockGame`, play helpers |
| `treats.ts` | the edible treats data layer — Minecraft-style food (hunger 0–20, saturation, stack) + `eat`/`canEat` math |
| `eatable snack.ts` | the snack slice — persistent hunger state (localStorage), `feedSnack`/`restSnack`, action helpers for the Bedrock tab |
| `bedrock_server.ts` | Bedrock module (server) — mirrors the pinned res tree into `library/.bedrock/res`, `/api/bedrock`, the `/bedrock/` deep link |
| `BedrockTab.tsx` | the **Bedrock** tab — Cinnabar profile, bedrock versions in the library, res mirror + sync, deep link |
| `addon.ts` | addons data layer — attach zips (`.zip` `.mcpack` `.mcaddon`) to the library, toggle/attach/remove |
| `mods.ts` | the mods slice — mod-flavoured API over the addon registry |
| `resorces pack.ts` | the resource-pack slice — packs, `packsForGame`, attach/detach |
| `Serve.tsx` | the **Serve** tab — attach by URL or from discovered Downloads, kind slices, per-game boot lists |
| `Components.ts` | shared createElement bricks — Chip / Panel / Row / Btn / Empty / SectionTitle / Field |
| `UI.ts` | shared pure helpers — `cls`, `fmtBytes`, `fmtUptime`, `timeAgo`, `toneFor`, `looksLikeZip` |
| `HUD.ts` | the floating game HUD over the VM frame — state, uptime, heap, bedrock badge |
| `RsCOMPILERcore.ts` | the Rust-subset compiler core — parses `*.rs` into an IR (fns/structs/enums/uses), emits JS stubs + TS declarations (`rustTypeToTs`) |
| `COMPILER.MJS` | the build orchestrator — runs the RS pipeline over the res mirror → `src/` `ts/` `database/db.json` `fs/vfs.json` `bedrock/compiled.json` (CLI: `bun COMPILER.MJS`; server: `POST /api/rscompile`) |
| `RScompilertoJsx.TSX` | Rust IR → JSX source emitter + `RsToJsxView` |
| `RsHandeler.Jsx` | `RsHandler` — hosts a compiled module (handler chips, shapes, emitted JSX/JS previews) + `buildHandlers` for the VM |
| `src/` | compiled JS stubs — one `<module>.js` per mirrored `.rs`, plus `index.js` barrel |
| `ts/` | TypeScript declarations — `<module>.d.ts` + `index.d.ts` |
| `database/` | `db.json` — the artifact index (full IR of every compiled module) |
| `fs/` | `vfs.json` — the workspace manifest the VM walks |
| `bedrock/` | the Cinnabar workspace — `profile.json`, `compiled.json` (compile summary) |
| `js/jsc.js` | the tiny JS compiler — wraps a source string in a `Function`, freezes its exports |
| `js/jsCore.mjs` | JS runtime core — module registry + event bus + tick loop |
| `js/X.js` `js/Y.js` `js/Z.js` | the axis modules — east/west, gravity/pitch, forward/depth |
| `js/Vm-handeler3D.js` | the 3D VM handler — player position/look/physics on the axes (`vm3d`) |
| `js/3D-handeler.js` | the scene handler — spawn/despawn, per-tick transforms, painter's-sorted views (`scene3d`) |
| `js/handeler-lib.mjs` | handler plumbing — `handle`/`dispatch`/`guard`, handler summaries |
| `js/lib.mjs` | the ESM umbrella — one import re-exports the whole js/ stack |
| `js/lib.js` | the script-tag build — everything on `window.ForgeLib` (registry/bus/tick, axes, 3D handlers, jsc) |
| `js/trampoline.js` | the trampoline facade — `pack`/`unpack` (guard → encode → checksum), `run` over the stack engine; registers `trampoline` into jsCore |
| `js/Trampoline-core.js` | the stack-safe engine — `bounce`/`trampoline` (deep recursion as a flat loop), `Bouncer` queue for per-tick draining |
| `js/trampolineBase94.js` | the base94 codec — 94 printable ASCII chars, two digits per byte, lossless payloads for tiny channels |
| `js/Base64.mjs` | hand-rolled base64 (ESM) — standard + URL-safe, no btoa/Buffer dependency |
| `js/Trampoline-threats.js` | payload threat checks — size/depth limits, prototype-pollution keys, dangerous patterns, FNV-1a `checksum` |
| `VERSION.json` | the launcher manifest — engine floor (`minWasmGc: 119`), VM config, known downloads, bedrock res link |

## The batch-45 modules

One line each, grouped by family. `.js`/`.mjs` live in `js/`, `.ts`/`.tsx`/`.html` at the root.

**3D foundation** — `js/MATHLIB.JS` (clamp/lerp, vec3, column-major mat4, seeded mulberry32 — the base every 3D module leans on) · `js/3D-OPENGL.MJS` (shader/program/buffer helpers + a depth-sorted `createDrawList` that degrades to a recorder headless) · `js/3D-XYZ-HENDELER.JS` (per-entity TRS transforms, `compose`/`nudge`, registers `xyzHandler`) · `js/X3DW-HANDLER.JS` (X3D-style scene graph — Transform/Shape/Group, world-matrix accumulation, `walk`, registers `x3dw`) · `js/XYZ-Handeler32stack.js` (Float32Array vec3 stack machine — push/pop/add/cross, zero object churn, `xyz32stack`) · `js/XYZT.JS` (space+time 4-vector — velocity integration, trail, time scaling, `xyzt`) · `js/UNICODE-3D.JS` (text → 3D point clouds with a stroke font, grapheme-safe, `unicode3d`)

**Runtimes & stacks** — `js/RUNTIMEX20.JS` (fixed-timestep runtime, 20 sub-ticks per 60 fps frame, `runtimeX20`) · `js/x20.js` (the ×20 core — `steps20`, 20-frame sequencer) · `js/stack64.js` (BigInt64Array stack — wraparound arithmetic, `rotl`, hex push, `stack64`) · `Stack_64.ts` (the typed twin — `Stack64` class with hex dump view) · `js/Node(notanapp).js` (a DOM-flavoured node tree — parent/child, walk/find, JSON round-trip; **not** Node.js) · `js/sim.js` (deterministic fixed-step sim over the node tree — systems, pause/speed, path-stable `serialize`) · `js/sci-lib.js` (SI suffixes, `parseSci`, relative-tolerance `approxEq`, small-sample stats)

**Unicode & codecs** — `js/Unicode.Js` (graphemes, NFC/NFD, `\u` escape/unescape, UTF-8 length, case-fold) · `js/baseCC.js` (char-code codec — one byte per char for in-memory channels) · `js/Bs4.js` (base64 through a shuffled alphabet) · `js/Bss.js` (BSS v1 — streaming 6-bit base64, no padding) · `js/Bss2.js` (v2 — URL-safe alphabet) · `js/Bss4.js` (v4 — 4-bit hex, exactly 2 symbols/byte) · `js/Bss5.js` (v5 — Crockford base32, case-insensitive) · `js/Bss6.js` (v6 — 4 KB frames with FNV-1a tags, corruption caught on decode) · `BSS18.ts` (v18 — true base-18 big-number packing with a length prefix) · `js/HandelerBase64.js` (base64 as jsCore handlers — `b64.encode`/`b64.decode`/`b64.roundtrip`) · `Handler94.ts` (typed base94 handler registry over `js/trampolineBase94.js` — `dispatch94`) · `89.ts` (base89 codec — 89 printable symbols, 2 digits/byte) · `Trampoline89_Toast.ts` (the base89 trampoline: real tail-call bounce loop, per-hop toast lines, `verify` + density readout)

**Hash & sine** — `hashlib.ts` (fnv1a 32/64, crc32, djb2, `hashBundle`, `shortId`) · `SinLib64.ts` (Q32.32 BigInt fixed-point sin/cos/tan — Taylor + range reduction, exact-width for the VM) · `SinlibIndex.ts` (precomputed 4096-entry sine table with linear interpolation — the fast path) · `hashlib(mathSinlib_in_simulation).ts` (sin-fraction hashing — `sinHash32/64/Hex`, BigInt variant over SinLib64, avalanche test) · `haslibEstimated.ts` (probabilistic hashing — linear-counting `Cardinality`, `Bloom`, collision estimates)

**Links, toasts, cookies, ops** — `js/dynimaic_Link.mjs` (the launcher's own URL builder — `ROUTES.play/bedrock/settings/api`, `withParams`, `parseLink`) · `js/dynamic_Toast.js` (framework-free toast queue — tones, auto-dismiss, `createToaster`) · `js/Cookie.js` (document.cookie parse/serialize with a localStorage fallback for the VM) · `js/+-+_.js` — **the requested `+-+/\.js` couldn't exist on NTFS** (`/` and `\` are path separators), so it's stored as the closest legal name; it's the operator table (`+ − × ÷ \ ^` with precedence, vector-aware `apply`, `evalExpr`)

**App, tab-snap, settings, vault** — `App.ts` (the framework-neutral app core — view registry, lifecycle, event bus; React's `core.tsx` is its face) · `SLIM.ts` (async toolkit — `sleep`, `retry` backoff, `debounce`/`throttle`, `pLimit`, `onceGate`) · `TabSnapcore.ts` (snapshot registry — capture/restore/list/bytes) · `TabSnapCore+.ts` (structural `diffStates`, patch-apply, Bss2 wire format) · `TabsnapCore++.ts` (history ring with undo/redo, pinning, bounded trim, localStorage persistence, restorer callbacks) · `Tabsnap.tsx` (the UI — capture, browse, restore/pin/diff/delete, stats chips) · `Bedrock_core.ts` (bedrock data core behind `BedrockTab.tsx` — profiles, version pins, res bookkeeping, treat counters) · `setiings.html` (standalone settings page — ember theme, toggles/sliders/selects, autosave to `forge.setiings`, export/reset; served by the root-`*.html` route) · `Paswords94.Tsx` (the base94 password vault — encode at rest via `js/trampolineBase94.js`, reveal/copy/lock; flagged in-UI as obfuscation, not encryption)

## The tabs

| tab | what it does |
|---|---|
| **Play** | featured hero with the big **PLAY** button + the shelf of games |
| **Server** | bookmark multiplayer `ws://` / `wss://` addresses, one-click Join |
| **World** | the game's world saves live in this app's storage — list, delete, erase |
| **Runtime** | the machine room — GC panel + controls, engine verdict (WASM-GC floor), remote-zip downloader, version editor, RS Compiler panel |
| **Bedrock** | Cinnabar profile + bedrock versions — install/play bedrock builds, res mirror + sync, `/bedrock/` deep link, edible treats panel (feed snacks, persistent hunger) |
| **Serve** | addons, mods & resource packs — attach zips, toggle, attach per game |
| **Load Game** | install from a `.zip` (**requires an `index.html` or `.exe` inside**) |
| **Console** | the raw CLI — now with `version`, `download`, `gc`, `vm`, `boot` |

**Sign in / Log out** is in the top-right: local profiles only — nothing is uploaded,
and the session survives launcher restarts.

Plus:

- `library/` — installed games live here, `registry.json` tracks them
- `dist/` — the compiled web client (generated by `bun run build`)
- `ForgeLauncher.exe` — the compiled standalone server (`bun build --compile`)
- `runtime/bun.exe` — Bun 1.4.4, vendored so nothing else needs installing

## Run it

```
start.bat          ← double-click or run this; opens http://127.0.0.1:4242
```

dev mode: `runtime\bun.exe Server.ts`

## Build it (compiles both halves)

```
build.bat
  1) bun run build      → bundles client.ts + core.tsx + CLI.tsx + react into dist/
  2) bun run compile    → bakes Server.ts into a standalone ForgeLauncher.exe
```

## Install a game

**Load Game** tab: Forge auto-scans `Downloads`, `Desktop` and `C:\forge` for `.zip`
builds, or paste any path (**requires a zip with an `index.html` or an `.exe` inside**).
You can also drop a direct URL into the **Runtime** tab's downloader — the server
fetches it into `library/.downloads`, unpacks, unzip/dedetects and shelves it, then
throws the temp zip away. Bad URLs die clean ("the url must point straight at a .zip").

**One-click Eaglercraft server**: the official `cdn.eaglercraft.net` catalog ships
inside `VERSION.json` — 26.2 (WASM-GC), 1.8.8/1.12.2 (WASM-GC + JS) and classic 1.5.2
appear as chips in the Runtime downloader; click one and the server fetches, unpacks
and shelves it. No manual step.

**Change your version**: the Runtime tab's "edit version" row (and `version set
<semver> [channel]` in the Console) rewrites `VERSION.json` live — launcher name,
version, channel, the WASM-GC engine floor, VM slot count and boot timeout.

## Bedrock Edition · Cinnabar

Forge tracks **Cinnabar** — the independent, unofficial Minecraft: Bedrock client
(Rust + Bevy render, Go net core, Bedrock 1.26.40 / protocol 2168) at
`mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1`. The **Bedrock tab** shows
the profile, every bedrock build in the library, and mirrors the pinned res
tree (`app/src/acceptance` — the Rust acceptance harness) into
`library/.bedrock/res`, served at `/bedrock/res/…`. `/bedrock/` redirects to
the installed bedrock game (boot menu + Forge-VM, like any other), or shows a
landing page with the profile and install pointers. Console: `bedrock`
(status) · `bedrock res` (force mirror). Playing: install any
Cinnabar/bedrock build (web zip → PLAY in-app; native `bedrock-client.exe`
→ PLAY spawns it detached).

## RS Compiler · Cinnabar res → src/ ts/ database/

The pinned acceptance res is real Rust — `RsCOMPILERcore.ts` parses each
mirrored `.rs` into an IR (fns, structs, enums, uses), then emits JS stubs and
TS declarations. `COMPILER.MJS` orchestrates the whole pipeline:

```
library/.bedrock/res/*.rs
  → RsCOMPILERcore (IR)
  → src/<module>.js  ·  ts/<module>.d.ts
  → database/db.json (artifact index)  ·  fs/vfs.json (workspace manifest)
  → bedrock/compiled.json (summary)
```

Run it from the **Runtime tab** (⚙ Compile res → workspace), with
`runtime\bun.exe COMPILER.MJS`, or `POST /api/rscompile`. The output is served
read-only at `/src/…`, `/ts/…`, `/database/db.json`, `/fs/…`,
`/bedrock/compiled.json`. `RsHandeler.Jsx` hosts a compiled module in the UI
(handler chips, shapes, emitted JSX/JS), and `RScompilertoJsx.TSX` turns an IR
into JSX component source. The `js/` runtime stack hosts it in the VM:
`js/lib.mjs` (ESM umbrella) / `js/lib.js` (`window.ForgeLib`) over `jsCore`
(registry + bus + tick), the handler plumbing (`handeler-lib.mjs`, `jsc.js`),
the 3D handlers (`Vm-handeler3D.js` player, `3D-handeler.js` scene) and the
axis math (`X.js` east/west · `Y.js` gravity/pitch · `Z.js` forward/depth).

## Serve · addons, mods, resource packs

Attach Minecraft-style packs as zips: `.zip`, `.mcpack`, `.mcaddon` — by URL or
straight from the discovered Downloads/Desktop zips. Three kinds live in
`library/.addons/registry.json`: **mods**, **behavior addons**, **resource
packs**. Toggle on/off, attach packs to games (`packsForGame` decides what
boots with a title), remove at will. The API: `/api/addons`, `/api/addons/
install|toggle|remove|attach`.

It unarchives, unwraps nested zips, cleans macOS junk, and detects the entry point:

- **native (`.exe`)** — spawned directly (no PowerShell, no shells), detached; Quit stops it
- **web (`index.html`)** — served at `/play/<id>/` … and read on:

## What happens when you hit PLAY on a web game

The **Forge Boot Menu** opens (with a boot beep) — three ways in:

| key | target |
|---|---|
| **1** | **Forge-VM — boot in-app** (default, auto-boots after the 3-2-1 countdown) |
| **2** | App window — a real Edge/Chromium window kept behind the launcher |
| **3** | Browser tab — the classic way |

Option 1 boots the game **inside the launcher** in an embedded same-origin frame:
FORGE-VM HUD on top (slot #, uptime, live GC gauge), the boot journal underneath,
and Fullscreen / Suspend / Reboot / Kill VM / App window / Leave controls.
Switching to another tab auto-**suspends** the VM (frame detached, saves kept,
heap reclaimed — watch the GC panel drop); clicking **Play** again resumes it.
Optional **clean boot** wipes the game's storage before booting.

Engine rules stand: no HTA host, no html2exe-style handler pages — packers can't
run WASM-GC builds, raw Chromium (Edge v157 detected on this machine) can.
