export const CAMPFIRE_STORY_TEXT = {
  en: `A bitter wind cuts through your coat, chilling you to the bone. Before you lies a crude fire pit with a few dry logs left behind by a forgotten traveler. Wolves howl in the surrounding darkness, their cries echoing closer with every passing moment. Without fire you will surely freeze to death or become prey to the beasts. Will you light the bonfire?`,
  ko: `매서운 바람이 코트를 파고들며 뼛속까지 식혀 온다. 눈앞에는 이름 모를 여행자가 남기고 간 듯한 조잡한 화덕과 마른 장작 몇 토막이 놓여 있다. 주변 어둠에서는 늑대 울음소리가 메아리치고, 그 소리는 점점 더 가까워진다. 불을 피우지 못하면 얼어 죽거나 짐승의 먹이가 될 것이다. 모닥불을 피우겠는가?`,
} as const;

export const CAMPFIRE_UI_TEXT = {
  inputPlaceholder: {
    en: "(light / Y)",
    ko: "(불을 켠다 / 예)",
  },
  bonfireLine: {
    en: "The bonfire crackles to life, its warmth wrapping around you...",
    ko: "모닥불이 타오르며, 그 온기가 당신을 감싼다...",
  },
  ventureForth: {
    en: "[ venture forth ]",
    ko: "[ 앞으로 나아간다 ]",
  },
  languageLabel: {
    en: "LANG",
    ko: "언어",
  },
  languageEnglish: {
    en: "EN",
    ko: "영어",
  },
  languageKorean: {
    en: "KR",
    ko: "한글",
  },
} as const;

export const BONFIRE_CONFIRM_KEYWORDS = [
  "light",
  "ignite",
  "y",
  "yes",
  "bonfire",
  "불",
  "점화",
  "켜",
  "피워",
  "예",
  "네",
  "응",
] as const;
