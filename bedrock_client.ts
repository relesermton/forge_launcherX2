/**
 * Forge Launcher — bedrock_client.ts · Bedrock Edition support (client side).
 * The bedrock profile is Cinnabar — the independent Minecraft: Bedrock client
 * (Rust + Go, Bedrock 1.26.40 / protocol 2168). This module is the UI's window
 * into the server's bedrock mirror: status, res sync, and play helpers.
 * The server half lives in bedrock_server.ts.
 */

export const BEDROCK_REPO = "mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1";
export const BEDROCK_RES_LINK =
  "https://github.com/mc7-minecraft/Eaglercraft-bedrock-edition-26.1.1/tree/main/app/src/acceptance";

export type BedrockResInfo = {
  synced: boolean;
  files: number;
  updatedAt: string | null;
  bytes: number;
};

export type BedrockStatus = {
  profile: {
    name: string;
    edition: string;
    protocol: number;
    language: string;
    note: string;
  };
  resLink: string;
  res: BedrockResInfo;
  game: { id: string; name: string; kind: string } | null;
  playable: string;
};

/** Anything bedrock- or cinnabar-shaped in the library is the bedrock game. */
export function isBedrockGame(g: { id: string; name: string }): boolean {
  return /bedrock|cinnabar/i.test(`${g.id} ${g.name}`);
}

/** One-line profile note for HUDs and boot menus. */
export function bedrockNote(): string {
  return "Cinnabar · Bedrock 1.26.40 · protocol 2168";
}

/** Read the server's bedrock status (res mirror + installed game). */
export async function fetchBedrock(): Promise<BedrockStatus> {
  return (await fetch("/api/bedrock").then((r) => r.json())) as BedrockStatus;
}

/** Force a re-mirror of the pinned res tree (app/src/acceptance). */
export async function syncBedrockRes(): Promise<BedrockStatus> {
  const body = (await fetch("/api/bedrock/res", { method: "POST" }).then((r) => r.json())) as {
    status?: BedrockStatus;
    error?: string;
  };
  if (body.error) throw new Error(body.error);
  if (!body.status) throw new Error("bedrock res sync returned nothing");
  return body.status;
}
