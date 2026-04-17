import {
  MONSTER_INTENT_LABEL_TEXT,
  MONSTER_NAME_TEXT,
} from "@/content/glossary/monsters/monsterText";
import { SPELL_NAME_TEXT } from "@/content/glossary/spells/spellText";

export type Language = "en" | "ko";
export type Locale = Language;

type LocalizedText = Record<Language, string>;

/**
 * 언어 설정을 브라우저에 저장할 때 사용할 키다.
 */
export const LOCALE_STORAGE_KEY = "pret.locale";

/**
 * 전환 버튼에 표시할 언어 옵션 목록이다.
 */
export const LOCALE_OPTIONS: ReadonlyArray<{
  code: Language;
  label: string;
  shortLabel: string;
}> = [
  { code: "ko", label: "한국어", shortLabel: "KR" },
  { code: "en", label: "English", shortLabel: "EN" },
];

/**
 * 현재 언어에 맞는 문자열을 선택한다.
 */
export function pickText(language: Language, text: LocalizedText): string {
  return text[language];
}

/**
 * 문자열이 지원하는 언어 코드인지 판별한다.
 */
function isLanguage(value: string | null): value is Language {
  return value === "ko" || value === "en";
}

/**
 * 브라우저 언어와 저장값을 기준으로 초기 언어를 결정한다.
 */
export function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLanguage = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isLanguage(storedLanguage)) {
    return storedLanguage;
  }

  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

/**
 * 영문 몬스터 이름을 현재 언어 표시명으로 변환한다.
 */
export function getLocalizedMonsterName(name: string, language: Language): string {
  return MONSTER_NAME_TEXT[name as keyof typeof MONSTER_NAME_TEXT]?.[language] ?? name;
}

/**
 * 영문 몬스터 의도 문장을 현재 언어 표시문으로 변환한다.
 */
export function getLocalizedMonsterIntentLabel(label: string, language: Language): string {
  return MONSTER_INTENT_LABEL_TEXT[
    label as keyof typeof MONSTER_INTENT_LABEL_TEXT
  ]?.[language] ?? label;
}

/**
 * 영문 주문명을 현재 언어 표시명으로 변환한다.
 */
export function getLocalizedSpellName(name: string, language: Language): string {
  return SPELL_NAME_TEXT[name as keyof typeof SPELL_NAME_TEXT]?.display[language] ?? name;
}

/**
 * 한글 별칭을 포함한 주문 입력을 영문 내부 키로 정규화한다.
 */
export function normalizeSpellQuery(query: string): string {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return query;
  }

  for (const [englishName, meta] of Object.entries(SPELL_NAME_TEXT)) {
    const candidates = [
      englishName,
      meta.display.en,
      meta.display.ko,
      ...meta.aliases,
    ].map((candidate) => candidate.toLowerCase());

    if (candidates.includes(normalized)) {
      return englishName;
    }
  }

  return query;
}
