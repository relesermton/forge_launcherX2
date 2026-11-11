/**
 * Forge Launcher — BedrockTab.tsx · the Bedrock tab.
 * Cinnabar profile, the bedrock versions in the library (installed bedrock
 * builds), the acceptance res mirror and the /bedrock/ deep link — everything
 * bedrock in one home.
 */
import { useCallback, useEffect, useState } from "react";
import type { Game } from "./client.ts";
import { fetchBedrock, syncBedrockRes, isBedrockGame, bedrockNote, type BedrockStatus } from "./bedrock_client.ts";
import { listSnacks, feedSnack, restSnack, snackState, type SnackState } from "./eatable snack.ts";
import { canEat, MAX_HUNGER, type Treat } from "./treats.ts";
import { Chip } from "./Components.ts";
import { errMsg, fmtBytes, timeAgo } from "./UI.ts";

/**
 * webfetched from eaglercraft-bedrock (Cinnabar) — handed to the snack panel:
 * where treats actually live in the bedrock client (the held hotbar slot).
 */
const EAGLER_SNACK_SRC = {
  repo: "mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1",
  file: "app/src/hotbar.rs",
  url: "https://github.com/mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1/blob/main/app/src/hotbar.rs",
  note: "Local hotbar slot selection — number keys, mouse wheel and controller cycle change the held slot immediately (predicted locally so the HUD highlight follows input), announced upstream with a PlayerHotbar packet.",
  slots: 9,
  phase: "Phase 0 pinned to Bedrock 1.26.40 · protocol 2168",
};

