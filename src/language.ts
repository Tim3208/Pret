export type Language = "en" | "ko";

type LocalizedText = Record<Language, string>;

/**
 * 현재 언어에 맞는 문자열을 선택한다.
 *
 * @param language 현재 언어 모드
 * @param text 언어별 문자열 묶음
 * @returns 선택된 문자열
 */
export function pickText(language: Language, text: LocalizedText): string {
  return text[language];
}

const MONSTER_NAME_MAP: Record<string, LocalizedText> = {
  "Hollow Wraith": {
    en: "Hollow Wraith",
    ko: "공허의 망령",
  },
};

const MONSTER_INTENT_LABEL_MAP: Record<string, LocalizedText> = {
  "drawing a sword...": {
    en: "drawing a sword...",
    ko: "검을 끌어올린다...",
  },
  "preparing an attack...": {
    en: "preparing an attack...",
    ko: "공격 태세를 가다듬는다...",
  },
  "bracing for defense...": {
    en: "bracing for defense...",
    ko: "방어 태세를 굳힌다...",
  },
  "gathering the power of fire...": {
    en: "gathering the power of fire...",
    ko: "화염의 힘을 끌어모은다...",
  },
  "charging fiercely...": {
    en: "charging fiercely...",
    ko: "사납게 돌진할 기세다...",
  },
  "summoning something...": {
    en: "summoning something...",
    ko: "무언가를 불러내려 한다...",
  },
};

const SPELL_NAME_MAP: Record<
  string,
  {
    display: LocalizedText;
    aliases: string[];
  }
> = {
  Flame: {
    display: { en: "Flame", ko: "화염" },
    aliases: ["플레임"],
  },
  Blaze: {
    display: { en: "Blaze", ko: "업화" },
    aliases: ["블레이즈"],
  },
  Inferno: {
    display: { en: "Inferno", ko: "지옥불" },
    aliases: ["인페르노"],
  },
  Ripple: {
    display: { en: "Ripple", ko: "물결" },
    aliases: ["리플"],
  },
  Torrent: {
    display: { en: "Torrent", ko: "급류" },
    aliases: ["토렌트"],
  },
  Deluge: {
    display: { en: "Deluge", ko: "대홍수" },
    aliases: ["델루지"],
  },
  Stone: {
    display: { en: "Stone", ko: "돌" },
    aliases: ["스톤", "암석"],
  },
  Boulder: {
    display: { en: "Boulder", ko: "거암" },
    aliases: ["볼더"],
  },
  Bastion: {
    display: { en: "Bastion", ko: "보루" },
    aliases: ["배스천", "바스티온"],
  },
  Thorn: {
    display: { en: "Thorn", ko: "가시" },
    aliases: ["쏜"],
  },
  Verdure: {
    display: { en: "Verdure", ko: "녹음" },
    aliases: ["버듀어", "초록"],
  },
  Sylvan: {
    display: { en: "Sylvan", ko: "숲의 가호" },
    aliases: ["실반", "실번"],
  },
};

/**
 * 영문 몬스터 이름을 현재 언어 표시명으로 변환한다.
 */
export function getLocalizedMonsterName(name: string, language: Language): string {
  return MONSTER_NAME_MAP[name]?.[language] ?? name;
}

/**
 * 영문 몬스터 의도 문장을 현재 언어 표시문으로 변환한다.
 */
export function getLocalizedMonsterIntentLabel(label: string, language: Language): string {
  return MONSTER_INTENT_LABEL_MAP[label]?.[language] ?? label;
}

/**
 * 영문 주문명을 현재 언어 표시명으로 변환한다.
 */
export function getLocalizedSpellName(name: string, language: Language): string {
  return SPELL_NAME_MAP[name]?.display[language] ?? name;
}

/**
 * 한글 별칭을 포함한 주문 입력을 영문 내부 키로 정규화한다.
 */
export function normalizeSpellQuery(query: string): string {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return query;
  }

  for (const [englishName, meta] of Object.entries(SPELL_NAME_MAP)) {
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
