import type { MonsterIntent } from "@/entities/monster";
import type { PlayerStats } from "@/entities/player";
import type { ActionTargeting, Element, Spell, SpellMode } from "@/entities/spell";

export type BattleTargetSide = "player" | "enemy";

/**
 * 전투 명령이 겨냥할 수 있는 대상 선택지다.
 */
export interface BattleTargetOption {
  id: string;
  name: string;
  side: BattleTargetSide;
}

export const PLAYER_TARGET_ID = "player";
export const MONSTER_TARGET_ID = "monster";

/**
 * 아직 대상이 확정되지 않은 플레이어 행동 초안이다.
 */
export type PlayerActionDraft =
  | { type: "attack" }
  | { type: "defend" }
  | { type: "heal" }
  | { type: "spell"; spell: Spell; mode: SpellMode };

/**
 * 실제 대상까지 확정된 플레이어 행동이다.
 */
export type PlayerAction =
  | { type: "attack"; targetId: string }
  | { type: "defend"; targetId: string }
  | { type: "heal"; targetId: string }
  | { type: "spell"; spell: Spell; mode: SpellMode; targetId: string };

/**
 * 전투 로그 한 줄의 표시 데이터다.
 */
export interface BattleLogEntry {
  text: string;
  color?: string;
}

/**
 * 전투 중 발사체 및 피격 연출에 넘기는 요청 객체다.
 */
export interface CombatAnimationRequest {
  word: string;
  fromPlayer: boolean;
  targetId: string;
  targetSide: BattleTargetSide;
  kind?: "projectile" | "crescent-slash";
  element?: Element;
  shielded?: boolean;
  blocked?: boolean;
  missed?: boolean;
  critical?: boolean;
  impactDamage?: number;
  onImpact?: () => void;
}

const TEST_NON_SELF_HIT_CHANCE = 0.85;

function clampChance(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 기본 물리 공격의 명중 확률을 계산한다.
 */
function getAttackHitChance(
  _stats: PlayerStats,
  targetSide: BattleTargetSide,
): number {
  if (targetSide === "player") return 1;
  return clampChance(TEST_NON_SELF_HIT_CHANCE, 0, 1);
}

/**
 * 주문 공격의 명중 확률을 계산한다.
 */
function getSpellHitChance(
  _stats: PlayerStats,
  targetSide: BattleTargetSide,
): number {
  if (targetSide === "player") return 1;
  return clampChance(TEST_NON_SELF_HIT_CHANCE, 0, 1);
}

/**
 * 기본 물리 공격의 치명타 확률을 계산한다.
 */
function getAttackCritChance(stats: PlayerStats): number {
  return clampChance(0.05 + stats.strength * 0.01, 0.05, 0.45);
}

/**
 * 공격형 주문의 치명타 확률을 계산한다.
 */
function getSpellCritChance(stats: PlayerStats): number {
  return clampChance(0.05 + stats.literacy * 0.01, 0.05, 0.45);
}

/**
 * 치명타 배율을 적용한 최종 피해량을 계산한다.
 */
export function getCriticalDamage(baseDamage: number): number {
  return Math.max(1, Math.round(baseDamage * 1.5));
}

/**
 * 행동 초안이 요구하는 타깃 범위를 반환한다.
 */
export function getActionTargeting(action: PlayerActionDraft): ActionTargeting {
  switch (action.type) {
    case "attack":
      return "single";
    case "defend":
    case "heal":
      return "self";
    case "spell":
      return action.mode === "attack"
        ? action.spell.attackTargeting
        : (action.spell.defendTargeting ?? "self");
  }
}

/**
 * 행동 종류와 대상 진영을 기준으로 명중 확률을 계산한다.
 */
export function getActionHitChance(
  action: PlayerActionDraft | PlayerAction,
  stats: PlayerStats,
  targetSide: BattleTargetSide,
): number {
  switch (action.type) {
    case "attack":
      return getAttackHitChance(stats, targetSide);
    case "spell":
      return action.mode === "attack" ? getSpellHitChance(stats, targetSide) : 1;
    case "defend":
    case "heal":
      return 1;
  }
}

/**
 * 행동 종류와 대상 진영을 기준으로 치명타 확률을 계산한다.
 */
export function getActionCritChance(
  action: PlayerActionDraft | PlayerAction,
  stats: PlayerStats,
  targetSide?: BattleTargetSide,
): number {
  void targetSide;
  switch (action.type) {
    case "attack":
      return getAttackCritChance(stats);
    case "spell":
      return action.mode === "attack" ? getSpellCritChance(stats) : 0;
    case "defend":
    case "heal":
      return 0;
  }
}

/**
 * 몬스터 다음 행동 힌트를 위한 읽기 전용 타입 별칭이다.
 */
export type CombatMonsterIntent = MonsterIntent;
