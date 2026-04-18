export type LexiconCategory = "verb" | "connector" | "contrast" | "broken-script";

export interface LexiconCopy {
  en: string;
  ko: string;
}

export interface LexiconCategoryDefinition {
  id: LexiconCategory;
  primaryLabel: LexiconCopy;
  secondaryLabel: LexiconCopy;
}

export interface LexiconEntry {
  id: string;
  category: LexiconCategory;
  defaultUnlocked: boolean;
  term: LexiconCopy;
  example: LexiconCopy;
  effect: LexiconCopy;
}

export interface LexiconEntryPresentation {
  term: string;
  example: string;
  effect: string;
  unstable: boolean;
}

const NOISE_CHARS = ["#", "%", "=", "+", "?", "/", "\\", "*", ":", ";", "[", "]", "{", "}", "<", ">", "|"];

const RUNE_REVEAL_STAGES = [
  { term: 0.1, example: 0.03, effect: 0.02 },
  { term: 0.24, example: 0.11, effect: 0.08 },
  { term: 0.5, example: 0.26, effect: 0.2 },
  { term: 0.78, example: 0.54, effect: 0.46 },
  { term: 1, example: 1, effect: 1 },
] as const;

export const LEXICON_PAGE_SIZE = 2;

export const LEXICON_CATEGORIES: LexiconCategoryDefinition[] = [
  {
    id: "verb",
    primaryLabel: {
      en: "verb",
      ko: "verb",
    },
    secondaryLabel: {
      en: "action",
      ko: "동사",
    },
  },
  {
    id: "connector",
    primaryLabel: {
      en: "connector",
      ko: "connector",
    },
    secondaryLabel: {
      en: "bind",
      ko: "연결어",
    },
  },
  {
    id: "contrast",
    primaryLabel: {
      en: "contrast",
      ko: "contrast",
    },
    secondaryLabel: {
      en: "surge",
      ko: "반전어",
    },
  },
  {
    id: "broken-script",
    primaryLabel: {
      en: "broken script",
      ko: "broken script",
    },
    secondaryLabel: {
      en: "fractured rune",
      ko: "깨진 글자",
    },
  },
];

export const LEXICON_ENTRIES: LexiconEntry[] = [
  {
    id: "verb-attack",
    category: "verb",
    defaultUnlocked: true,
    term: {
      en: "attack",
      ko: "attack",
    },
    example: {
      en: "attack",
      ko: "attack",
    },
    effect: {
      en: "Base physical strike.",
      ko: "기본 물리 공격.",
    },
  },
  {
    id: "verb-defense",
    category: "verb",
    defaultUnlocked: true,
    term: {
      en: "defense",
      ko: "defense",
    },
    example: {
      en: "defense",
      ko: "defense",
    },
    effect: {
      en: "Raise a shield around yourself.",
      ko: "자신에게 방어막을 전개한다.",
    },
  },
  {
    id: "verb-heal",
    category: "verb",
    defaultUnlocked: true,
    term: {
      en: "heal",
      ko: "heal",
    },
    example: {
      en: "heal",
      ko: "heal",
    },
    effect: {
      en: "Recover your own health.",
      ko: "자신의 체력을 회복한다.",
    },
  },
  {
    id: "connector-mor",
    category: "connector",
    defaultUnlocked: true,
    term: {
      en: "MOR",
      ko: "MOR",
    },
    example: {
      en: "attack MOR defense",
      ko: "attack MOR defense",
    },
    effect: {
      en: "Bind two actions together; low combination weakens both.",
      ko: "두 행동을 함께 묶는다. 조합력이 부족하면 둘 다 약해진다.",
    },
  },
  {
    id: "contrast-ubt",
    category: "contrast",
    defaultUnlocked: true,
    term: {
      en: "UBT",
      ko: "UBT",
    },
    example: {
      en: "defense UBT",
      ko: "defense UBT",
    },
    effect: {
      en: "Amplify the final action; low combination blunts the surge.",
      ko: "마지막 행동을 증폭한다. 조합력이 낮으면 증폭도 둔해진다.",
    },
  },
  {
    id: "rune-xlew",
    category: "broken-script",
    defaultUnlocked: true,
    term: {
      en: "XLEW",
      ko: "XLEW",
    },
    example: {
      en: "XLEW",
      ko: "XLEW",
    },
    effect: {
      en: "A fire strike on its own; can also ignite an attack phrase.",
      ko: "단독으로 화염 공격을 일으키며, 공격 구문에 불을 붙일 수도 있다.",
    },
  },
];

export function getDefaultUnlockedLexiconIds(): string[] {
  return LEXICON_ENTRIES.filter((entry) => entry.defaultUnlocked).map((entry) => entry.id);
}

export function getLexiconEntriesForCategory(
  category: LexiconCategory,
  unlockedEntryIds: readonly string[],
): LexiconEntry[] {
  const unlocked = new Set(unlockedEntryIds);
  return LEXICON_ENTRIES.filter((entry) => entry.category === category && unlocked.has(entry.id));
}

function clampDecipher(decipher: number): number {
  return Math.max(1, Math.min(5, Math.round(decipher)));
}

function localize(copy: LexiconCopy, language: "en" | "ko"): string {
  return copy[language];
}

function revealWithNoise(target: string, ratio: number, tick: number, salt: number): string {
  if (ratio >= 0.999) {
    return target;
  }

  const characters = Array.from(target);
  return characters.map((character, index) => {
    if (character === " ") {
      return " ";
    }

    const punctuation = /[.:,;!?()-]/.test(character);
    const jitter = Math.sin((tick + 1) * 0.55 + index * 0.92 + salt * 0.31) * 0.08;
    const revealThreshold = ratio + jitter - index * 0.01;

    if (punctuation && revealThreshold > 0.28) {
      return character;
    }

    if (revealThreshold > 0.52) {
      return character;
    }

    return NOISE_CHARS[(tick * 3 + salt * 5 + index * 7) % NOISE_CHARS.length];
  }).join("");
}

export function getLexiconEntryPresentation(
  entry: LexiconEntry,
  language: "en" | "ko",
  decipher: number,
  noiseTick: number,
): LexiconEntryPresentation {
  if (entry.category !== "broken-script") {
    return {
      term: localize(entry.term, language),
      example: localize(entry.example, language),
      effect: localize(entry.effect, language),
      unstable: false,
    };
  }

  const stage = RUNE_REVEAL_STAGES[clampDecipher(decipher) - 1];
  return {
    term: revealWithNoise(localize(entry.term, language), stage.term, noiseTick, 2),
    example: revealWithNoise(localize(entry.example, language), stage.example, noiseTick, 7),
    effect: revealWithNoise(localize(entry.effect, language), stage.effect, noiseTick, 11),
    unstable: stage.effect < 0.999,
  };
}
