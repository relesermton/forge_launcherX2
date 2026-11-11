/**
 * Forge Launcher — Bedrock_core.ts · the bedrock side's data core.
 * Framework-neutral brain behind BedrockTab.tsx: profile records, version
 * pins, res-mirror bookkeeping and the Edible-treats counters — all plain
 * state with typed accessors, so headless code (sim, tests, the VM) can
 * drive the same facts the tab renders.
 */

export type BedrockProfile = {
  name: string;
  lastVersion: string;
  protocol: number;
  resBytes: number;
  updatedAt: number;
};

export type BedrockVersion = {
  id: string; // "1.26.40"
  protocol: number; // 2168
  pinned: boolean;
  stable: boolean;
};

export type TreatCounter = {
  hunger: number; // 0..20
  eaten: number; // lifetime treats consumed
  lastTreat: string | null;
  at: number;
};

export const MAX_HUNGER = 20;

const PROFILE_KEY = "forge.bedrock.profile";
const VERSIONS_KEY = "forge.bedrock.versions";
const TREATS_KEY = "forge.bedrock.treats";

const safeGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode / quota — in-memory only */
  }
};

const DEFAULT_VERSIONS: BedrockVersion[] = [
  { id: "1.26.40", protocol: 2168, pinned: true, stable: true },
  { id: "1.26.30", protocol: 2167, pinned: false, stable: true },
  { id: "1.26.20", protocol: 2165, pinned: false, stable: true },
  { id: "1.25.10", protocol: 2160, pinned: false, stable: false },
];

export class BedrockCore {
  private profile: BedrockProfile;
  private versions: BedrockVersion[];
  private treats: TreatCounter;

  constructor() {
    this.profile = this.loadProfile();
    this.versions = this.loadVersions();
    this.treats = this.loadTreats();
  }

  /* ------------------------------ profile */

  private loadProfile(): BedrockProfile {
    try {
      const raw = safeGet(PROFILE_KEY);
      if (raw) return { name: "ForgeKing", protocol: 2168, resBytes: 0, updatedAt: 0, ...JSON.parse(raw) };
    } catch {
      /* fall through to default */
    }
    return { name: "ForgeKing", lastVersion: "1.26.40", protocol: 2168, resBytes: 0, updatedAt: Date.now() };
  }

  getProfile(): BedrockProfile {
    return { ...this.profile };
  }

  setProfile(patch: Partial<BedrockProfile>): BedrockProfile {
    this.profile = { ...this.profile, ...patch, updatedAt: Date.now() };
    safeSet(PROFILE_KEY, JSON.stringify(this.profile));
    return this.getProfile();
  }

  /* ------------------------------ versions */

  private loadVersions(): BedrockVersion[] {
    try {
      const raw = safeGet(VERSIONS_KEY);
      if (raw) {
        const list = JSON.parse(raw) as BedrockVersion[];
        if (Array.isArray(list) && list.length) return list;
      }
    } catch {
      /* fall through */
    }
    return DEFAULT_VERSIONS.map((v) => ({ ...v }));
  }

  listVersions(): BedrockVersion[] {
    return this.versions.map((v) => ({ ...v }));
  }

  /** The version the launcher boots into (pinned wins, else newest stable). */
  activeVersion(): BedrockVersion {
    return (
      this.versions.find((v) => v.pinned) ??
      this.versions.find((v) => v.stable) ??
      this.versions[0]
    );
  }

  setPinned(id: string): BedrockVersion | null {
    const target = this.versions.find((v) => v.id === id);
    if (!target) return null;
    for (const v of this.versions) v.pinned = v === target;
    safeSet(VERSIONS_KEY, JSON.stringify(this.versions));
    return { ...target };
  }

  /** Record which version actually launched (feeds the profile). */
  noteLaunch(id: string): BedrockProfile {
    const v = this.versions.find((x) => x.id === id);
    return this.setProfile({ lastVersion: id, protocol: v?.protocol ?? this.profile.protocol });
  }

  /* ------------------------------ res mirror */

  noteRes(totalBytes: number): BedrockProfile {
    return this.setProfile({ resBytes: totalBytes });
  }

  /* ------------------------------ treats (pairs with treats.ts / eatable snack.ts) */

  private loadTreats(): TreatCounter {
    try {
      const raw = safeGet(TREATS_KEY);
      if (raw) return { hunger: MAX_HUNGER, eaten: 0, lastTreat: null, at: 0, ...JSON.parse(raw) };
    } catch {
      /* fall through */
    }
    return { hunger: MAX_HUNGER, eaten: 0, lastTreat: null, at: Date.now() };
  }

  getTreats(): TreatCounter {
    return { ...this.treats };
  }

  /** Apply a feed: clamps to 0..20, counts it, persists. Returns the delta. */
  feed(name: string, hunger: number): { delta: number; counter: TreatCounter } {
    const room = MAX_HUNGER - this.treats.hunger;
    const delta = Math.max(0, Math.min(hunger, room));
    this.treats = {
      hunger: this.treats.hunger + delta,
      eaten: delta > 0 ? this.treats.eaten + 1 : this.treats.eaten,
      lastTreat: name,
      at: Date.now(),
    };
    safeSet(TREATS_KEY, JSON.stringify(this.treats));
    return { delta, counter: this.getTreats() };
  }

  /** Rest the hunger bar back to full (the "restSnack" path). */
  rest(): TreatCounter {
    this.treats = { ...this.treats, hunger: MAX_HUNGER, at: Date.now() };
    safeSet(TREATS_KEY, JSON.stringify(this.treats));
    return this.getTreats();
  }

  get isFull(): boolean {
    return this.treats.hunger >= MAX_HUNGER;
  }

  /* ------------------------------ summary (what a HUD would print) */

  summary() {
    const active = this.activeVersion();
    return {
      profile: this.profile.name,
      version: active.id,
      protocol: active.protocol,
      resBytes: this.profile.resBytes,
      hunger: `${this.treats.hunger}/${MAX_HUNGER}`,
      eaten: this.treats.eaten,
      full: this.isFull,
    };
  }
}

/** One shared core for the bedrock tab. */
export const bedrockCore = new BedrockCore();
export default BedrockCore;
