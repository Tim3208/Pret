import {
  type EquipmentDefinition,
  type EquippedItems,
  rollEquipmentOffer,
} from "@/entities/equipment";
import type { PlayerStats } from "@/entities/player";

export const BATTLES_PER_BONFIRE = 2;
export const MAX_RUN_POTION_CHARGES = 3;

export type BonfireSessionMode = "idle" | "maintenance" | "rested";

export interface BonfireSession {
  cookCount: number;
  craftCount: number;
  mode: BonfireSessionMode;
  restUsed: boolean;
}

export interface BonfireMealEffect {
  attackDamageBonus: number;
  id: "ember-stew";
  shieldOnDefendBonus: number;
}

export type JourneyScene = "battle-1" | "event" | "battle-2" | "bonfire";
export type JourneyNodeState = "cleared" | "current" | "upcoming";
export type RunEventCategory = "reward" | "choice" | "risk";
export type RunEventKind =
  | "equipment"
  | "experience"
  | "potion"
  | "choice"
  | "scar"
  | "ambush";

export interface JourneyNode {
  id: JourneyScene;
  state: JourneyNodeState;
}

export interface JourneyStatus {
  currentScene: JourneyScene;
  nodes: JourneyNode[];
  scenesUntilBonfire: number;
}

interface BaseRunEvent {
  category: RunEventCategory;
  id: string;
  kind: RunEventKind;
}

export interface EquipmentRunEvent extends BaseRunEvent {
  category: "reward";
  kind: "equipment";
  item: EquipmentDefinition;
}

export interface ExperienceRunEvent extends BaseRunEvent {
  category: "reward";
  experience: number;
  kind: "experience";
}

export interface PotionRunEvent extends BaseRunEvent {
  category: "reward";
  kind: "potion";
  potionCharges: number;
}

export interface ChoiceRunEvent extends BaseRunEvent {
  category: "choice";
  experience: number;
  kind: "choice";
  potionCharges: number;
}

export interface ScarRunEvent extends BaseRunEvent {
  category: "risk";
  experience: number;
  kind: "scar";
  maxHpPenalty: number;
}

export interface AmbushRunEvent extends BaseRunEvent {
  category: "risk";
  damage: number;
  kind: "ambush";
  potionCharges: number;
}

export type RunEvent =
  | EquipmentRunEvent
  | ExperienceRunEvent
  | PotionRunEvent
  | ChoiceRunEvent
  | ScarRunEvent
  | AmbushRunEvent;

export type RunEventResolution =
  | { kind: "decline" }
  | { item: EquipmentDefinition; kind: "equipment" }
  | { experience: number; kind: "experience" }
  | { kind: "potion"; potionCharges: number }
  | { experience: number; kind: "choice-experience" }
  | { kind: "choice-potion"; potionCharges: number }
  | { experience: number; kind: "scar"; maxHpPenalty: number }
  | { damage: number; kind: "ambush"; potionCharges: number };

interface WeightedEntry<TValue> {
  value: TValue;
  weight: number;
}

export interface RollRunEventParams {
  currentMaxHp: number;
  depth: number;
  effectiveStats: PlayerStats;
  equippedItems: EquippedItems;
  previousOfferId?: string | null;
}

export interface RollRunEventResult {
  event: RunEvent;
  offeredItemId: string | null;
}

const JOURNEY_ORDER: readonly JourneyScene[] = [
  "battle-1",
  "event",
  "battle-2",
  "bonfire",
];

/**
 * 새 모닥불 방문에서 사용할 정비 세션 상태를 만든다.
 *
 * @returns 아무 행동도 고르지 않은 모닥불 세션
 */
export function createBonfireSession(): BonfireSession {
  return {
    cookCount: 0,
    craftCount: 0,
    mode: "idle",
    restUsed: false,
  };
}

/**
 * 현재 모닥불 세션에서 휴식이 가능한지 판정한다.
 *
 * @param session 현재 모닥불 정비 세션
 * @returns 휴식 가능 여부
 */
export function canRestAtBonfire(session: BonfireSession): boolean {
  return session.mode === "idle" && !session.restUsed;
}

/**
 * 현재 모닥불 세션에서 제작이나 요리가 가능한지 판정한다.
 *
 * @param session 현재 모닥불 정비 세션
 * @returns 제작/요리 가능 여부
 */
export function canMaintainAtBonfire(session: BonfireSession): boolean {
  return session.mode !== "rested";
}

/**
 * 휴식을 실행한 뒤의 모닥불 세션 상태를 만든다.
 *
 * @param session 현재 모닥불 정비 세션
 * @returns 휴식이 기록된 세션
 */
export function markBonfireRested(session: BonfireSession): BonfireSession {
  return {
    ...session,
    mode: "rested",
    restUsed: true,
  };
}

/**
 * 제작을 실행한 뒤의 모닥불 세션 상태를 만든다.
 *
 * @param session 현재 모닥불 정비 세션
 * @returns 제작 횟수가 기록된 세션
 */
export function markBonfireCrafted(session: BonfireSession): BonfireSession {
  return {
    ...session,
    craftCount: session.craftCount + 1,
    mode: "maintenance",
  };
}

