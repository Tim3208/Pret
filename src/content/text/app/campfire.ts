export const CAMPFIRE_STORY_TEXT = {
  en: `A bitter wind cuts through your coat, chilling you to the bone. Before you lies a crude fire pit with a few dry logs left behind by a forgotten traveler. Wolves howl in the surrounding darkness, their cries echoing closer with every passing moment. Without fire you will surely freeze to death or become prey to the beasts. Will you light the bonfire?`,
  ko: `매서운 바람이 코트를 파고들며 뼛속까지 식혀 온다. 눈앞에는 이름 모를 여행자가 남기고 간 듯한 조잡한 화덕과 마른 장작 몇 토막이 놓여 있다. 주변 어둠에서는 늑대 울음소리가 메아리치고, 그 소리는 점점 더 가까워진다. 불을 피우지 못하면 얼어 죽거나 짐승의 먹이가 될 것이다. 모닥불을 피우겠는가?`,
} as const;

export const CAMPFIRE_UI_TEXT = {
  inputPlaceholder: {
    en: "(light / Y)",
    ko: "(불을 켠다 / 예)",
  },
  commandPlaceholder: {
    en: "(1 / 2 / venture / stats)",
    ko: "(1 / 2 / 출발 / 스탯)",
  },
  bonfireLine: {
    en: "The bonfire crackles to life, its warmth wrapping around you...",
    ko: "모닥불이 타오르며, 그 온기가 당신을 감싼다...",
  },
  bonfireActionLine: {
    en: "You wait by the flame, deciding what to do before the dark closes in.",
    ko: "어둠이 다시 닫히기 전에, 모닥불 곁에서 다음 행동을 고른다.",
  },
  commandTitle: {
    en: "[ BONFIRE ACTIONS ]",
    ko: "[ 모닥불 행동 ]",
  },
  ventureForth: {
    en: "[ venture forth ]",
    ko: "[ 앞으로 나아간다 ]",
  },
  allocateStats: {
    en: "[ allocate stats ]",
    ko: "[ 스탯을 배분한다 ]",
  },
  invalidCommand: {
    en: "The flame wavers, but nothing answers that command.",
    ko: "불길이 일렁일 뿐, 그 명령에는 아무 반응이 없다.",
  },
  noStatPoints: {
    en: "No unused stat points remain.",
    ko: "남은 스탯 포인트가 없다.",
  },
  recoveryLine: {
    en: "Bonfire warmth restores +{hp} HP and +{mana} MP.",
    ko: "모닥불의 온기가 HP +{hp}, MP +{mana}만큼 되돌린다.",
  },
  potionRefillLine: {
    en: "A fresh flask settles by the coals. Potion charges set to {potions}.",
    ko: "숯불 곁에 새 물약이 놓였다. 물약 충전 수가 {potions}이 된다.",
  },
  victoryLine: {
    en: "+{experience} XP from {monsterName}.",
    ko: "{monsterName}에게서 경험치 +{experience}.",
  },
  levelUpLine: {
    en: "LEVEL UP. Unspent stat points +{points}.",
    ko: "레벨 업. 미사용 스탯 포인트 +{points}.",
  },
  statusLine: {
    en: "LV {level} // HP {hp}/{maxHp} // MP {mana}/{maxMana} // POT {potions} // PTS {points}",
    ko: "LV {level} // HP {hp}/{maxHp} // MP {mana}/{maxMana} // POT {potions} // PTS {points}",
  },
  progressLine: {
    en: "XP {experience}/{nextExperience} // DEPTH {depth}",
    ko: "XP {experience}/{nextExperience} // DEPTH {depth}",
  },
  popupTitle: {
    en: "Allocate Stat Points",
    ko: "스탯 포인트 배분",
  },
  popupHint: {
    en: "The bonfire steadies your hands. Spend the points you have kept in reserve.",
    ko: "모닥불 곁에서 숨을 고른다. 남겨 둔 포인트를 원하는 능력치에 배분하라.",
  },
  popupDone: {
    en: "[ done ]",
    ko: "[ 완료 ]",
  },
  statPointsLabel: {
    en: "Unspent Points",
    ko: "남은 포인트",
  },
  strengthLabel: {
    en: "Strength",
    ko: "힘",
  },
  agilityLabel: {
    en: "Agility",
    ko: "민첩",
  },
  decipherLabel: {
    en: "Decipher",
    ko: "해독력",
  },
  combinationLabel: {
    en: "Combination",
    ko: "조합력",
  },
  stabilityLabel: {
    en: "Stability",
    ko: "안정성",
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
  journeyTitle: {
    en: "[ ASH TRAIL ]",
    ko: "[ 재의 행로 ]",
  },
  journeyBattleLabel: {
    en: "battle",
    ko: "전투",
  },
  journeyEventLabel: {
    en: "event",
    ko: "이벤트",
  },
  journeyBonfireLabel: {
    en: "bonfire",
    ko: "모닥불",
  },
  journeyHintFirstBattle: {
    en: "The scent of ash is still far off. Two thresholds remain before the fire.",
    ko: "재 냄새는 아직 멀다. 불씨에 닿기까지 두 개의 경계가 더 남아 있다.",
  },
  journeyHintEvent: {
    en: "The path bends toward warmth. Endure one more encounter and the bonfire will answer.",
    ko: "길이 온기 쪽으로 휘기 시작한다. 한 번만 더 버티면 모닥불이 답할 것이다.",
  },
  journeyHintSecondBattle: {
    en: "The emberlight is close now. This fight stands between you and the bonfire.",
    ko: "불빛이 가까워졌다. 이 전투 하나만 넘기면 모닥불이다.",
  },
  journeyHintBonfire: {
    en: "Warmth reaches your hands again. This is the one pause the dark allows.",
    ko: "온기가 다시 손끝에 닿는다. 어둠이 허락한 잠깐의 숨 고르기다.",
  },
} as const;

export const BONFIRE_VENTURE_KEYWORDS = [
  "1",
  "venture",
  "go",
  "forth",
  "forward",
  "출발",
  "전진",
  "나아간다",
  "앞으로",
] as const;

export const BONFIRE_ALLOCATE_KEYWORDS = [
  "2",
  "stats",
  "stat",
  "allocate",
  "level",
  "스탯",
  "배분",
  "분배",
  "찍기",
] as const;

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
