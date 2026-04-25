import {
  EQUIPMENT_SLOT_LABEL_TEXT,
  EQUIPMENT_TEXT,
} from "@/content/catalog/equipment/equipmentText";
import type { PlayerStats } from "@/entities/player";

export type LocalizedCopy = Record<"en" | "ko", string>;

export type EquipmentSlot =
  | "head"
  | "necklace"
  | "shoulders"
  | "cloak"
  | "bracelet";

/**
 * 장비가 전투 계산에 제공하는 수치 보정값이다.
 */
export interface EquipmentModifiers {
  strength?: number;
  agility?: number;
  decipher?: number;
  combination?: number;
  stability?: number;
  maxHp?: number;
  maxMana?: number;
  shieldOnDefend?: number;
}

export interface AppliedEquipmentStats {
  stats: PlayerStats;
  maxHpBonus: number;
  maxManaBonus: number;
  shieldOnDefendBonus: number;
}

/**
 * ASCII 장비를 캐릭터 위에 배치하기 위한 앵커 정보다.
 */
export interface EquipmentAnchor {
  leftPercent: number;
  topPercent: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  scale: number;
  tooltipSide: "above" | "left" | "right";
}

/**
 * 장비에 적용할 색 강조 범위다.
 */
export interface EquipmentTintRange {
  row: number;
  startColumn: number;
  endColumn: number;
}

/**
 * 장비의 텍스트, ASCII, 배치, 보정 정보를 함께 담는 정의다.
 */
export interface EquipmentDefinition {
  id: string;
  slot: EquipmentSlot;
  name: LocalizedCopy;
  flavorText: LocalizedCopy;
  effectText: LocalizedCopy;
  fragment: string;
  fragmentTone: string;
  equippedAscii: string[];
  offerAscii: string[];
  anchor: EquipmentAnchor;
  tintRanges: EquipmentTintRange[];
  modifiers: EquipmentModifiers;
}

export type EquippedItems = Partial<Record<EquipmentSlot, EquipmentDefinition>>;

/**
 * 현재 전투 루프에서 제안 가능한 장비 목록이다.
 */