export function BedrockTab({
  toast,
  games,
  play,
}: {
  toast: (t: string, k?: "info" | "good" | "err") => void;
  games: Game[];
  play: (g: Game, serverAddr?: string) => void;
}) {
  const [bed, setBed] = useState<BedrockStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [snack, setSnack] = useState<SnackState>(() => snackState());

  const reload = useCallback(() => {
    fetchBedrock().then(setBed).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(reload, []);

  const versions = games.filter((g) => isBedrockGame(g));
  const profile = bed?.profile;

  const feed = (t: Treat) => {
    try {
      const r = feedSnack(t.id);
      setSnack(r.state);
      toast(`${t.emoji} ${t.name} — +${r.gained} hunger → ${r.state.hunger}/${MAX_HUNGER}`, "good");
    } catch (e) {
      toast(errMsg(e), "err");
    }
  };

  const rest = () => {
    setSnack(restSnack());
    toast("fed to the brim — 20/20 hunger", "good");
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const st = await syncBedrockRes();
      setBed(st);
      toast(`bedrock res mirrored — ${st.res.files} files from the Cinnabar acceptance tree`, "good");
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <h2 className="sect">Bedrock</h2>
      <p className="sub">
        Minecraft: Bedrock Edition — the Cinnabar profile, your bedrock builds, and the mirrored acceptance res.
      </p>

      <h3 className="mini-title">Profile · Cinnabar</h3>
      <div className="panel">
        <div className="sys-row">
          <span className="sys-key">edition</span>
          <span className="sys-val">
            <b>{profile?.name ?? "Cinnabar"}</b> · {profile?.edition ?? "Minecraft: Bedrock Edition 1.26.40"}
            {Chip(`protocol ${profile?.protocol ?? 2168}`, "ok")}
          </span>
        </div>
        <div className="sys-row">
          <span className="sys-key">stack</span>
          <span className="sys-val">{profile?.language ?? "Rust (Bevy render) + Go (net core)"}</span>
        </div>
        <div className="sys-row">
          <span className="sys-key">res link</span>
          <span className="sys-val">
            <a href={bed?.resLink ?? "https://github.com/mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1/tree/main/app/src/acceptance"} target="_blank" rel="noreferrer">
              github/{(bed?.resLink ?? "").split("github.com/")[1] || "mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1/…"}
            </a>
            {Chip(bed?.res?.synced ? `${bed.res.files} files mirrored` : "not mirrored yet", bed?.res?.synced ? "ok" : "err")}
            {bed?.res?.synced && bed.res.bytes > 0 && <span className="chip">{fmtBytes(bed.res.bytes)}</span>}
          </span>
        </div>
        <div className="sys-row btns">
          <button className="btn small" disabled={syncing} onClick={() => void sync()}>
            {syncing ? "Mirroring…" : "⟳ Sync bedrock res"}
          </button>
          <a className="btn small ghost" href="/bedrock/" target="_blank" rel="noreferrer">
            ↗ /bedrock/ deep link
          </a>
          <a className="btn small ghost" href="/bedrock/res/mod.rs" target="_blank" rel="noreferrer">
            ↗ acceptance res · mod.rs
          </a>
        </div>
        <p className="note">{bedrockNote()}</p>
      </div>

      <h3 className="mini-title">Versions · bedrock builds in the library</h3>
      <div className="panel">
        {versions.length === 0 ? (
          <p className="sub">
            no bedrock build installed — drop a Cinnabar/bedrock zip into <b>Downloads</b> and open <b>Load Game</b> (it's
            auto-discovered), or build Cinnabar natively (<code>cargo build --release -p bedrock-client</code>) and install
            the exe. web zips boot in-app through Forge-VM; native exes spawn detached.
          </p>
        ) : (
          versions.map((g) => (
            <div className="sys-row" key={`bv-${g.id}`}>
              <span className="sys-key">{g.kind}</span>
              <span className="sys-val">
                <b>{g.name}</b>
                <span className="chip">v{g.version}</span>
                <span className="chip">{fmtBytes(g.sizeBytes)}</span>
                <span className="chip">{g.entry}</span>
                {g.lastLaunched && <span className="chip">{timeAgo(g.lastLaunched)}</span>}
              </span>
              <span className="pack-actions">
                <button className="btn small" onClick={() => play(g)}>
                  ▶ Play
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <h3 className="mini-title">Edible treats · snacks for the bedrock client</h3>
      <div className="panel">
        <div className="sys-row">
          <span className="sys-key">source</span>
          <span className="sys-val">
            <a href={EAGLER_SNACK_SRC.url} target="_blank" rel="noreferrer">
              eaglercraft-bedrock · {EAGLER_SNACK_SRC.file}
            </a>
            {Chip(`${EAGLER_SNACK_SRC.slots} hotbar slots`, "ok")}
            {Chip("held-slot predicted client-side", "")}
            {Chip(EAGLER_SNACK_SRC.phase, "")}
          </span>
        </div>
        <div className="sys-row">
          <span className="sys-key">how it rides</span>
          <span className="sys-val">{EAGLER_SNACK_SRC.note} — a treat rides the held slot like any item.</span>
        </div>
        <div className="sys-row">
          <span className="sys-key">hunger</span>
          <span className="sys-val">
            <span className="hunger-bar">
              <span className="hunger-fill" style={{ width: `${(snack.hunger / MAX_HUNGER) * 100}%` }} />
            </span>
            <b>
              {snack.hunger}/{MAX_HUNGER}
            </b>
            {Chip(`${snack.saturation} sat`, "ac")}
            {snack.lastFed && <span className="chip">fed {timeAgo(snack.lastFed)}</span>}
            {!canEat(snack.hunger) && Chip("full 🥴", "ok")}
          </span>
        </div>
        {listSnacks().map((t) => (
          <div className="sys-row" key={`treat-${t.id}`}>
            <span className="sys-key">
              {t.emoji} {t.name}
            </span>
            <span className="sys-val">
              <span className="chip">+{t.hunger} hunger</span>
              <span className="chip">{t.saturation} sat</span>
              <span className="chip">stack {t.stack}</span>
              <span className="chip">{t.category}</span>
              {t.note && <span className="chip">{t.note}</span>}
            </span>
            <span className="pack-actions">
              <button className="btn small" disabled={!canEat(snack.hunger)} onClick={() => feed(t)}>
                🍽 Eat
              </button>
            </span>
          </div>
        ))}
        <div className="sys-row btns">
          <button className="btn small ghost" onClick={rest}>
            🍗 Rest (full hunger)
          </button>
          <span className="chip">state persists in localStorage · treats.ts + eatable snack.ts</span>
        </div>
      </div>

      <h3 className="mini-title">Acceptance res · library/.bedrock/res</h3>
      <div className="panel">
        <div className="sys-row">
          <span className="sys-key">mirror</span>
          <span className="sys-val">
            {bed?.res?.synced
              ? `flat mirror of app/src/acceptance — ${bed.res.files} files, served at /bedrock/res/<name>.rs`
              : "not mirrored yet — press Sync to pull the pinned acceptance tree"}
            {bed?.res?.updatedAt && <span className="chip">{timeAgo(bed.res.updatedAt)}</span>}
          </span>
        </div>
        <div className="sys-row">
          <span className="sys-key">compile</span>
          <span className="sys-val">
            <code>RsCOMPILERcore</code> turns each .rs into src/ + ts/ + database/db.json — run it from the Runtime tab
            (<b>⚙ Compile res → workspace</b>) or <code>POST /api/rscompile</code>. The <code>js/</code> stack
            (<code>lib.mjs</code> · handlers · X/Y/Z) hosts it in the VM.
          </span>
        </div>
      </div>
    </div>
  );
}
