/**
 * Forge Launcher — BOOTMENU.ts · the boot menu.
 * Hitting PLAY on a web game opens this: pick where it boots. Number keys,
 * arrow keys, a countdown that auto-boots the Forge-VM — the game boots
 * INSIDE the app by default, never spilling out into a browser tab.
 */
import { createElement, useEffect, useRef, useState } from "react";
import type { Game } from "./client.ts";
import { isBedrockGame, bedrockNote } from "./bedrock_client.ts";

export type BootMode = "vm" | "window" | "browser";
type Entry = { key: string; mode: BootMode; title: string; desc: string };

const OPTIONS: Entry[] = [
  { key: "1", mode: "vm", title: "Forge-VM — boot in-app", desc: "embedded engine, WASM-GC inside this window (default)" },
  { key: "2", mode: "window", title: "App window — external engine", desc: "own Edge/Chromium window, launcher keeps running behind it" },
  { key: "3", mode: "browser", title: "Browser tab", desc: "the classic way — whatever browser you use" },
];

const bootComputer = () => {
  try {
    const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "square";
    o.frequency.value = 392;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.015, ac.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.28);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.3);
  } catch {
    /* audio blocked — pure silence boot */
  }
};

export function BootMenu({
  game,
  onBoot,
  onCancel,
  countdown = 3,
}: {
  game: Game;
  onBoot: (mode: BootMode, clean: boolean) => void;
  onCancel: () => void;
  countdown?: number;
}) {
  const [sel, setSel] = useState(0);
  const [left, setLeft] = useState(countdown);
  const [clean, setClean] = useState(false);
  const fired = useRef(false);

  const fire = (mode: BootMode) => {
    if (fired.current) return;
    fired.current = true;
    onBoot(mode, clean);
  };

  useEffect(() => bootComputer(), []);
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) fire("vm");
  }, [left]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") fire(OPTIONS[sel].mode);
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => (s + (e.key === "ArrowDown" ? 1 : OPTIONS.length - 1)) % OPTIONS.length);
      } else {
        const n = Number(e.key);
        if (n >= 1 && n <= OPTIONS.length) fire(OPTIONS[n - 1].mode);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, clean]);

  const rows = OPTIONS.map((o, i) =>
    createElement(
      "button",
      {
        key: o.mode,
        className: `boot-item${i === sel ? " on" : ""}`,
        onClick: () => fire(o.mode),
        onMouseEnter: () => setSel(i),
      },
      createElement("span", { className: "boot-key" }, o.key),
      createElement("span", { className: "boot-tit" }, o.title),
      createElement("span", { className: "boot-desc" }, o.desc),
    ),
  );

  return createElement(
    "div",
    { className: "boot-overlay", onClick: onCancel },
    createElement(
      "div",
      { className: "boot-panel", onClick: (e: React.MouseEvent) => e.stopPropagation() },
      createElement("div", { className: "boot-head" },
        createElement("span", { className: "boot-brand" }, "FORGE BOOT MENU"),
        createElement("span", { className: "boot-ver" }, "bios v1.1.0 · web game" + (isBedrockGame(game) ? ` · ${bedrockNote()}` : "")),
        createElement("span", { className: "boot-count" }, left > 0 ? `auto-boot → Forge-VM in ${left}` : "booting…"),
      ),
      createElement("div", { className: "boot-title" }, game.name),
      rows,
      createElement(
        "label",
        { className: "boot-clean" },
        createElement("input", { type: "checkbox", checked: clean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setClean(e.target.checked) }),
        "clean boot — wipe game data before booting",
      ),
      createElement("div", { className: "boot-foot" }, "↑/↓ select · Enter boot · 1/2/3 direct · ESC abort"),
    ),
  );
}
