import type { MonsterIntent } from "@/entities/monster";
import {
  getBaseAttackDamage,
  getBaseShield,
  type PlayerStats,
} from "@/entities/player";
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

export type PromptVerb = "attack" | "defend";
export type PromptSpecialWord = "MOR" | "UBT" | "XLEW";
export type PromptTokenKind = "verb" | "connector" | "contrast" | "rune" | "unknown";
export type PromptOutcome = "stable" | "risky" | "failure";
export type PromptFailureReason =
  | "empty"
  | "unknown-token"
  | "invalid-order"
  | "dangling-connector"
  | "dangling-rune"
  | "too-many-actions"
  | "rune-needs-attack"
  | "stability-overload";

export interface PromptToken {
  raw: string;
  normalized: string;
  kind: PromptTokenKind;
  verb?: PromptVerb;
  specialWord?: PromptSpecialWord;
}

export interface PromptActionStep {
  verb: PromptVerb;
  rune: boolean;
  contrast: boolean;
}

/**
 * word prompt 구문을 해석한 결과와 판정용 파생치를 담는다.
 */
export interface PromptEvaluation {
  rawText: string;
  normalizedText: string;
  tokens: PromptToken[];
  outcome: PromptOutcome;
  failureReason: PromptFailureReason | null;
  syntaxValid: boolean;
  steps: PromptActionStep[];
  connectorCount: number;
  contrastCount: number;
  runeCount: number;
  combinationLoad: number;
  stabilityCost: number;
  combinationAdequate: boolean;
  attackDamage: number;
  shieldGain: number;
  selfHpCost: number;
  selfManaCost: number;
  element?: Element;
}

/**
 * 실제 대상까지 확정된 플레이어 행동이다.
 */
export type PlayerAction =
  | { type: "attack"; targetId: string }
  | { type: "defend"; targetId: string }
  | { type: "heal"; targetId: string }
  | { type: "spell"; spell: Spell; mode: SpellMode; targetId: string }
  | { type: "prompt"; evaluation: PromptEvaluation };

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
const PROMPT_CONNECTOR = "mor";
const PROMPT_CONTRAST = "ubt";
const PROMPT_RUNE = "xlew";
const ATTACK_ALIASES = new Set(["attack", "공격"]);
const DEFEND_ALIASES = new Set(["defense", "defend", "방어"]);

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
  return clampChance(0.05 + stats.stability * 0.01, 0.05, 0.45);
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
    case "prompt":
      return action.evaluation.attackDamage > 0 ? getAttackHitChance(stats, targetSide) : 1;
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
    case "prompt":
      return action.evaluation.attackDamage > 0 ? getAttackCritChance(stats) : 0;
    case "spell":
      return action.mode === "attack" ? getSpellCritChance(stats) : 0;
    case "defend":
    case "heal":
      return 0;
  }
}

function tokenizePromptWord(raw: string): PromptToken {
  const normalized = raw.trim().toLowerCase();

  if (ATTACK_ALIASES.has(normalized)) {
    return { raw, normalized, kind: "verb", verb: "attack" };
  }

  if (DEFEND_ALIASES.has(normalized)) {
    return { raw, normalized, kind: "verb", verb: "defend" };
  }

  if (normalized === PROMPT_CONNECTOR) {
    return { raw, normalized, kind: "connector", specialWord: "MOR" };
  }

  if (normalized === PROMPT_CONTRAST) {
    return { raw, normalized, kind: "contrast", specialWord: "UBT" };
  }

  if (normalized === PROMPT_RUNE) {
    return { raw, normalized, kind: "rune", specialWord: "XLEW" };
  }

  return { raw, normalized, kind: "unknown" };
}

/**
 * 프롬프트 문장을 토큰화하고 전투용 결과치로 평가한다.
 */
