/**
 * Forge Launcher — eatable snack.ts · the snack slice (name kept exactly as
 * requested). The feed loop for the bedrock client: persistent hunger state
 * (localStorage), feed a treat from `treats.ts`, and the action helpers the
 * Bedrock tab's "Edible treats" panel binds to.
 */
import { TREATS, eat, canEat, treatById, listTreats, MAX_HUNGER, type Treat, type TreatCategory } from "./treats.ts";

export type SnackState = {
  hunger: number;
  saturation: number;
  lastFed: string | null;
};

const KEY = "forge.snack.state";
const EMPTY: SnackState = { hunger: 18, saturation: 5, lastFed: null };

/** Load the persisted hunger state (18/20 by default — the player is peckish). */
export function snackState(): SnackState {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) {
      const s = JSON.parse(raw) as SnackState;
      if (typeof s.hunger === "number") return { ...EMPTY, ...s, hunger: Math.min(MAX_HUNGER, Math.max(0, s.hunger)) };
    }
  } catch {
    /* private mode / bad json — fall through to the default */
  }
  return { ...EMPTY };
}

function persist(s: SnackState) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Feed a treat — throws when it's unknown, inedible, or the player is full. */
export function feedSnack(id: string): { state: SnackState; treat: Treat; gained: number } {
  const treat = treatById(id);
  if (!treat) throw new Error(`no such treat: ${id}`);
  const before = snackState();
  if (!canEat(before.hunger)) throw new Error(`already full — ${treat.name} can wait`);
  const res = eat(treat, before.hunger, before.saturation);
  const state: SnackState = { hunger: res.hunger, saturation: +res.saturation.toFixed(2), lastFed: new Date().toISOString() };
  persist(state);
  return { state, treat, gained: res.gained };
}

/** Reset hunger — for testing, or after a long AFK. */
export function restSnack(): SnackState {
  const state: SnackState = { hunger: MAX_HUNGER, saturation: 20, lastFed: new Date().toISOString() };
  persist(state);
  return state;
}

/** The snacks the player would actually eat, sliced by category. */
export const listSnacks = (category?: TreatCategory) => listTreats(category);

export const snacksAll = () => TREATS;

/** One-line summary for HUDs and toasts. */
export const snackSummary = (t: Treat, hunger: number) =>
  `${t.emoji} ${t.name} → ${Math.min(MAX_HUNGER, hunger + t.hunger)}/${MAX_HUNGER} hunger`;

/** Stateful action helpers — reload the view after every feed. */
export function snackActions(reload: () => void) {
  return {
    feed: (id: string) => {
      const r = feedSnack(id);
      reload();
      return r;
    },
    rest: () => {
      const s = restSnack();
      reload();
      return s;
    },
  };
}