/**
 * 요리를 실행한 뒤의 모닥불 세션 상태를 만든다.
 *
 * @param session 현재 모닥불 정비 세션
 * @returns 요리 횟수가 기록된 세션
 */
export function markBonfireCooked(session: BonfireSession): BonfireSession {
  return {
    ...session,
    cookCount: session.cookCount + 1,
    mode: "maintenance",
  };
}

function pickWeightedValue<TValue>(entries: readonly WeightedEntry<TValue>[]): TValue {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return entries[0].value;
  }

  let threshold = Math.random() * totalWeight;
  for (const entry of entries) {
    threshold -= entry.weight;
    if (threshold <= 0) {
      return entry.value;
    }
  }

  return entries[entries.length - 1].value;
}

/**
 * 깊이와 현재 장면으로 모닥불까지의 고정 경로 상태를 계산한다.
 *
 * @param depth 현재 누적 전투 깊이
 * @param phase 현재 장면 종류
 * @returns 현재 위치와 남은 경로 노드 상태
 */
export function getJourneyStatus(
  depth: number,
  phase: "battle" | "event" | "bonfire",
): JourneyStatus {
  const normalizedDepth = Math.max(0, depth);
  const currentScene: JourneyScene = phase === "bonfire"
    ? "bonfire"
    : phase === "event"
      ? "event"
      : normalizedDepth % BATTLES_PER_BONFIRE === 0
        ? "battle-1"
        : "battle-2";
  const currentIndex = JOURNEY_ORDER.indexOf(currentScene);

  return {
    currentScene,
    nodes: JOURNEY_ORDER.map((id, index) => ({
      id,
      state:
        index < currentIndex
          ? "cleared"
          : index === currentIndex
            ? "current"
            : "upcoming",
    })),
    scenesUntilBonfire: Math.max(0, JOURNEY_ORDER.length - currentIndex - 1),
  };
}

/**
 * 장비 포함 유효 스펙을 하나의 전투 강도 값으로 환산한다.
 *
 * @param stats 현재 장비 보정이 반영된 플레이어 능력치
 * @returns 전투 강도를 나타내는 단일 점수
 */
export function getEffectiveCombatPower(stats: PlayerStats): number {
  return (
    stats.strength * 1.35
    + stats.agility * 1.15
    + stats.decipher * 0.55
    + stats.combination * 0.95
    + stats.stability * 0.9
  );
}

/**
 * 첫 전투 뒤에 배치할 런 이벤트를 가중치 기반으로 선택한다.
 *
 * @param params 현재 깊이, 체력, 장비 상태
 * @returns 이번 사이클에 사용할 이벤트와 연속 등장 방지용 장비 ID
 */
export function rollRunEvent({
  currentMaxHp,
  depth,
  effectiveStats,
  equippedItems,
  previousOfferId,
}: RollRunEventParams): RollRunEventResult {
  const rewardBaseExperience = 6 + Math.max(0, depth) * 2;
  const power = getEffectiveCombatPower(effectiveStats);
  const offeredItem = rollEquipmentOffer(equippedItems, previousOfferId);
  const rewardCandidates: RunEvent[] = [
    {
      category: "reward",
      experience: rewardBaseExperience,
      id: "ember-cache",
      kind: "experience",
    },
    {
      category: "reward",
      id: "sealed-flask",
      kind: "potion",
      potionCharges: 1,
    },
  ];

  if (offeredItem) {
    rewardCandidates.push({
      category: "reward",
      id: `equipment-${offeredItem.id}`,
      item: offeredItem,
      kind: "equipment",
    });
  }

  const choiceEvent: ChoiceRunEvent = {
    category: "choice",
    experience: rewardBaseExperience + 2,
    id: "split-cache",
    kind: "choice",
    potionCharges: 1,
  };
  const riskCandidates: RunEvent[] = [
    {
      category: "risk",
      experience: rewardBaseExperience + 5,
      id: "cinder-brand",
      kind: "scar",
      maxHpPenalty: Math.min(8, Math.max(2, Math.round(currentMaxHp * 0.12))),
    },
    {
      category: "risk",
      damage: Math.min(9, Math.max(3, Math.round(currentMaxHp * 0.18))),
      id: "grave-ambush",
      kind: "ambush",
      potionCharges: 1,
    },
  ];
  const category = pickWeightedValue<RunEventCategory>([
    { value: "reward", weight: 0.55 + (offeredItem ? 0.08 : 0) },
    { value: "choice", weight: 0.3 },
    { value: "risk", weight: 0.15 + Math.min(0.08, power * 0.01) },
  ]);

  const event = category === "reward"
    ? pickWeightedValue(
      rewardCandidates.map((candidate) => ({
        value: candidate,
        weight: candidate.kind === "equipment" ? 0.95 : 1,
      })),
    )
    : category === "choice"
      ? choiceEvent
      : pickWeightedValue(riskCandidates.map((candidate) => ({ value: candidate, weight: 1 })));

  return {
    event,
    offeredItemId: event.kind === "equipment" ? event.item.id : previousOfferId ?? null,
  };
}
