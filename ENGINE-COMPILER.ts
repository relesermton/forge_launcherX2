/**
 * Forge Launcher — ENGINE-COMPILER.ts · engine profiles.
 * Asks the server which Chromium engine owns this machine, checks the
 * WASM-GC floor from VERSION.json, and compiles the launch profile
 * (the flags the engine gets when a game boots outside the launcher).
 */

export type EngineInfo = { path: string | null; version: string; wasmGc: boolean };
export type EngineProfile = {
  engine: EngineInfo;
  flags: string[];
  embedUrl: (gameId: string) => string;
  windowUrl: (gameId: string) => string;
  verdict: "embed" | "window" | "degraded";
};

export type VersionResponse = {
  launcher: { name: string; version: string; channel: string };
  engine: EngineInfo;
  manifest: {
    launcher?: { name?: string; version?: string; channel?: string };
    engine?: { minWasmGc?: number };
    vm?: { maxSlots?: number; bootTimeoutMs?: number };
    downloads?: Array<{ name?: string; url: string }>;
  };
};

export async function fetchEngineProfile(): Promise<EngineProfile> {
  const v = (await fetch("/api/version").then((r) => r.json())) as VersionResponse;
  const min = v.manifest?.engine?.minWasmGc ?? 119;
  const major = Number(String(v.engine?.version || "").split(".")[0]) || 0;
  const wasmGc = v.engine?.wasmGc ?? major >= min;
  const verdict: EngineProfile["verdict"] =
    v.engine?.path && wasmGc ? "embed" : v.engine?.path ? "degraded" : "window";
  return {
    engine: { ...v.engine, wasmGc },
    flags: ["--new-window"],
    embedUrl: (gameId) => `/play/${gameId}/`,
    windowUrl: (gameId) => `${location.origin}/play/${gameId}/`,
    verdict,
  };
}

export function verdictText(p: EngineProfile): string {
  if (p.verdict === "embed") return `embedded ready — ${p.engine.version} supports WASM-GC ✔`;
  if (p.verdict === "degraded") return `${p.engine.version} is below the WASM-GC floor — expect weirdness`;
  return "no engine found — downloads still work; game boots fall back";
}

export function engineFlagsForAppWindow(url: string): string[] {
  return [`--app=${url}`, "--new-window"];
}
