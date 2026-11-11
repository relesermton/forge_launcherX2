/**
 * Forge Launcher — BSS18.ts · the BSS codec, v18 (arbitrary base).
 * The odd-one-out of the Bss family: an 18-symbol alphabet packed through
 * true base conversion (big-number divide-by-18), with a 1-byte length
 * prefix so leading zero bytes survive. When you need base18, you need
 * base18.
 */

const ALPHA = "0123456789ABCDEFGH"; // 18 symbols, Crockford-flavored
if (ALPHA.length !== 18) throw new Error("BSS18: alphabet must be 18 symbols");
const IDX: Record<string, number> = {};
for (let i = 0; i < ALPHA.length; i++) IDX[ALPHA[i]] = i;

const BASE = 18n;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toBytes = (input: string | Uint8Array): Uint8Array =>
  input instanceof Uint8Array ? input : enc.encode(String(input));

/** bytes → length-prefix + base18 digits (two hex digits = one symbol pair). */
export function bss18Encode(input: string | Uint8Array): string {
  const bytes = toBytes(input);
  if (bytes.length > 255) throw new Error("BSS18: payload longer than 255 bytes");
  // interpret bytes as a big number (base 256)
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let digits = "";
  while (n > 0n) {
    digits += ALPHA[Number(n % BASE)];
    n /= BASE;
  }
  digits = digits.split("").reverse().join("");
  return ALPHA[bytes.length] + digits; // first symbol encodes the byte length
}

export function bss18Decode(payload: string): Uint8Array {
  const s = String(payload);
  if (!s.length) return new Uint8Array(0);
  const lenSym = IDX[s[0]];
  if (lenSym === undefined) throw new Error("BSS18: bad length symbol");
  let n = 0n;
  for (let i = 1; i < s.length; i++) {
    const v = IDX[s[i]];
    if (v === undefined) throw new Error(`BSS18: bad symbol at ${i}`);
    n = n * BASE + BigInt(v);
  }
  const out = new Uint8Array(lenSym);
  for (let i = lenSym - 1; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  if (n !== 0n) throw new Error("BSS18: payload longer than declared");
  return out;
}

export const bss18DecodeText = (payload: string): string => dec.decode(bss18Decode(payload));

/** Density: base18 is ~2.56 chars/byte — the honest number for the HUD. */
export const bss18ratio = (input: string | Uint8Array): number => {
  const bytes = toBytes(input).length;
  return bytes === 0 ? 0 : bss18encodeLength(bytes) / bytes;
};
const bss18encodeLength = (byteLen: number) => 1 + Math.ceil((byteLen * 8) / Math.log2(18));

export default { bss18Encode, bss18Decode, bss18DecodeText, bss18ratio, ALPHA };
