export const POST_BATTLE_INVESTIGATE_KEYWORDS = [
  "investigate",
  "inspect",
  "approach",
  "continue",
  "yes",
  "y",
  "look",
  "살핀다",
  "조사",
  "다가간다",
  "예",
  "응",
  "진행",
] as const;

export const POST_BATTLE_LEAVE_KEYWORDS = [
  "leave",
  "pass",
  "skip",
  "no",
  "n",
  "walk away",
  "떠난다",
  "지나친다",
  "거절",
  "아니오",
  "아니",
  "넘긴다",
] as const;

export const POST_BATTLE_TAKE_KEYWORDS = [
  "take",
  "keep",
  "equip",
  "bind",
  "yes",
  "y",
  "가져간다",
  "줍는다",
  "장착",
  "결속",
  "예",
  "응",
] as const;

export const POST_BATTLE_EVENT_TEXT = {
  approachLead: {
    en: "At the cliff's lip, just beyond the bonfire path, something catches in the cinders and shale.",
    ko: "모닥불로 돌아가는 길목의 절벽 끝, 재와 혈암 사이에서 무언가 희미하게 걸린다.",
  },
  approachDetail: {
    en: "It looks like a half-buried helm, faintly warm, as though it has been waiting for the next survivor to notice it.",
    ko: "반쯤 묻힌 투구처럼 보인다. 방금까지 누군가 기다리고 있던 것처럼 희미한 온기가 남아 있다.",
  },
  approachQuestion: {
    en: "Will you draw closer?",
    ko: "가까이 다가가겠는가?",
  },
  offerLead: {
    en: "You brush the ash aside. A dark half-dome helm rises from the embers, catching the firelight along its curve.",
    ko: "재를 걷어내자 어두운 반구형 투구가 불씨 사이에서 모습을 드러낸다. 둥근 곡면을 따라 불빛이 번진다.",
  },
  offerQuestion: {
    en: "Will you take it with you?",
    ko: "이것을 가져가겠는가?",
  },
  offerReplaceQuestion: {
    en: "It will replace what already rests on that part of you. Will you take it anyway?",
    ko: "이미 그 자리에 있는 것을 밀어내게 된다. 그래도 가져가겠는가?",
  },
  currentSlotLabel: {
    en: "Currently worn",
    ko: "현재 장착 중",
  },
  itemHoverLabel: {
    en: "hover the helm to read its effect",
    ko: "효과를 보려면 투구에 마우스를 올린다",
  },
  inactiveLabel: {
    en: "Tooltip only for now. Combat values stay unchanged in this build.",
    ko: "지금은 툴팁 전용이다. 이 빌드에서는 전투 수치가 바뀌지 않는다.",
  },
  invalidApproach: {
    en: "The ash waits for a clearer answer.",
    ko: "재가 더 또렷한 대답을 기다린다.",
  },
  invalidOffer: {
    en: "The helm keeps watching. Take it or leave it.",
    ko: "투구는 여전히 당신을 바라본다. 가져가거나 남겨 두어라.",
  },
  approachPlaceholder: {
    en: "(investigate / leave)",
    ko: "(살핀다 / 떠난다)",
  },
  offerPlaceholder: {
    en: "(take / leave)",
    ko: "(가져간다 / 남긴다)",
  },
  effectLabel: {
    en: "effect:",
    ko: "효과:",
  },
} as const;
