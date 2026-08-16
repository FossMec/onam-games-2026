/**
 * Profanity and slang filtering for Malayalam, Manglish, and English.
 * Replaces abusive/inappropriate words with asterisks (*).
 */

// Common English profanities
const ENGLISH_BAD_WORDS = [
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "fuk",
  "shit",
  "bullshit",
  "bitch",
  "bitches",
  "bitching",
  "asshole",
  "ass",
  "bastard",
  "dick",
  "pussy",
  "cunt",
  "cock",
  "motherfucker",
  "whore",
  "slut",
  "retard",
  "nigger",
  "nigga",
  "faggot",
  "porn",
  "sex",
  "boobs",
  "penis",
  "vagina",
  "blowjob",
  "masturbat",
];

// Malayalam script theri / abusive words
const MALAYALAM_SCRIPT_BAD_WORDS = [
  "മൈര്",
  "മൈരേ",
  "മൈരൻ",
  "മൈരുകൾ",
  "മൈര",
  "പൂറ്",
  "പൂറ്റി",
  "പൂറ്റിലെ",
  "കുണ്ണ",
  "കുണ്ണപ്പാൽ",
  "തേവിടിച്ചി",
  "വെടി",
  "തായോളി",
  "തന്തയില്ലാത്ത",
  "നായീന്റെ",
  "പട്ടിത്തായോളി",
  "പുണ്ട",
  "പുണ്ടച്ചി",
  "തീട്ടം",
  "ഓലക്ക",
  "കൂതി",
  "കൂത്തിച്ചി",
  "കുണ്ടി",
  "അണ്ടി",
  "ഓമ്പു",
  "ഓമ്പിക്കോ",
  "പുലയാടി",
  "കഴുവേറി",
  "ചത്ത",
  "നാറി",
];

// Manglish (Romanized Malayalam) slang, theri, and abusive tokens
const MANGLISH_BAD_WORDS = [
  "myre",
  "myran",
  "myru",
  "mairu",
  "mairan",
  "mair",
  "myr",
  "pooru",
  "poori",
  "poorile",
  "poottile",
  "pootti",
  "kunna",
  "kunne",
  "kunnappal",
  "thevudichi",
  "thevidichi",
  "thevidi",
  "thevudi",
  "vedi",
  "vedichi",
  "thayoli",
  "thaayoli",
  "thayyoli",
  "naayinte",
  "nayinte",
  "naaye",
  "pundachi",
  "punda",
  "theettam",
  "theetam",
  "theetam",
  "andi",
  "oombu",
  "oombi",
  "oombiko",
  "oombiya",
  "ombu",
  "ombiko",
  "ombi",
  "chandi",
  "koothi",
  "koothichi",
  "kundi",
  "poolu",
  "moolakkuruvi",
  "shaddi",
  "kazhuveri",
  "kazhuvri",
  "pulayadi",
  "naari",
  "thanthayillatha",
  "thanthedi",
  "thanta",
];

const ALL_WORDS = Array.from(
  new Set([...ENGLISH_BAD_WORDS, ...MALAYALAM_SCRIPT_BAD_WORDS, ...MANGLISH_BAD_WORDS]),
);

/**
 * Normalizes repeated characters like "myyyyyrrrreee" -> "myre"
 */
function normalizeRepeats(word: string): string {
  return word.replace(/(.)\1{2,}/g, "$1$1");
}

/**
 * Censors profanities in text, replacing bad words with asterisks (*).
 */
export function censorMessage(text: string): { clean: string; hadProfanity: boolean } {
  if (!text) return { clean: "", hadProfanity: false };

  let clean = text.trim();
  let hadProfanity = false;

  // 1. Malayalam script word matches
  for (const bad of MALAYALAM_SCRIPT_BAD_WORDS) {
    if (clean.includes(bad)) {
      hadProfanity = true;
      const mask = "*".repeat(bad.length);
      clean = clean.split(bad).join(mask);
    }
  }

  // 2. English & Manglish token matches (case-insensitive with word boundaries or fuzzy match)
  const tokens = clean.split(/(\s+|[.,!?;:'"()/\-_])/);

  const censoredTokens = tokens.map((token) => {
    const raw = token.toLowerCase().trim();
    if (!raw) return token;

    const normalized = normalizeRepeats(raw);

    for (const bad of ALL_WORDS) {
      if (
        raw === bad ||
        normalized === bad ||
        (bad.length >= 4 && (raw.startsWith(bad) || raw.endsWith(bad)))
      ) {
        hadProfanity = true;
        return "*".repeat(token.length);
      }
    }

    return token;
  });

  clean = censoredTokens.join("");

  return { clean, hadProfanity };
}

export const MAX_MESSAGE_CHARS = 100;
