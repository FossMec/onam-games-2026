import { createHash } from "node:crypto";
import defaultHashesData from "./profanity-hashes.json";
import { getServerEnv } from "~/server/env";

/**
 * Server-side moderation and profanity filter.
 *
 * Safe for open-source: Uses precomputed cryptographic SHA-256 hashes committed in git
 * (`profanity-hashes.json`) so zero vulgarity or plaintext wordlists appear in git history.
 * Optionally supplements with `PROFANITY_DICTIONARY_JSON` env variable.
 */

interface ProfanityConfig {
  whitelist: Set<string>;
  blockedHashes: Set<string>;
  blockedWords: string[];
}

let cachedConfig: ProfanityConfig | null = null;

function sha256(str: string): string {
  return createHash("sha256").update(str).digest("hex");
}

function loadConfig(): ProfanityConfig {
  if (cachedConfig) return cachedConfig;

  const whitelist = new Set<string>(
    (defaultHashesData?.whitelist || []).map((w: string) => w.toLowerCase().trim()),
  );
  const blockedHashes = new Set<string>(defaultHashesData?.hashes || []);
  const blockedWords: string[] = [];

  // Try loading additional words/hashes from environment variable (optional)
  const profanityEnv = getServerEnv("PROFANITY_DICTIONARY_JSON");
  if (profanityEnv) {
    try {
      const parsed = JSON.parse(profanityEnv);
      if (Array.isArray(parsed?.blocked)) {
        for (const w of parsed.blocked) {
          if (typeof w === "string") {
            blockedWords.push(w.toLowerCase().trim());
            blockedHashes.add(sha256(w.toLowerCase().trim()));
            blockedHashes.add(sha256(normalizeWord(w)));
          }
        }
      }
      if (Array.isArray(parsed?.whitelist)) {
        for (const w of parsed.whitelist) {
          if (typeof w === "string") whitelist.add(w.toLowerCase().trim());
        }
      }
    } catch {
      /* ignore env parse error */
    }
  }

  cachedConfig = { whitelist, blockedHashes, blockedWords };
  return cachedConfig;
}

/**
 * Normalizes repeated characters like "myyyyyrrrreee" -> "myre", "f***k" -> "fk"
 */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[._\-*~#@!]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if a token matches any blocked word in the active dictionary
 */
function isProfaneToken(
  token: string,
  blockedHashes: Set<string>,
  blockedWords: string[],
  whitelistSet: Set<string>,
): boolean {
  const lower = token.toLowerCase().trim();
  if (lower.length < 2) return false;
  if (whitelistSet.has(lower)) return false;

  // 1. Direct cryptographic SHA-256 hash match
  const lowerHash = sha256(lower);
  if (blockedHashes.has(lowerHash)) return true;

  // 2. Normalized hash match (handles "fuuuuck", "f*u*c*k", etc.)
  const normalized = normalizeWord(lower);
  if (whitelistSet.has(normalized)) return false;
  const normHash = sha256(normalized);
  if (blockedHashes.has(normHash)) return true;

  // 3. Match against dynamic words (if loaded via env or config)
  for (const bad of blockedWords) {
    const normBad = normalizeWord(bad);

    // Equality
    if (lower === bad || normalized === normBad) return true;

    // Substring match for longer words
    if (bad.length >= 4 && (lower.includes(bad) || normalized.includes(normBad))) {
      return true;
    }

    // Fuzzy distance <= 1
    if (bad.length >= 5 && Math.abs(normalized.length - normBad.length) <= 1) {
      if (levenshtein(normalized, normBad) <= 1) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Censors profanities in text on the server using the precomputed hash dictionary.
 */
export function censorMessageServer(text: string): { clean: string; hadProfanity: boolean } {
  if (!text) return { clean: "", hadProfanity: false };

  const { whitelist, blockedHashes, blockedWords } = loadConfig();
  if (blockedHashes.size === 0 && blockedWords.length === 0) {
    return { clean: text.trim(), hadProfanity: false };
  }

  let clean = text.trim();
  let hadProfanity = false;

  // 1. Direct substring matching for non-latin words (if present in blockedWords)
  for (const bad of blockedWords) {
    if (bad.charCodeAt(0) > 0x0d00 && bad.charCodeAt(0) < 0x0d7f) {
      if (clean.includes(bad)) {
        hadProfanity = true;
        const mask = "*".repeat(bad.length);
        clean = clean.split(bad).join(mask);
      }
    }
  }

  // 2. Tokenized word boundaries for latin/Manglish scripts
  const tokens = clean.split(/(\s+|[.,!?;:'"()/\-_])/);

  const censoredTokens = tokens.map((token) => {
    const raw = token.trim();
    if (!raw) return token;

    if (isProfaneToken(raw, blockedHashes, blockedWords, whitelist)) {
      hadProfanity = true;
      return "*".repeat(token.length);
    }

    return token;
  });

  clean = censoredTokens.join("");

  return { clean, hadProfanity };
}

export const MAX_MESSAGE_CHARS = 100;
