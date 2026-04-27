export type InventoryItemCategory = "material" | "equipment" | "consumable" | "quest";

export type InventoryItemId =
  | "ashen-sigil"
  | "beast-scrap"
  | "ember-shard"
  | "wild-herb";

export interface InventoryStack {
  category: InventoryItemCategory;
  id: InventoryItemId;
  quantity: number;
}

export type RunInventory = Partial<Record<InventoryItemId, InventoryStack>>;

export interface InventoryRequirement {
  id: InventoryItemId;
  quantity: number;
}

export type BonfireRecipeId =
  | "ashen-sigil"
  | "ember-stew"
  | "field-forged-gear";

export type BonfireRecipeKind = "craft" | "cook";

export interface BonfireRecipeDefinition {
  id: BonfireRecipeId;
  kind: BonfireRecipeKind;
  requirements: InventoryRequirement[];
}

export const BONFIRE_MATERIAL_REWARDS: InventoryRequirement[] = [
  { id: "ember-shard", quantity: 1 },
  { id: "beast-scrap", quantity: 1 },
];

export const POST_EVENT_MATERIAL_REWARDS: InventoryRequirement[] = [
  { id: "wild-herb", quantity: 1 },
];

export const BONFIRE_RECIPES: Record<BonfireRecipeId, BonfireRecipeDefinition> = {
  "ashen-sigil": {
    id: "ashen-sigil",
    kind: "craft",
    requirements: [
      { id: "ember-shard", quantity: 1 },
      { id: "wild-herb", quantity: 1 },
    ],
  },
  "ember-stew": {
    id: "ember-stew",
    kind: "cook",
    requirements: [
      { id: "wild-herb", quantity: 1 },
      { id: "beast-scrap", quantity: 1 },
    ],
  },
  "field-forged-gear": {
    id: "field-forged-gear",
    kind: "craft",
    requirements: [
      { id: "ember-shard", quantity: 2 },
      { id: "beast-scrap", quantity: 1 },
    ],
  },
};

const INVENTORY_ITEM_CATEGORIES: Record<InventoryItemId, InventoryItemCategory> = {
  "ashen-sigil": "quest",
  "beast-scrap": "material",
  "ember-shard": "material",
  "wild-herb": "material",
};

/**
 * 비어 있는 런 인벤토리를 만든다.
 *
 * @returns 아이템 스택이 없는 인벤토리
 */
export function createEmptyInventory(): RunInventory {
  return {};
}

/**
 * 아이템 ID에 맞는 인벤토리 카테고리를 반환한다.
 *
 * @param id 조회할 아이템 ID
 * @returns 아이템의 기본 카테고리
 */
export function getInventoryItemCategory(id: InventoryItemId): InventoryItemCategory {
  return INVENTORY_ITEM_CATEGORIES[id];
}

/**
 * 인벤토리에 들어 있는 특정 아이템 수량을 반환한다.
 *
 * @param inventory 현재 런 인벤토리
 * @param id 조회할 아이템 ID
 * @returns 보유 수량
 */
export function getInventoryQuantity(
  inventory: RunInventory,
  id: InventoryItemId,
): number {
  return inventory[id]?.quantity ?? 0;
}

/**
 * 인벤토리에 아이템 한 종류를 더한다.
 *
 * @param inventory 현재 런 인벤토리
 * @param item 더할 아이템과 수량
 * @returns 아이템이 추가된 새 인벤토리
 */
export function addInventoryItem(
  inventory: RunInventory,
  item: InventoryRequirement,
): RunInventory {
  if (item.quantity <= 0) {
    return inventory;
  }

  const current = inventory[item.id];
  return {
    ...inventory,
    [item.id]: {
      category: current?.category ?? getInventoryItemCategory(item.id),
      id: item.id,
      quantity: (current?.quantity ?? 0) + item.quantity,
    },
  };
}

/**
 * 인벤토리에 여러 아이템을 순서대로 더한다.
 *
 * @param inventory 현재 런 인벤토리
 * @param items 더할 아이템 목록
 * @returns 모든 아이템이 추가된 새 인벤토리
 */
export function addInventoryItems(
  inventory: RunInventory,
  items: readonly InventoryRequirement[],
): RunInventory {
  return items.reduce<RunInventory>(
    (nextInventory, item) => addInventoryItem(nextInventory, item),
    inventory,
  );
}

/**
 * 요구 재료를 모두 보유했는지 검사한다.
 *
 * @param inventory 현재 런 인벤토리
 * @param requirements 필요한 아이템 목록
 * @returns 모든 요구량 충족 여부
 */
export function hasInventoryItems(
  inventory: RunInventory,
  requirements: readonly InventoryRequirement[],
): boolean {
  return requirements.every(
    (requirement) => getInventoryQuantity(inventory, requirement.id) >= requirement.quantity,
  );
}

/**
 * 부족한 요구 재료만 추려 반환한다.
 *
 * @param inventory 현재 런 인벤토리
 * @param requirements 필요한 아이템 목록
 * @returns 부족한 아이템과 수량 목록
 */
export function getMissingInventoryItems(
  inventory: RunInventory,
  requirements: readonly InventoryRequirement[],
): InventoryRequirement[] {
  return requirements
    .map((requirement) => ({
      id: requirement.id,
      quantity: Math.max(0, requirement.quantity - getInventoryQuantity(inventory, requirement.id)),
    }))
    .filter((requirement) => requirement.quantity > 0);
}

/**
 * 요구 재료를 소비하고 결과를 반환한다.
 *
 * @param inventory 현재 런 인벤토리
 * @param requirements 소비할 아이템 목록
 * @returns 소비 성공 여부와 갱신된 인벤토리
 */
export function consumeInventoryItems(
  inventory: RunInventory,
  requirements: readonly InventoryRequirement[],
): {
  inventory: RunInventory;
  missing: InventoryRequirement[];
  success: boolean;
} {
  const missing = getMissingInventoryItems(inventory, requirements);
  if (missing.length > 0) {
    return { inventory, missing, success: false };
  }

  const nextInventory = { ...inventory };
  for (const requirement of requirements) {
    const current = nextInventory[requirement.id];
    if (!current) {
      continue;
    }

    const nextQuantity = current.quantity - requirement.quantity;
    if (nextQuantity <= 0) {
      delete nextInventory[requirement.id];
    } else {
      nextInventory[requirement.id] = {
        ...current,
        quantity: nextQuantity,
      };
    }
  }

  return { inventory: nextInventory, missing: [], success: true };
}

/**
 * 표시 가능한 인벤토리 스택 배열을 만든다.
 *
 * @param inventory 현재 런 인벤토리
 * @returns 수량이 남아 있는 스택 목록
 */
export function getInventoryStacks(inventory: RunInventory): InventoryStack[] {
  return Object.values(inventory).filter(
    (stack): stack is InventoryStack => Boolean(stack && stack.quantity > 0),
  );
}
