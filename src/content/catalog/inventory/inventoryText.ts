type LocalizedCopy = Record<"en" | "ko", string>;

interface InventoryItemTextEntry {
  description: LocalizedCopy;
  name: LocalizedCopy;
}

interface BonfireRecipeTextEntry {
  description: LocalizedCopy;
  effect: LocalizedCopy;
  name: LocalizedCopy;
}

/**
 * 런 인벤토리에 표시할 아이템 이름과 설명이다.
 */
export const INVENTORY_ITEM_TEXT = {
  "ashen-sigil": {
    name: {
      en: "Ashen Sigil",
      ko: "잿빛 인장",
    },
    description: {
      en: "A quest mark shaped beside the fire. It has no use yet, but the ash remembers it.",
      ko: "모닥불 곁에서 빚은 퀘스트 표식. 아직 쓰임은 없지만, 재는 그 모양을 기억한다.",
    },
  },
  "beast-scrap": {
    name: {
      en: "Beast Scrap",
      ko: "짐승 잔해",
    },
    description: {
      en: "Usable sinew, hide, and bone left from the last fight.",
      ko: "지난 전투에서 남은 힘줄, 가죽, 뼈 조각.",
    },
  },
  "ember-shard": {
    name: {
      en: "Ember Shard",
      ko: "불씨 파편",
    },
    description: {
      en: "A brittle heat that can wake dull metal.",
      ko: "무딘 금속을 깨울 수 있는 부서지기 쉬운 열기.",
    },
  },
  "wild-herb": {
    name: {
      en: "Wild Herb",
      ko: "들풀 약초",
    },
    description: {
      en: "A bitter green thing that survived near the path.",
      ko: "길가에서 살아남은 씁쓸한 풀잎.",
    },
  },
} as const satisfies Record<string, InventoryItemTextEntry>;

/**
 * 모닥불 제작/요리 레시피의 플레이어 노출 문구다.
 */
export const BONFIRE_RECIPE_TEXT = {
  "ashen-sigil": {
    name: {
      en: "Shape Ashen Sigil",
      ko: "잿빛 인장을 빚는다",
    },
    description: {
      en: "Press herb ash into an ember mark for a later promise.",
      ko: "약초 재를 불씨 표식에 눌러 언젠가의 약속을 남긴다.",
    },
    effect: {
      en: "Stores a quest item for future routes.",
      ko: "향후 경로에 사용할 퀘스트 아이템을 보관한다.",
    },
  },
  "ember-stew": {
    name: {
      en: "Cook Ember Stew",
      ko: "불씨 스튜를 끓인다",
    },
    description: {
      en: "A harsh broth that bites back before the next fight.",
      ko: "다음 전투 전에 몸을 먼저 물어뜯는 거친 국물.",
    },
    effect: {
      en: "Restores HP/MP now. Next battle: attack +1, defend shield +1.",
      ko: "즉시 HP/MP 회복. 다음 전투: 공격 +1, 방어막 +1.",
    },
  },
  "field-forged-gear": {
    name: {
      en: "Forge Field Gear",
      ko: "야전 장비를 벼린다",
    },
    description: {
      en: "Heat scraps over the flame until one useful shape answers.",
      ko: "잔해를 불 위에 달궈 쓸 만한 형태 하나가 대답할 때까지 벼린다.",
    },
    effect: {
      en: "Creates and equips one available equipment piece.",
      ko: "아직 장착하지 않은 장비 하나를 제작해 즉시 장착한다.",
    },
  },
} as const satisfies Record<string, BonfireRecipeTextEntry>;
