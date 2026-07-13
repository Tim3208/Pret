export const RUN_RESULT_TEXT = {
  victoryTitle: {
    en: "[ ASH GATE CLEARED ]",
    ko: "[ 재의 문을 넘었다 ]",
  },
  defeatTitle: {
    en: "[ THE RUN GOES DARK ]",
    ko: "[ 런의 불빛이 꺼졌다 ]",
  },
  victoryNarrative: {
    en: [
      "The crowned wraith collapses into quiet ash. Beyond the ruined throne, a path opens toward a dawn you have not yet earned.",
      "You carry the heat of this run forward.",
    ],
    ko: [
      "왕관을 쓴 망령이 고요한 재로 무너진다. 부서진 왕좌 너머로 아직 얻지 못한 새벽을 향한 길이 열린다.",
      "이번 런에서 남은 열기를 다음 길로 가져간다.",
    ],
  },
  defeatNarrative: {
    en: [
      "The dark gathers your scattered ashes. The bonfire waits for another attempt.",
      "What you learned survives the fall, even when this run does not.",
    ],
    ko: [
      "어둠이 흩어진 재를 거둬간다. 모닥불은 다음 도전을 기다린다.",
      "이번 런은 끝났지만, 길에서 배운 것은 쓰러짐 너머에 남는다.",
    ],
  },
  summaryTitle: {
    en: "RUN RECORD",
    ko: "런 기록",
  },
  clearedBattlesLine: {
    en: "Cleared battles: {count}",
    ko: "클리어 전투: {count}",
  },
  levelLine: {
    en: "Level {level} // XP {experience}",
    ko: "레벨 {level} // 경험치 {experience}",
  },
  equipmentLine: {
    en: "Carried gear: {items}",
    ko: "지닌 장비: {items}",
  },
  noEquipment: {
    en: "none",
    ko: "없음",
  },
  restartLabel: {
    en: "[ begin a new run ]",
    ko: "[ 새 런을 시작한다 ]",
  },
} as const;