export const EQUIPMENT_POOL: EquipmentDefinition[] = [
  {
    id: "cinder-diadem",
    slot: "head",
    ...EQUIPMENT_TEXT["cinder-diadem"],
    fragment: "ASH",
    fragmentTone: "rgba(255, 181, 110, 0.96)",
    equippedAscii: [
      "   .-^^-.   ",
      " _/#####\\_ ",
      "/#########\\",
      "\\__#####__/",
    ],
    offerAscii: [
      "      .-^^^^-.      ",
      "   .-########-.     ",
      " _/############\\_  ",
      "/################\\ ",
      "|################| ",
      "\\__############__/ ",
      "   '--.______.--'   ",
    ],
    anchor: {
      leftPercent: 19,
      topPercent: 20,
      offsetX: 15,
      offsetY: -18,
      rotationDeg: -2,
      scale: 0.95,
      tooltipSide: "right",
    },
    tintRanges: [
      { row: 1, startColumn: 13, endColumn: 16 },
      { row: 2, startColumn: 12, endColumn: 18 },
      { row: 3, startColumn: 13, endColumn: 18 },
      { row: 4, startColumn: 11, endColumn: 18 },
      { row: 5, startColumn: 11, endColumn: 17 },
    ],
    modifiers: {
      decipher: 1,
      stability: 1,
    },
  },
  {
    id: "whisper-locket",
    slot: "necklace",
    ...EQUIPMENT_TEXT["whisper-locket"],
    fragment: "MUR",
    fragmentTone: "rgba(255, 61, 61, 0.95)",
    equippedAscii: [
      "  .---.  ",
      " / o o\\ ",
      " \\_V_/  ",
    ],
    offerAscii: [
      "    .-----.    ",
      "  .'  o o  '.  ",
      " /___\\V//___\\ ",
      "     /_\\      ",
    ],
    anchor: {
      leftPercent: 23,
      topPercent: 32,
      offsetX: 6,
      offsetY: -4,
      rotationDeg: -4,
      scale: 0.94,
      tooltipSide: "right",
    },
    tintRanges: [
      { row: 7, startColumn: 14, endColumn: 16 },
      { row: 8, startColumn: 15, endColumn: 16 },
    ],
    modifiers: {
      maxMana: 4,
    },
  },
  {
    id: "graveshard-spaulder",
    slot: "shoulders",
    ...EQUIPMENT_TEXT["graveshard-spaulder"],
    fragment: "WARD",
    fragmentTone: "rgba(136, 214, 158, 0.84)",
    equippedAscii: [
      " _[###  ",
      "[#####= ",
      " '----  ",
    ],
    offerAscii: [
      "   __[#####   ",
      " _[########=  ",
      "[##########=  ",
      " '--._____.'  ",
    ],
    anchor: {
      leftPercent: 40,
      topPercent: 30,
      offsetX: -6,
      offsetY: -2,
      rotationDeg: -12,
      scale: 0.88,
      tooltipSide: "right",
    },
    tintRanges: [
      { row: 6, startColumn: 17, endColumn: 21 },
      { row: 7, startColumn: 18, endColumn: 23 },
      { row: 8, startColumn: 18, endColumn: 24 },
      { row: 9, startColumn: 19, endColumn: 25 },
      { row: 10, startColumn: 19, endColumn: 26 },
    ],
    modifiers: {
      shieldOnDefend: 2,
    },
  },
  {
    id: "night-tithe-cloak",
    slot: "cloak",
    ...EQUIPMENT_TEXT["night-tithe-cloak"],
    fragment: "VEIL",
    fragmentTone: "rgba(164, 152, 255, 0.94)",
    equippedAscii: [
      " /~~~~\\ ",
      "| ~~~~ |",
      " \\____/ ",
    ],
    offerAscii: [
      "   /~~~~~~\\   ",
      "  /~~~~~~~~\\  ",
      " | ~~~~~~~~ |  ",
      "  \\______. /  ",
    ],
    anchor: {
      leftPercent: 30,
      topPercent: 51,
      offsetX: -10,
      offsetY: 6,
      rotationDeg: -10,
      scale: 0.92,
      tooltipSide: "right",
    },
    tintRanges: [
      { row: 9, startColumn: 8, endColumn: 20 },
      { row: 10, startColumn: 7, endColumn: 21 },
      { row: 11, startColumn: 6, endColumn: 22 },
      { row: 12, startColumn: 5, endColumn: 23 },
      { row: 13, startColumn: 4, endColumn: 24 },
      { row: 14, startColumn: 3, endColumn: 25 },
      { row: 15, startColumn: 2, endColumn: 26 },
      { row: 16, startColumn: 1, endColumn: 27 },
      { row: 17, startColumn: 0, endColumn: 28 },
      { row: 18, startColumn: -1, endColumn: 29 },
    ],
    modifiers: {
      maxHp: 4,
    },
  },
  {
    id: "oathcoil-bracelet",
    slot: "bracelet",
    ...EQUIPMENT_TEXT["oathcoil-bracelet"],
    fragment: "KNOT",
    fragmentTone: "rgba(255, 132, 132, 0.95)",
    equippedAscii: [
      "  .--.  ",
      " /====\\ ",
      " \\____/ ",
    ],
    offerAscii: [
      "    .----.    ",
      "  .'======'.  ",
      " /==========\\ ",
      " \\__________/ ",
    ],
    anchor: {
      leftPercent: 60,
      topPercent: 59,
      offsetX: 18,
      offsetY: 4,
      rotationDeg: 10,
      scale: 0.9,
      tooltipSide: "left",
    },
    tintRanges: [
      { row: 14, startColumn: 36, endColumn: 38 },
      { row: 15, startColumn: 36, endColumn: 38 },
    ],
    modifiers: {
      strength: 1,
      agility: 1,
    },
  },
];

