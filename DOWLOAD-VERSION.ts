/**
 * Forge Launcher — DOWLOAD-VERSION.ts · the download / version stack (client side).
 * Reads theLauncher's VERSION.json (via /api/version) and ships remote game
 * zips straight into the library through /api/download.
 */

export type DownloadEntry = { url: string; name?: string };
export type VersionManifest = {
  launcher?: { name?: string; version?: string; channel?: string };
  engine?: { minWasmGc?: number };
  vm?: { maxSlots?: number; bootTimeoutMs?: number };
  downloads?: DownloadEntry[];
};

export type DownloadResult = {
  ok: boolean;
  game?: { id: string; name: string; version: string; kind: string };
  file?: string;
  error?: string;
};

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split("/").filter(Boolean).pop() || "download.zip";
  } catch {
    return "download.zip";
  }
}

export function isValidDownloadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function suggestName(url: string): string {
  return fileNameFromUrl(url).replace(/\.zip$/i, "");
}

/** Fire a server-side download: fetch → library/.downloads → install. */
export async function downloadAndInstall(
  url: string,
  opts: { onLog?: (line: string) => void } = {},
): Promise<DownloadResult> {
  if (!isValidDownloadUrl(url)) throw new Error("that is not an http(s) url");
  opts.onLog?.(`dialing ${new URL(url).host} …`);
  const res = await fetch("/api/download", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const body = (await res.json().catch(() => ({}))) as { game?: DownloadResult["game"]; file?: string; error?: string };
  if (!res.ok) throw new Error(body.error || `download refused (${res.status})`);
  opts.onLog?.(`wired into the library → ${body.game?.name ?? body.game?.id}`);
  return { ok: true, game: body.game, file: body.file };
}
