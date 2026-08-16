import fs from "node:fs";
import path from "node:path";

/**
 * Server-side moderation and profanity filter.
 *
 * NOTE: Zero vulgarity or wordlists are hardcoded in the codebase or git history.
 * Rules are dynamically loaded at runtime from a git-ignored file (`config/profanity-dictionary.json`)
 * or an environment variable (`PROFANITY_DICTIONARY_JSON`).
 */

interface ProfanityConfig {
  whitelist: string[];
  blocked: string[];
}

let cachedConfig: ProfanityConfig | null = null;

function loadConfig(): ProfanityConfig {
  if (cachedConfig) return cachedConfig;

  // 1. Try loading from environment variable (useful in production/serverless)
  if (process.env.PROFANITY_DICTIONARY_JSON) {
    try {
      const parsed = JSON.parse(process.env.PROFANITY_DICTIONARY_JSON);
      if (Array.isArray(parsed?.blocked)) {
        cachedConfig = {
          whitelist: Array.isArray(parsed.whitelist) ? parsed.whitelist : [],
          blocked: parsed.blocked,
        };
        return cachedConfig;
      }
    } catch {
      /* ignore env parse error */
    }
  }

  // 2. Try loading from local git-ignored dictionary file
  try {
    const configPath = path.resolve(process.cwd(), "config", "profanity-dictionary.json");
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(content);
      cachedConfig = {
        whitelist: Array.isArray(parsed?.whitelist) ? parsed.whitelist : [],
        blocked: Array.isArray(parsed?.blocked) ? parsed.blocked : [],
      };
      return cachedConfig;
    }
  } catch {
    /* fallback to empty */
  }

  cachedConfig = { whitelist: [], blocked: [] };
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
function isProfaneToken(token: string, blockedList: string[], whitelistSet: Set<string>): boolean {
  const lower = token.toLowerCase().trim();
  if (lower.length < 2) return false;
  if (whitelistSet.has(lower)) return false;

  const normalized = normalizeWord(lower);
  if (whitelistSet.has(normalized)) return false;

  for (const bad of blockedList) {
    const normBad = normalizeWord(bad);

    // 1. Direct or normalized equality
    if (lower === bad || normalized === normBad) return true;

    // 2. Substring match for words >= 4 characters
    if (bad.length >= 4 && (lower.includes(bad) || normalized.includes(normBad))) {
      return true;
    }

    // 3. Safe fuzzy match (edit distance <= 1 for words >= 5 characters)
    if (bad.length >= 5 && Math.abs(normalized.length - normBad.length) <= 1) {
      if (levenshtein(normalized, normBad) <= 1) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Censors profanities in text on the server using the git-ignored dictionary.
 */
export function censorMessageServer(text: string): { clean: string; hadProfanity: boolean } {
  if (!text) return { clean: "", hadProfanity: false };

  const { whitelist, blocked } = loadConfig();
  if (blocked.length === 0) {
    return { clean: text.trim(), hadProfanity: false };
  }

  const whitelistSet = new Set(whitelist.map((w) => w.toLowerCase()));
  let clean = text.trim();
  let hadProfanity = false;

  // 1. Direct substring matching for non-latin scripts (e.g. Malayalam)
  for (const bad of blocked) {
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

    if (isProfaneToken(raw, blocked, whitelistSet)) {
      hadProfanity = true;
      return "*".repeat(token.length);
    }

    return token;
  });

  clean = censoredTokens.join("");

  return { clean, hadProfanity };
}

export const MAX_MESSAGE_CHARS = 100;
