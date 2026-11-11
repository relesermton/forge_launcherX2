/**
 * Forge Launcher — Components.ts · shared UI bricks.
 * Panel / Row / Empty / SectionTitle / Field are props-style React components
 * (use them in JSX). Chip and Btn are tiny direct-call helpers (call them as
 * functions) — both styles live together happily. Plain .ts, so JSX-free:
 * bodies are createElement calls (same reason as FORGE-VM.ts).
 */
import { createElement, type ReactNode } from "react";
import { cls } from "./UI.ts";

/* ------------------------------ props-style components (JSX) */
export function Panel({ children, className }: { children?: ReactNode; className?: string }) {
  return createElement("div", { className: cls("panel", className) }, children);
}

export function Row({ children, className }: { children?: ReactNode; className?: string }) {
  return createElement("div", { className: cls("sys-row", className) }, children);
}

export function Empty({ children }: { children?: ReactNode }) {
  return createElement("p", { className: "sub" }, children);
}

export function SectionTitle({ children }: { children?: ReactNode }) {
  return createElement("h3", { className: "mini-title" }, children);
}

/** A labelled value line — the sys-row twin used across panels. */
export function Field({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return createElement(
    "div",
    { className: "sys-row" },
    createElement("span", { className: "sys-key" }, label),
    createElement("span", { className: "sys-val" }, children),
  );
}

/* ------------------------------ direct-call helpers */
export function Chip(text: ReactNode, tone?: "ok" | "ac" | "err" | "", key?: string) {
  return createElement("span", { className: cls("chip", tone || ""), key }, text);
}

export function Btn(
  label: ReactNode,
  onClick: () => void,
  opts: { small?: boolean; kind?: string; disabled?: boolean; title?: string; key?: string } = {},
) {
  return createElement(
    "button",
    {
      className: cls("btn", opts.small && "small", opts.kind),
      onClick,
      disabled: opts.disabled,
      title: opts.title,
      key: opts.key ?? String(label),
    },
    label,
  );
}
