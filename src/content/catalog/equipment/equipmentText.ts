type LocalizedCopy = Record<"en" | "ko", string>;

interface EquipmentTextEntry {
  effectText: LocalizedCopy;
  flavorText: LocalizedCopy;
  name: LocalizedCopy;
}

/**
 * 장비 슬롯의 UI 표시명을 모아둔 카탈로그 텍스트다.
 */
export const EQUIPMENT_SLOT_LABEL_TEXT: Record<string, LocalizedCopy> = {
  head: {
    en: "Head",
    ko: "머리",
  },
  necklace: {
    en: "Necklace",
    ko: "목걸이",
  },
  shoulders: {
    en: "Shoulder Armor",
    ko: "어깨방어구",
  },
  cloak: {
    en: "Cloak",
    ko: "망토",
  },
  bracelet: {
    en: "Bracelet",
    ko: "팔찌",
  },
};

/**
 * 장비 이름, 묘사, 효과 설명처럼 플레이어가 읽는 문구만 분리한 텍스트 사전이다.
 */
export const EQUIPMENT_TEXT: Record<string, EquipmentTextEntry> = {
  "cinder-diadem": {
    name: {
      en: "Ashwake Helm",
      ko: "잿불 반구투구",
    },
    flavorText: {
      en: "A soot-bright half-dome helm waits in the cinders, warm as though another brow just left it.",
      ko: "재 속에 묻힌 반구형 투구가 아직 다른 이의 이마 온기를 품은 듯 미지근하게 빛난다.",
    },
    effectText: {
      en: "+1 Decipher, +1 Stability",
      ko: "해독력 +1, 안정성 +1",
    },
  },
  "whisper-locket": {
    name: {
      en: "Whisper Locket",
      ko: "속삭임 로켓",
    },
    flavorText: {
      en: "A cold clasp settles at your throat and hums with unfinished vows.",
      ko: "차가운 잠금장치가 목에 내려앉고 끝맺지 못한 맹세처럼 웅웅거린다.",
    },
    effectText: {
      en: "+4 Max Mana",
      ko: "최대 마나 +4",
    },
  },
  "graveshard-spaulder": {
    name: {
      en: "Graveshard Spaulder",
      ko: "묘석 견갑",
    },
    flavorText: {
      en: "A broken funerary shard braces your shoulder like a waiting ward.",
      ko: "부서진 묘석 조각이 대기 중인 수호문처럼 어깨를 받친다.",
    },
    effectText: {
      en: "+2 Shield when defending",
      ko: "방어 시 방어막 +2",
    },
  },
  "night-tithe-cloak": {
    name: {
      en: "Night-Tithe Cloak",
      ko: "밤의 십일조 망토",
    },
    flavorText: {
      en: "A strip of obedient dark drapes across your waist and drinks the emberlight.",
      ko: "순종적인 어둠 한 조각이 허리를 타고 드리우며 불빛을 삼킨다.",
    },
    effectText: {
      en: "+4 Max HP",
      ko: "최대 HP +4",
    },
  },
  "oathcoil-bracelet": {
    name: {
      en: "Oathcoil Bracelet",
      ko: "맹세고리 팔찌",
    },
    flavorText: {
      en: "A coiled mark bites your wrist and tightens when battle calls.",
      ko: "소용돌이 문양이 손목을 물고 전투의 기척이 오면 조여든다.",
    },
    effectText: {
      en: "+1 Strength, +1 Agility",
      ko: "힘 +1, 민첩 +1",
    },
  },
};
