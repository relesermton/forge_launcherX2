/**
 * Forge Launcher — 89.ts · the base89 codec.
 * 89 printable symbols (ASCII 33–121, minus the few that fight transport),
 * packed two digits per byte — dense, URL-safe-ish, and human-pasteable.
 * The codec Trampoline89_Toast.ts rides on.
 */

const ALPHA = Array.from({ length: 89 }, (_, i) => String.fromCharCode(33 + i)).join("");
// 89 symbols: '!' (33) through 'y' (121) — excludes z{|}~ and DEL.
const IDX: Record<string, number> = {};
for (let i = 0; i < ALPHA.length; i++) IDX[ALPHA[i]] = i;

export const B89_ALPHABET = ALPHA;

const enc = new TextEncoder();
const dec = new TextDecoder();

const toBytes = (input: string | Uint8Array | ArrayBuffer): Uint8Array =>
  input instanceof Uint8Array
    ? input
    : input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : enc.encode(String(input));

/** Two base89 digits per byte (hi/lo) — lossless, no length prefix. */
export function b89encode(input: string | Uint8Array): string {
  const bytes = toBytes(input);
  let out = "";
  for (const b of bytes) out += ALPHA[Math.floor(b / 89)] + ALPHA[b % 89];
  return out;
}

export function b89decode(payload: string): Uint8Array {
  const s = String(payload);
  if (s.length % 2 !== 0) throw new Error("b89: odd-length payload");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    const hi = IDX[s[2 * i]];
    const lo = IDX[s[2 * i + 1]];
    if (hi === undefined || lo === undefined) throw new Error(`b89: bad symbol at ${2 * i}`);
    out[i] = hi * 89 + lo;
  }
  return out;
}

export const b89decodeText = (payload: string): string => dec.decode(b89decode(payload));

/** Compactness check: chars per byte should sit at ~2.19. */
export const b89ratio = (input: string | Uint8Array): number => {
  const bytes = toBytes(input).length;
  return bytes === 0 ? 0 : b89encode(input).length / bytes;
};

export default { B89_ALPHABET, b89encode, b89decode, b89decodeText, b89ratio };