export function evaluatePromptAction(
  input: string,
  stats: PlayerStats,
): PromptEvaluation {
  const rawText = input.trim();
  if (!rawText) {
    return {
      rawText,
      normalizedText: "",
      tokens: [],
      outcome: "failure",
      failureReason: "empty",
      syntaxValid: false,
      steps: [],
      connectorCount: 0,
      contrastCount: 0,
      runeCount: 0,
      combinationLoad: 0,
      stabilityCost: 0,
      combinationAdequate: true,
      attackDamage: 0,
      shieldGain: 0,
      selfHpCost: 5,
      selfManaCost: 3,
    };
  }

  const parts = rawText.split(/\s+/).filter(Boolean);
  const tokens = parts.map(tokenizePromptWord);
  const normalizedText = tokens.map((token) => token.normalized).join(" ");
  const hasUnknownToken = tokens.some((token) => token.kind === "unknown");

  let syntaxValid = !hasUnknownToken;
  let failureReason: PromptFailureReason | null = hasUnknownToken ? "unknown-token" : null;
  let connectorCount = 0;
  let contrastCount = 0;
  let runeCount = 0;
  let expectVerb = true;
  let pendingRune = false;
  const steps: PromptActionStep[] = [];

  for (let index = 0; index < tokens.length && syntaxValid; index += 1) {
    const token = tokens[index];

    if (expectVerb) {
      if (token.kind === "rune") {
        if (index === tokens.length - 1) {
          steps.push({
            verb: "attack",
            rune: true,
            contrast: false,
          });
          runeCount += 1;
          expectVerb = false;
          pendingRune = false;
          continue;
        }

        if (pendingRune) {
          syntaxValid = false;
          failureReason = "invalid-order";
          break;
        }

        pendingRune = true;
        runeCount += 1;
        continue;
      }

      if (token.kind !== "verb" || !token.verb) {
        syntaxValid = false;
        failureReason = token.kind === "connector" ? "dangling-connector" : "invalid-order";
        break;
      }

      steps.push({
        verb: token.verb,
        rune: pendingRune,
        contrast: false,
      });
      pendingRune = false;
      expectVerb = false;
      continue;
    }

    if (token.kind === "connector") {
      if (connectorCount >= 1 || steps.length >= 2) {
        syntaxValid = false;
        failureReason = "too-many-actions";
        break;
      }

      connectorCount += 1;
      expectVerb = true;
      continue;
    }

    if (token.kind === "contrast") {
      if (contrastCount >= 1 || index !== tokens.length - 1 || steps.length === 0) {
        syntaxValid = false;
        failureReason = "invalid-order";
        break;
      }

      steps[steps.length - 1].contrast = true;
      contrastCount += 1;
      continue;
    }

    syntaxValid = false;
    failureReason = "invalid-order";
  }

  if (syntaxValid && expectVerb) {
    syntaxValid = false;
    failureReason = pendingRune ? "dangling-rune" : "dangling-connector";
  }

  if (syntaxValid && pendingRune) {
    syntaxValid = false;
    failureReason = "dangling-rune";
  }

  if (syntaxValid && steps.some((step) => step.rune && step.verb !== "attack")) {
    syntaxValid = false;
    failureReason = "rune-needs-attack";
  }

  const combinationLoad = connectorCount + contrastCount;
  const stabilityCost = combinationLoad + runeCount;
  const combinationAdequate = stats.combination >= combinationLoad;

  if (!syntaxValid) {
    return {
      rawText,
      normalizedText,
      tokens,
      outcome: "failure",
      failureReason,
      syntaxValid,
      steps,
      connectorCount,
      contrastCount,
      runeCount,
      combinationLoad,
      stabilityCost,
      combinationAdequate,
      attackDamage: 0,
      shieldGain: 0,
      selfHpCost: 5,
      selfManaCost: 3,
    };
  }

  let outcome: PromptOutcome = "stable";
  if (stabilityCost >= stats.stability + 2) {
    outcome = "failure";
    failureReason = "stability-overload";
  } else if (stabilityCost === stats.stability + 1) {
    outcome = "risky";
  }

  if (outcome === "failure") {
    return {
      rawText,
      normalizedText,
      tokens,
      outcome,
      failureReason,
      syntaxValid,
      steps,
      connectorCount,
      contrastCount,
      runeCount,
      combinationLoad,
      stabilityCost,
      combinationAdequate,
      attackDamage: 0,
      shieldGain: 0,
      selfHpCost: 5,
      selfManaCost: 3,
    };
  }

  let attackDamage = 0;
  let shieldGain = 0;

  for (const step of steps) {
    let multiplier = 1;

    if (connectorCount > 0 && steps.length > 1) {
      multiplier *= combinationAdequate ? 1 : 0.5;
    }

    if (step.contrast) {
      multiplier *= combinationAdequate ? 2.5 : 1.5;
    }

    if (step.rune) {
      multiplier *= 1.8;
    }

    if (step.verb === "attack") {
      attackDamage += Math.max(1, Math.round(getBaseAttackDamage(stats) * multiplier));
      continue;
    }

    shieldGain += Math.max(1, Math.round(getBaseShield(stats) * multiplier));
  }

  return {
    rawText,
    normalizedText,
    tokens,
    outcome,
    failureReason,
    syntaxValid,
    steps,
    connectorCount,
    contrastCount,
    runeCount,
    combinationLoad,
    stabilityCost,
    combinationAdequate,
    attackDamage,
    shieldGain,
    selfHpCost: outcome === "risky" ? 2 : 0,
    selfManaCost: outcome === "risky" ? 2 : 0,
    element: runeCount > 0 ? "fire" : undefined,
  };
}

/**
 * 몬스터 다음 행동 힌트를 위한 읽기 전용 타입 별칭이다.
 */
export type CombatMonsterIntent = MonsterIntent;