/**
 * 장비 배열을 슬롯 기반 맵으로 변환한다.
 */
export function buildEquippedItems(
  items: EquipmentDefinition[],
): EquippedItems {
  return items.reduce<EquippedItems>((result, item) => {
    result[item.slot] = item;
    return result;
  }, {});
}

/**
 * 개발 중 기본 장착 상태를 빠르게 재현하기 위한 시작 장비 세트다.
 */
export const TEST_START_EQUIPPED_ITEMS: EquippedItems = buildEquippedItems(
  EQUIPMENT_POOL,
);

/**
 * 장비 슬롯의 표시 라벨을 현재 언어에 맞게 반환한다.
 */
export function getEquipmentSlotLabel(
  slot: EquipmentSlot,
  language: "en" | "ko",
): string {
  return EQUIPMENT_SLOT_LABEL_TEXT[slot][language];
}

/**
 * 현재 장착 중인 장비만 배열 형태로 추출한다.
 */
export function getEquippedItems(
  equippedItems: EquippedItems,
): EquipmentDefinition[] {
  return Object.values(equippedItems).filter(
    (item): item is EquipmentDefinition => Boolean(item),
  );
}

/**
 * 장착한 장비 보정치를 현재 플레이어 능력치와 전투 보너스에 적용한다.
 */
export function applyEquipmentModifiers(
  baseStats: PlayerStats,
  equippedItems: EquippedItems,
): AppliedEquipmentStats {
  const totals: AppliedEquipmentStats = {
    stats: { ...baseStats },
    maxHpBonus: 0,
    maxManaBonus: 0,
    shieldOnDefendBonus: 0,
  };

  for (const item of getEquippedItems(equippedItems)) {
    totals.stats.strength += item.modifiers.strength ?? 0;
    totals.stats.agility += item.modifiers.agility ?? 0;
    totals.stats.decipher += item.modifiers.decipher ?? 0;
    totals.stats.combination += item.modifiers.combination ?? 0;
    totals.stats.stability += item.modifiers.stability ?? 0;
    totals.maxHpBonus += item.modifiers.maxHp ?? 0;
    totals.maxManaBonus += item.modifiers.maxMana ?? 0;
    totals.shieldOnDefendBonus += item.modifiers.shieldOnDefend ?? 0;
  }

  return totals;
}

/**
 * 아직 제안 가능한 장비 후보만 반환한다.
 */
export function getOfferableEquipmentItems(
  equippedItems: EquippedItems,
): EquipmentDefinition[] {
  const equippedIds = new Set(getEquippedItems(equippedItems).map((item) => item.id));
  return EQUIPMENT_POOL.filter((item) => !equippedIds.has(item.id));
}

/**
 * 남은 제안 장비가 모두 소진되었는지 판별한다.
 */
export function isEquipmentPoolExhausted(
  equippedItems: EquippedItems,
): boolean {
  return getOfferableEquipmentItems(equippedItems).length === 0;
}

/**
 * 현재 상태에서 다음 전투 후 이벤트에 제시할 장비를 선택한다.
 */
export function rollEquipmentOffer(
  equippedItems: EquippedItems,
  previousOfferId?: string | null,
): EquipmentDefinition | null {
  const available = getOfferableEquipmentItems(equippedItems);
  if (available.length === 0) {
    return null;
  }

  const headTestItem = available.find((item) => item.slot === "head");
  if (headTestItem) {
    return headTestItem;
  }

  const withoutImmediateRepeat =
    previousOfferId && available.length > 1
      ? available.filter((item) => item.id !== previousOfferId)
      : available;
  const source = withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : available;
  return source[Math.floor(Math.random() * source.length)] ?? null;
}
