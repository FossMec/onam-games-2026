/**
 * Obfuscate short messages into random-looking alphanumeric strings
 * so the message text is never in plain sight in the URL.
 */
const SALT = [0x5f, 0x3a, 0x8c, 0x12, 0x9e, 0x47, 0x6b, 0x2d, 0x71, 0xbb];

export function encodeGiftMessage(msg: string): string {
  const clean = msg.slice(0, 120);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(clean);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const mask = SALT[i % SALT.length] ^ ((i * 17 + 3) & 0xff);
    const val = bytes[i] ^ mask;
    hex += val.toString(16).padStart(2, "0");
  }
  return hex;
}

export function decodeGiftMessage(hexStr: string): string | null {
  if (!hexStr || hexStr.length % 2 !== 0) return null;
  try {
    const bytes = new Uint8Array(hexStr.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      const byteHex = hexStr.slice(i * 2, i * 2 + 2);
      const val = parseInt(byteHex, 16);
      if (isNaN(val)) return null;
      const mask = SALT[i % SALT.length] ^ ((i * 17 + 3) & 0xff);
      bytes[i] = val ^ mask;
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}
