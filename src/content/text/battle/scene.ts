export const BATTLE_ENCOUNTER_TEXT = {
  en:
    "A twisted figure emerges from the shadows, its body a mass of writhing dark tendrils, " +
    "two pale eyes burning with cold malice. The Hollow Wraith lets out a guttural screech " +
    "that rattles your bones. The air thickens, and the temperature drops.",
  ko:
    "비틀린 형상이 그림자 속에서 모습을 드러낸다. 뒤엉킨 검은 촉수로 이루어진 육체와, " +
    "차가운 악의로 타오르는 창백한 두 눈이 어둠을 가른다. 공허의 망령이 뼈를 울리는 듯한 " +
    "거친 비명을 지르자 공기가 무거워지고 온도가 뚝 떨어진다.",
} as const;

export const BATTLE_AMBIENT_LINES = {
  en: [
    "Shadows coil around the wraith's tendrils.",
    "The air tastes of iron and decay.",
    "Wind howls through the hollow.",
    "Frost creeps along the stone floor.",
    "The wraith's eyes pulse with faint hunger.",
    "A low hum resonates from the darkness.",
    "Your breath fogs in the cold air.",
    "Embers drift through the stale dark.",
    "The silence presses like a weight.",
    "Something stirs in the deeper shadows.",
  ],
  ko: [
    "그림자가 망령의 촉수 주위를 소용돌이친다.",
    "공기에서 쇠와 부패의 맛이 난다.",
    "허공을 가르는 바람 소리가 스민다.",
    "차가운 서리가 돌바닥을 타고 번진다.",
    "망령의 눈빛이 희미한 굶주림으로 맥동한다.",
    "어둠 깊은 곳에서 낮은 울림이 퍼진다.",
    "차가운 공기 속에 입김이 하얗게 흩어진다.",
    "희미한 불씨가 눅눅한 어둠 사이를 떠돈다.",
    "침묵이 무게처럼 짓눌러 온다.",
    "더 깊은 그림자 속에서 무언가 꿈틀댄다.",
  ],
} as const;

export const BATTLE_SCENE_TEXT = {
  en: {
    selfTargetName: "You",
    yourself: "yourself",
    battleBegins: "The battle begins!",
    clickToFight: "[ click to fight ]",
    loadingCombatants: "Loading combatants...",
    victoryEvent: "Something stirs in the ash...",
    victoryReturn: "Returning to the bonfire...",
    defeatTitle: "You fall in the dark.",
    defeatReturn: "Returning to the campfire...",
    enemyStunned: "Enemy stunned!",
    elementalWeakness: "Elemental weakness! Super effective!",
    elementalResistance: "Elemental resistance... not very effective.",
  },
  ko: {
    selfTargetName: "당신",
    yourself: "당신 자신",
    battleBegins: "전투가 시작된다!",
    clickToFight: "[ 클릭하여 전투 ]",
    loadingCombatants: "전투원을 불러오는 중...",
    victoryEvent: "재 속에서 무언가 꿈틀거린다...",
    victoryReturn: "모닥불로 돌아가는 중...",
    defeatTitle: "어둠 속에 쓰러졌다.",
    defeatReturn: "모닥불로 돌아가는 중...",
    enemyStunned: "적이 기절했다!",
    elementalWeakness: "원소 약점 적중! 큰 피해!",
    elementalResistance: "원소 저항... 피해가 줄었다.",
  },
} as const;
