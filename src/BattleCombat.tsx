import {
  type CSSProperties,
  type FormEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type LayoutLine,
  type PreparedTextWithSegments,
  layoutWithLines,
  prepareWithSegments,
} from "@chenglou/pretext";
import CrtOverlay from "./CrtOverlay";
import HealthPotion from "./HealthPotion";
import HeartHP from "./HeartHP";
import ManaFlask from "./ManaFlask";
import {
  type Language,
  getLocalizedSpellName,
  normalizeSpellQuery,
} from "./language";
import {
  type BattleTargetOption,
  type BattleTargetSide,
  type BattleLogEntry,
  type CombatAnimationRequest,
  type EquipmentDefinition,
  type EquippedItems,
  type MonsterIntent,
  type PlayerAction,
  type PlayerActionDraft,
  type PlayerStats,
  type PromptEvaluation,
  type PromptTokenKind,
  PLAYER_TARGET_ID,
  evaluatePromptAction,
  findSpell,
  getActionCritChance,
  getActionHitChance,
  getActionTargeting,
  getEquippedItems,
  getEquipmentSlotLabel,
} from "./battleTypes";
import {
  getProjectileTone,
  getProjectileVisual,
  renderIntentSparks,
  renderOverlayEffects,
  spawnChargeParticles,
  spawnDefendParticles,
  spawnHealParticles,
  spawnHitParticles,
  spawnImpactBurst,
  spawnMonsterDefendParticles,
  spawnPotionShatterBurst,
  spawnShieldChargeParticles,
  spawnSlashParticles,
  spawnSpellParticles,
} from "./battleCombatVisuals";

interface Projectile {
  chars: string[];
  x: number;
  y: number;
  startX: number;
  startY: number;
  controlX?: number;
  controlY?: number;
  turnX?: number;
  turnY?: number;
  targetX: number;
  targetY: number;
  startTime: number;
  duration: number;
  alive: boolean;
  fromPlayer: boolean;
  element?: string;
  shielded?: boolean;
  blocked?: boolean;
  critical?: boolean;
  missed?: boolean;
  impactTriggered?: boolean;
  onImpact?: () => void;
  offsets: { dx: number; dy: number; rot: number }[];
}

interface Point {
  x: number;
  y: number;
}

interface ShieldPlane {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
  center: Point;
}

interface SlashSample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  t: number;
}

interface SlashWave {
  label: string;
  points: SlashSample[];
  blocked?: boolean;
  shielded?: boolean;
  alive: boolean;
  startTime: number;
  duration: number;
  recoveryDuration: number;
  impactTriggered?: boolean;
  onImpact?: () => void;
}

interface SlashField {
  points: SlashSample[];
  intensity: number;
  thickness: number;
  strength: number;
  alphaLoss: number;
}

interface SceneAnchors {
  playerMuzzle: Point;
  monsterCore: Point;
  playerShield: ShieldPlane;
  monsterShield: ShieldPlane;
  slashStart: Point;
  slashControl: Point;
  slashEnd: Point;
}

interface ProjectileSceneAnchors {
  playerMuzzle: Point;
  playerCore: Point;
  playerShield: Point;
  monsterCore: Point;
  monsterShield: Point;
}

interface EffectParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  size: number;
}

interface SpriteEffect {
  type: "heal" | "slash" | "defend" | "spell" | "charge" | "shieldCharge" | "hit";
  target: "player" | "monster";
  element?: string;
  startTime: number;
  duration: number;
  particles: EffectParticle[];
  persistent?: boolean;
}

interface ForceField {
  x: number;
  y: number;
  radius: number;
  strength: number; // positive = repel, negative = attract
  startTime: number;
  duration: number;
}

interface BattleCombatProps {
  monsterName: string;
  monsterAscii: string[];
  playerAscii: string[];
  equippedItems: EquippedItems;
  monsterHp: number;
  monsterMaxHp: number;
  monsterShield: number;
  language: Language;
  nextIntent: MonsterIntent;
  nextIntentLabel: string;
  battleLog: BattleLogEntry[];
  ambientText: string;
  turn: "player" | "monster";
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerShield: number;
  playerStats: PlayerStats;
  targetOptions: BattleTargetOption[];
  onAction: (action: PlayerAction) => void;
  potionAvailable: boolean;
  onPotionUse: () => number;
  projectileCallbackRef: MutableRefObject<((request: CombatAnimationRequest) => void) | null>;
}

interface TextRenderOptions {
  fontWeight?: number;
  fontSize?: number;
  inkBleed?: number;
}

interface AsciiConsoleFrame {
  startX: number;
  cols: number;
  rows: number;
  topY: number;
  bottomY: number;
}

interface ConsolePulse {
  color: "blue" | "red";
  startTime: number;
  duration: number;
  strength: "soft" | "strong";
}

interface MonsterAsciiImpactState {
  startedAt: number;
  duration: number;
  direction: -1 | 1;
  strength: number;
  centerRatio: number;
  columnRatio: number;
  radiusRatio: number;
}

interface LiveAsciiDisplacementState {
  direction: -1 | 1;
  strength: number;
  centerRatio: number;
  columnRatio: number;
  radiusRatio: number;
}

interface MonsterAsciiGlyph {
  char: string;
  row: number;
  column: number;
  rowRatio: number;
  columnRatio: number;
}

interface MonsterAsciiCanvasMetrics {
  dpr: number;
  width: number;
  height: number;
  charWidth: number;
  lineHeight: number;
  baseline: number;
  font: string;
}

type CrtNoiseLevel = "off" | "soft" | "strong";
type GlyphColorMap = Map<string, string>;

interface PromptJudgementCopy {
  title: string;
  detail: string;
}

interface PromptEffectState {
  text: string;
  charKinds: Array<PromptTokenKind | "space">;
  evaluation: PromptEvaluation;
  judgement: PromptJudgementCopy;
  startedAt: number;
  duration: number;
}

const BATTLE_COMBAT_TEXT = {
  en: {
    attackLabel: "Attack",
    attackHint: "Physical attack",
    defendLabel: "Defend",
    defendHint: "Raise a shield",
    healLabel: "Heal",
    promptLabel: ">_",
    promptHint: "Word-weave / spell",
    targetSuffix: "target",
    chooseEnemyHint: "Choose an enemy. This spell still strikes every enemy in range.",
    chooseSingleHint: "Self-targets always hit. Other targets use your current hit and crit chances.",
    chooseSelfHint: "This action can only affect yourself.",
    hitLabel: "hit",
    critLabel: "crit",
    cancelLabel: "cancel",
    promptPlaceholder: "attack MOR defense",
    promptHelp:
      'Word-weaves accept attack/defense with MOR, UBT, or XLEW alone as a fire rune. Other spell names still cast normally.',
    promptBusyLabel: "phrase is binding...",
    judgementLabel: "JUDGMENT",
    lexiconLabel: "LEXICON",
    decipherLabel: "Decipher",
    combinationLabel: "Combine",
    stabilityLabel: "Stability",
    strengthLabel: "STR",
    agilityLabel: "AGI",
    potionAriaLabel: "Drag the health potion onto the player",
    potionLabel: "POTION",
    potionTooltip: "heal +8 hp, free action",
    monsterTurnMessage: (monsterName: string) => `${monsterName} acts beyond the torchlight...`,
    shieldLabel: "Shield",
    manaLabel: "MP",
    hpLabel: "HP",
    equipmentEffectLabel: "effect:",
    equipmentInactiveLabel: "inactive in combat for now",
  },
  ko: {
    attackLabel: "공격",
    attackHint: "물리 공격",
    defendLabel: "방어",
    defendHint: "방어막 전개",
    healLabel: "회복",
    promptLabel: ">_",
    promptHint: "문장 / 주문",
    targetSuffix: "대상",
    chooseEnemyHint: "대상을 고르세요. 이 주문은 범위 안의 모든 적에게 적중합니다.",
    chooseSingleHint: "자기 자신을 고르면 반드시 맞습니다. 다른 대상은 현재 명중률과 치명타 확률을 따릅니다.",
    chooseSelfHint: "이 행동은 자신에게만 사용할 수 있습니다.",
    hitLabel: "명중",
    critLabel: "치명",
    cancelLabel: "취소",
    promptPlaceholder: "attack MOR defense",
    promptHelp:
      '공격/방어 구문에는 MOR, UBT를 쓰고, XLEW는 단독 화염 룬으로 쓸 수 있다. 그 외 주문명은 기존처럼 시전된다.',
    promptBusyLabel: "문장이 결속되는 중...",
    judgementLabel: "판정",
    lexiconLabel: "어휘력",
    decipherLabel: "해독력",
    combinationLabel: "조합력",
    stabilityLabel: "안정성",
    strengthLabel: "힘",
    agilityLabel: "민첩",
    potionAriaLabel: "체력 물약을 플레이어에게 드래그하기",
    potionLabel: "물약",
    potionTooltip: "HP +8, 무료 행동",
    monsterTurnMessage: (monsterName: string) => `${monsterName}이(가) 횃불 너머에서 움직인다...`,
    shieldLabel: "방어막",
    manaLabel: "MP",
    hpLabel: "HP",
    equipmentEffectLabel: "효과:",
    equipmentInactiveLabel: "지금은 전투 반영 없음",
  },
} as const;

const WORD_PROMPT_TOKENS = new Set([
  "attack",
  "공격",
  "defense",
  "defend",
  "방어",
  "mor",
  "ubt",
  "xlew",
]);

function isWordPromptCandidate(raw: string): boolean {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .some((part) => WORD_PROMPT_TOKENS.has(part));
}

function buildPromptEffectText(evaluation: PromptEvaluation): string {
  return evaluation.tokens.map((token) => token.specialWord ?? token.raw).join(" ");
}

function buildPromptCharKinds(
  evaluation: PromptEvaluation,
): Array<PromptTokenKind | "space"> {
  const charKinds: Array<PromptTokenKind | "space"> = [];

  evaluation.tokens.forEach((token, index) => {
    const display = token.specialWord ?? token.raw;
    for (const _char of display) {
      charKinds.push(token.kind);
    }

    if (index < evaluation.tokens.length - 1) {
      charKinds.push("space");
    }
  });

  return charKinds;
}

function seededWave(index: number, salt: number): number {
  return Math.sin(index * 12.9898 + salt * 78.233);
}

function getPromptJudgementCopy(
  evaluation: PromptEvaluation,
  stats: PlayerStats,
  language: Language,
): PromptJudgementCopy {
  const decipher = stats.decipher;
  const combinationShort = !evaluation.combinationAdequate && evaluation.combinationLoad > 0;

  if (evaluation.outcome === "failure") {
    if (evaluation.failureReason === "stability-overload") {
      if (decipher >= 3) {
        return language === "ko"
          ? {
              title: "안정성 파단",
              detail: `코스트 ${evaluation.stabilityCost}가 안정성 ${stats.stability}을 넘어 문장이 스스로 찢어진다.`,
            }
          : {
              title: "Stability Breach",
              detail: `Cost ${evaluation.stabilityCost} overwhelms stability ${stats.stability}; the phrase tears itself apart.`,
            };
      }

      if (decipher >= 2) {
        return language === "ko"
          ? {
              title: "결속 붕괴",
              detail: "문장이 감당할 수 있는 무게를 넘겨 반동이 돌아온다.",
            }
          : {
              title: "Binding Collapse",
              detail: "The sentence carries more weight than you can anchor.",
            };
      }

      return language === "ko"
        ? {
            title: "무언가 찢어진다",
            detail: "말이 당신을 거스른다.",
          }
        : {
            title: "Something Tears",
            detail: "The phrase turns on you.",
          };
    }

    if (decipher >= 3) {
      const detail = (() => {
        switch (evaluation.failureReason) {
          case "unknown-token":
            return language === "ko"
              ? "허용되지 않은 단어가 끼어 있어 결속이 처음부터 성립하지 않는다."
              : "An unsupported word breaks the pattern before it can bind.";
          case "rune-needs-attack":
            return language === "ko"
              ? "XLEW는 단독 공격이거나 공격 앞에서만 성립한다. 방어 동사와는 결속하지 않는다."
              : "XLEW works on its own or directly before an attack verb, not with defense.";
          case "dangling-connector":
          case "dangling-rune":
          case "invalid-order":
          case "too-many-actions":
          case "empty":
          default:
            return language === "ko"
              ? "연결어와 룬어의 순서가 어긋나 문장 뼈대가 틀어졌다."
              : "The connector-rune order slips out of alignment and fractures the sentence.";
        }
      })();

      return language === "ko"
        ? { title: "구문 파열", detail }
        : { title: "Syntax Fracture", detail };
    }

    if (decipher >= 2) {
      return language === "ko"
        ? {
            title: "문장이 엇물리지 않는다",
            detail: "어떤 단어가 제자리를 찾지 못했다.",
          }
        : {
            title: "The Words Refuse",
            detail: "Something in the phrase never found its place.",
          };
    }

    return language === "ko"
      ? {
          title: "받지 않는다",
          detail: "문장이 입안에서 깨진다.",
        }
      : {
          title: "It Will Not Take",
          detail: "The phrase breaks in your mouth.",
        };
  }

  if (evaluation.outcome === "risky") {
    if (combinationShort && decipher >= 3) {
      return language === "ko"
        ? {
            title: "약한 결속",
            detail: `조합 부하 ${evaluation.combinationLoad}가 조합력 ${stats.combination}을 넘어 일부 글자가 힘을 잃는다. 대신 구문은 간신히 남는다.`,
          }
        : {
            title: "Weak Binding",
            detail: `Combination load ${evaluation.combinationLoad} exceeds combine ${stats.combination}; parts of the phrase lose force before the weave barely holds.`,
          };
    }

    if (decipher >= 3) {
      return language === "ko"
        ? {
            title: "위태로운 결속",
            detail: `코스트 ${evaluation.stabilityCost}가 한계를 한 칸 넘겼다. 반동 HP -${evaluation.selfHpCost}, MP -${evaluation.selfManaCost}.`,
          }
        : {
            title: "Precarious Binding",
            detail: `Cost ${evaluation.stabilityCost} pushes one step past your limit. Backlash HP -${evaluation.selfHpCost}, MP -${evaluation.selfManaCost}.`,
          };
    }

    if (decipher >= 2) {
      return language === "ko"
        ? {
            title: "간신히 엮인다",
            detail: "성공은 하지만 몸이 그 값을 치른다.",
          }
        : {
            title: "It Barely Holds",
            detail: "The weave succeeds, but your body pays for it.",
          };
    }

    return language === "ko"
      ? {
          title: "말이 문다",
          detail: "성공했지만 아프다.",
        }
      : {
          title: "The Phrase Bites",
          detail: "It works, but it hurts.",
        };
  }

  if (combinationShort) {
    if (decipher >= 3) {
      return language === "ko"
        ? {
            title: "흐트러진 결속",
            detail: `조합 부하 ${evaluation.combinationLoad}가 조합력 ${stats.combination}보다 높아 절반 효율로 엮였다.`,
          }
        : {
            title: "Frayed Binding",
            detail: `Combination load ${evaluation.combinationLoad} sits above combine ${stats.combination}, so the weave lands at reduced strength.`,
          };
    }

    if (decipher >= 2) {
      return language === "ko"
        ? {
            title: "조금 약하다",
            detail: "문장이 닿기는 했지만 단단히 맞물리지는 않았다.",
          }
        : {
            title: "A Little Weak",
            detail: "The phrase reaches the box, but never locks tightly.",
          };
    }

    return language === "ko"
      ? {
          title: "휘청인다",
          detail: "힘이 조금 샌다.",
        }
      : {
          title: "It Falters",
          detail: "Some force leaks away.",
        };
  }

  if (decipher >= 3) {
    return language === "ko"
      ? {
          title: "재정렬 완료",
          detail: `조합 부하 ${evaluation.combinationLoad}, 안정 코스트 ${evaluation.stabilityCost}. 문장이 제자리를 찾는다.`,
        }
      : {
          title: "Reordering Complete",
          detail: `Combination load ${evaluation.combinationLoad}, stability cost ${evaluation.stabilityCost}. The phrase settles cleanly.`,
        };
  }

  if (decipher >= 2) {
    return language === "ko"
      ? {
          title: "문장이 맞물린다",
          detail: "낱말들이 흔들리다 곧 한 줄로 정돈된다.",
        }
      : {
          title: "The Sentence Locks",
          detail: "The words shudder, then find a single line.",
        };
  }

  return language === "ko"
    ? {
        title: "제자리를 찾는다",
        detail: "말이 잠잠해진다.",
      }
    : {
        title: "It Settles",
        detail: "The words stop fighting you.",
      };
}

/* ================================================================
   Pretext helpers — character-level physics displacement
   ================================================================ */

const CRT_FONT_FAMILY = "'Courier New', Courier, monospace";
const BASE_FONT_SIZE = 12;
const W = 480;
const H = 320;
const SCENE_W = 1140;
const SCENE_H = 712;
const LINE_H = 18;
const PAD = 14;
const TEXT_W = W - PAD * 2;
const POTION_WIDTH = 56;
const POTION_HEIGHT = 92;
/** Radius within which a projectile displaces characters */
const DISPLACE_RADIUS = 90;
/** Maximum pixel push in Y */
const DISPLACE_Y = 28;
/** Maximum pixel push in X */
const DISPLACE_X = 16;
const SLASH_THICKNESS = 34;
const PLAYER_ASCII_CANVAS_TONE = "rgba(244, 244, 244, 0.98)";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function pointInsideDomRect(point: Point, rect: DOMRect, padding = 0): boolean {
  return (
    point.x >= rect.left - padding &&
    point.x <= rect.right + padding &&
    point.y >= rect.top - padding &&
    point.y <= rect.bottom + padding
  );
}

function easeOutCubic(value: number): number {
  const clamped = clamp01(value);
  return 1 - (1 - clamped) ** 3;
}

function easeInCubic(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * clamped;
}

function easeInOutCubic(value: number): number {
  const clamped = clamp01(value);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - ((-2 * clamped + 2) ** 3) / 2;
}

function sampleQuadraticPoint(start: Point, control: Point, end: Point, t: number): Point {
  const inv = 1 - t;
  return {
    x: inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
    y: inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
  };
}

function sampleQuadraticNormal(start: Point, control: Point, end: Point, t: number): Point {
  const dx = 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x);
  const dy = 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y);
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: -dy / length,
    y: dx / length,
  };
}

function sampleQuadraticTangent(start: Point, control: Point, end: Point, t: number): Point {
  const dx = 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x);
  const dy = 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y);
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: dx / length,
    y: dy / length,
  };
}

function makeShieldPlane(
  topLeft: Point,
  topRight: Point,
  depthX: number,
  depthY: number,
): ShieldPlane {
  const bottomLeft = { x: topLeft.x + depthX, y: topLeft.y + depthY };
  const bottomRight = { x: topRight.x + depthX, y: topRight.y + depthY };

  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
    center: {
      x: (topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4,
      y: (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4,
    },
  };
}

function buildSlashSamples(start: Point, control: Point, end: Point): SlashSample[] {
  return Array.from({ length: 28 }, (_, index) => {
    const t = index / 27;
    const point = sampleQuadraticPoint(start, control, end, t);
    const normal = sampleQuadraticNormal(start, control, end, t);
    return {
      x: point.x,
      y: point.y,
      nx: normal.x,
      ny: normal.y,
      t,
    };
  });
}

function getSceneAnchors(width: number, height: number): SceneAnchors {
  return {
    playerMuzzle: { x: width * 0.18, y: height * 0.78 },
    monsterCore: { x: width * 0.955, y: height * 0.118 },
    playerShield: makeShieldPlane(
      { x: width * 0.24, y: height * 0.28 },
      { x: width * 0.36, y: height * 0.23 },
      width * 0.06,
      height * 0.34,
    ),
    monsterShield: makeShieldPlane(
      { x: width * 0.73, y: height * 0.14 },
      { x: width * 0.845, y: height * 0.18 },
      -width * 0.06,
      height * 0.27,
    ),
    slashStart: { x: width * 0.18, y: height * 0.16 },
    slashControl: { x: width * 0.63, y: height * 0.06 },
    slashEnd: { x: width * 0.77, y: height * 0.73 },
  };
}

function getProjectileSceneAnchors(width: number, height: number): ProjectileSceneAnchors {
  return {
    playerMuzzle: { x: width * 0.28, y: height * 0.71 },
    playerCore: { x: width * 0.235, y: height * 0.63 },
    playerShield: { x: width * 0.292, y: height * 0.56 },
    monsterCore: { x: width * 0.774, y: height * 0.198 },
    monsterShield: { x: width * 0.736, y: height * 0.162 },
  };
}

function sampleRandomOffscreenPoint(origin: Point, heading?: Point): Point {
  const padding = 150;
  const candidates = [
    { x: -padding, y: Math.random() * SCENE_H },
    { x: SCENE_W + padding, y: Math.random() * SCENE_H },
    { x: Math.random() * SCENE_W, y: -padding },
    { x: Math.random() * SCENE_W, y: SCENE_H + padding },
  ].filter((point) => {
    if (Math.hypot(point.x - origin.x, point.y - origin.y) <= 260) {
      return false;
    }

    if (!heading) {
      return true;
    }

    const headingLength = Math.max(1, Math.hypot(heading.x, heading.y));
    const normalizedHeading = { x: heading.x / headingLength, y: heading.y / headingLength };
    const towardCandidate = { x: point.x - origin.x, y: point.y - origin.y };
    const candidateLength = Math.max(1, Math.hypot(towardCandidate.x, towardCandidate.y));
    const normalizedCandidate = {
      x: towardCandidate.x / candidateLength,
      y: towardCandidate.y / candidateLength,
    };

    // Keep misses within the forward 180-degree arc so they still fly enemy-ward.
    return normalizedHeading.x * normalizedCandidate.x + normalizedHeading.y * normalizedCandidate.y >= 0;
  });

  return candidates[Math.floor(Math.random() * candidates.length)] ?? {
    x: SCENE_W + padding,
    y: origin.y - padding,
  };
}

function sampleMonsterImpactPoint(anchors: ProjectileSceneAnchors): Point {
  const horizontalSpan = Math.max(22, Math.abs(anchors.monsterCore.x - anchors.monsterShield.x));
  const verticalSpan = Math.max(18, Math.abs(anchors.monsterCore.y - anchors.monsterShield.y));

  // Keep direct hits inside a loose left/lower pocket so repeated shots do not pin the same right-edge pixel.
  return {
    x: anchors.monsterCore.x - horizontalSpan * (0.55 + Math.random() * 1.25),
    y: anchors.monsterCore.y + verticalSpan * (0.45 + Math.random() * 1.45),
  };
}

function mapScenePointToConsolePoint(
  point: Point,
  sceneRect: DOMRect,
  consoleRect: DOMRect,
): Point {
  const screenX = sceneRect.left + (point.x / SCENE_W) * sceneRect.width;
  const screenY = sceneRect.top + (point.y / SCENE_H) * sceneRect.height;

  return {
    x: ((screenX - consoleRect.left) / consoleRect.width) * W,
    y: ((screenY - consoleRect.top) / consoleRect.height) * H,
  };
}

function drawAsciiConsoleFrame(
  ctx: CanvasRenderingContext2D,
  color: string,
): AsciiConsoleFrame {
  const charW = ctx.measureText("M").width;
  const startX = 20;
  const topY = 18;
  const cols = Math.max(44, Math.floor((W - startX * 2) / charW));
  const rows = Math.max(15, Math.floor((H - topY * 2) / LINE_H));
  const rightX = startX + (cols - 1) * charW;

  ctx.fillStyle = color;
  ctx.fillText(`┌${"─".repeat(cols - 2)}┐`, startX, topY);
  for (let row = 1; row < rows - 1; row += 1) {
    const y = topY + row * LINE_H;
    ctx.fillText("│", startX, y);
    ctx.fillText("│", rightX, y);
  }
  ctx.fillText(`└${"─".repeat(cols - 2)}┘`, startX, topY + (rows - 1) * LINE_H);

  return {
    startX,
    cols,
    rows,
    topY,
    bottomY: topY + (rows - 1) * LINE_H,
  };
}

function drawAsciiConsoleRule(
  ctx: CanvasRenderingContext2D,
  y: number,
  frame: AsciiConsoleFrame,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillText(`├${"─".repeat(frame.cols - 2)}┤`, frame.startX, y);
}

function drawAsciiPanelFrame(
  ctx: CanvasRenderingContext2D,
  startX: number,
  topY: number,
  cols: number,
  rows: number,
  color: string,
): AsciiConsoleFrame {
  const safeCols = Math.max(10, cols);
  const safeRows = Math.max(4, rows);
  const charW = ctx.measureText("M").width;
  const rightX = startX + (safeCols - 1) * charW;

  ctx.fillStyle = color;
  ctx.fillText(`┌${"─".repeat(safeCols - 2)}┐`, startX, topY);
  for (let row = 1; row < safeRows - 1; row += 1) {
    const y = topY + row * LINE_H;
    ctx.fillText("│", startX, y);
    ctx.fillText("│", rightX, y);
  }
  ctx.fillText(`└${"─".repeat(safeCols - 2)}┘`, startX, topY + (safeRows - 1) * LINE_H);

  return {
    startX,
    cols: safeCols,
    rows: safeRows,
    topY,
    bottomY: topY + (safeRows - 1) * LINE_H,
  };
}

function getConsolePerimeterPoint(
  frame: AsciiConsoleFrame,
  charWidth: number,
  slot: number,
): Point {
  const innerCols = Math.max(1, frame.cols - 2);
  const innerRows = Math.max(1, frame.rows - 2);
  const total = innerCols * 2 + innerRows * 2;
  const wrapped = ((slot % total) + total) % total;
  const rightX = frame.startX + (frame.cols - 1) * charWidth;

  if (wrapped < innerCols) {
    return {
      x: frame.startX + (wrapped + 1) * charWidth,
      y: frame.topY,
    };
  }
  if (wrapped < innerCols + innerRows) {
    return {
      x: rightX,
      y: frame.topY + (wrapped - innerCols + 1) * LINE_H,
    };
  }
  if (wrapped < innerCols * 2 + innerRows) {
    return {
      x: rightX - (wrapped - innerCols - innerRows + 1) * charWidth,
      y: frame.bottomY,
    };
  }

  return {
    x: frame.startX,
    y: frame.bottomY - (wrapped - innerCols * 2 - innerRows + 1) * LINE_H,
  };
}

function renderConsolePulse(
  ctx: CanvasRenderingContext2D,
  frame: AsciiConsoleFrame,
  charWidth: number,
  pulse: ConsolePulse,
  now: number,
): void {
  const progress = clamp01((now - pulse.startTime) / pulse.duration);
  if (progress >= 1) return;

  const strength = pulse.strength === "strong" ? 1 : 0.65;

  const color =
    pulse.color === "blue"
      ? `rgba(120, 190, 255, ${(0.16 + (1 - progress) * 0.52 * strength).toFixed(2)})`
      : `rgba(255, 86, 68, ${(0.2 + (1 - progress) * 0.56 * strength).toFixed(2)})`;
  drawAsciiConsoleFrame(ctx, color);

  const innerCols = Math.max(1, frame.cols - 2);
  const innerRows = Math.max(1, frame.rows - 2);
  const total = innerCols * 2 + innerRows * 2;
  const head = Math.floor(progress * total * 1.2);
  const markerCount = pulse.strength === "strong" ? 20 : 14;

  ctx.save();
  ctx.font = "bold 14px 'Courier New', monospace";
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;

  for (let index = 0; index < markerCount; index += 1) {
    const slot = head - index * 2;
    const point = getConsolePerimeterPoint(frame, charWidth, slot);
    const alpha = Math.max(0.12, 1 - index / markerCount) * (1 - progress * 0.38) * (0.8 + strength * 0.4);
    ctx.fillStyle = pulse.color === "blue"
      ? `rgba(170, 228, 255, ${alpha.toFixed(2)})`
      : `rgba(255, 116, 102, ${alpha.toFixed(2)})`;
    ctx.fillText(index % 3 === 0 ? "#" : index % 2 === 0 ? "*" : "+", point.x, point.y);
  }

  ctx.restore();
}

function makeFont(weight: number = 500, size: number = BASE_FONT_SIZE): string {
  return `${weight} ${size}px ${CRT_FONT_FAMILY}`;
}

const CRT_FONT = makeFont();

const preparedCache = new Map<string, PreparedTextWithSegments>();

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = font + "::" + text;
  const cached = preparedCache.get(key);
  if (cached) return cached;
  const prepared = prepareWithSegments(text, font);
  preparedCache.set(key, prepared);
  if (preparedCache.size > 200) {
    const first = preparedCache.keys().next().value;
    if (first) preparedCache.delete(first);
  }
  return prepared;
}

function getLayoutLines(
  text: string,
  font: string = CRT_FONT,
  maxWidth: number = TEXT_W,
): LayoutLine[] {
  if (!text) return [];
  try {
    const prepared = getPrepared(text, font);
    return layoutWithLines(prepared, maxWidth, LINE_H).lines;
  } catch {
    return [{ text, width: maxWidth, start: { segmentIndex: 0, graphemeIndex: 0 }, end: { segmentIndex: 0, graphemeIndex: 0 } }];
  }
}

/**
 * Render a text block character-by-character.
 * Each character is displaced away from nearby projectiles
 * using a smooth force falloff — producing the "water flowing
 * around a rock" effect from the old version.
 */
function renderTextBlockPhysics(
  ctx: CanvasRenderingContext2D,
  text: string,
  fillStyle: string,
  startY: number,
  projectiles: Projectile[],
  forceFields?: ForceField[],
  slashFields?: SlashField[],
  options: TextRenderOptions = {},
  bounds?: { startX?: number; maxWidth?: number; lineHeight?: number },
): number {
  const font = makeFont(options.fontWeight ?? 500, options.fontSize ?? BASE_FONT_SIZE);
  const lineHeight = bounds?.lineHeight ?? LINE_H;
  const startX = bounds?.startX ?? PAD;
  const maxWidth = bounds?.maxWidth ?? TEXT_W;
  const lines = getLayoutLines(text, font, maxWidth);
  if (lines.length === 0) return startY;

  ctx.font = font;
  const now = performance.now();
  const bleed = options.inkBleed ?? 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const baseY = startY + li * lineHeight;
    let cx = startX;

    for (let ci = 0; ci < line.text.length; ci++) {
      const ch = line.text[ci];
      const charW = ctx.measureText(ch).width;

      // Accumulate displacement from all nearby projectiles
      let offsetX = 0;
      let offsetY = 0;
      let alpha = parseBaseAlpha(fillStyle);

      for (const p of projectiles) {
        if (!p.alive) continue;
        const dx = cx - p.x;
        const dy = baseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < DISPLACE_RADIUS) {
          const force = (DISPLACE_RADIUS - dist) / DISPLACE_RADIUS;
          const forceSquared = force * force; // smoother falloff
          offsetY += (dy > 0 ? 1 : -1) * forceSquared * DISPLACE_Y;
          offsetX += (dx > 0 ? 1 : -1) * forceSquared * DISPLACE_X;
          alpha = Math.max(0.08, alpha - force * 0.45);
        }
      }

      // Force fields (for charge suction / defend repulsion)
      if (forceFields) {
        for (const ff of forceFields) {
          const elapsed = now - ff.startTime;
          if (elapsed < 0 || elapsed > ff.duration) continue;
          const progress = elapsed / ff.duration;
          const fadeIn = Math.min(progress * 4, 1);
          const fadeOut = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
          const intensity = fadeIn * fadeOut;
          const dx = cx - ff.x;
          const dy = baseY - ff.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < ff.radius && dist > 1) {
            const t = (ff.radius - dist) / ff.radius;
            const pull = t * t * ff.strength * intensity;
            // Negative strength = attract (toward center), positive = repel
            const nx = dx / dist;
            const ny = dy / dist;
            offsetX += nx * pull * DISPLACE_X * 1.5;
            offsetY += ny * pull * DISPLACE_Y * 1.5;
            alpha = Math.max(0.08, alpha - Math.abs(t * intensity) * 0.3);
          }
        }
      }

      if (slashFields) {
        for (const slash of slashFields) {
          let nearestPoint: SlashSample | null = null;
          let nearestDistance = Number.POSITIVE_INFINITY;

          for (const point of slash.points) {
            const dx = cx - point.x;
            const dy = baseY - point.y;
            const distance = Math.hypot(dx, dy);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestPoint = point;
            }
          }

          if (!nearestPoint || nearestDistance >= slash.thickness) continue;

          const influence = ((slash.thickness - nearestDistance) / slash.thickness) ** 2;
          const side =
            (cx - nearestPoint.x) * nearestPoint.nx +
              (baseY - nearestPoint.y) * nearestPoint.ny >=
            0
              ? 1
              : -1;

          offsetX += nearestPoint.nx * side * influence * slash.strength * slash.intensity;
          offsetY += nearestPoint.ny * side * influence * slash.strength * 1.35 * slash.intensity;
          alpha = Math.max(
            0.05,
            alpha - influence * slash.alphaLoss * Math.max(0.4, slash.intensity),
          );
        }
      }

      if (bleed > 0.02) {
        const bleedAlpha = Math.min(alpha, alpha * (0.28 + bleed));
        ctx.fillStyle = replaceAlpha(fillStyle, bleedAlpha);
        ctx.fillText(ch, cx + offsetX + bleed, baseY + offsetY);
        ctx.fillText(ch, cx + offsetX, baseY + offsetY + bleed * 0.55);
      }

      ctx.fillStyle = replaceAlpha(fillStyle, alpha);
      ctx.fillText(ch, cx + offsetX, baseY + offsetY);
      cx += charW;
    }
  }

  return startY + lines.length * lineHeight;
}

/** Extract the alpha value from an rgba() string, default 0.75. */
function parseBaseAlpha(rgba: string): number {
  const m = rgba.match(/,\s*([\d.]+)\s*\)/);
  return m ? Number(m[1]) : 0.75;
}

/** Replace the alpha in an rgba() string. */
function replaceAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/,\s*[\d.]+\s*\)/, `, ${alpha.toFixed(2)})`);
}

function parseRgbaChannels(color: string): {
  red: number;
  green: number;
  blue: number;
  alpha: number;
} {
  const match = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+)\s*)?\)/,
  );

  if (!match) {
    return { red: 255, green: 255, blue: 255, alpha: 1 };
  }

  return {
    red: Number(match[1]),
    green: Number(match[2]),
    blue: Number(match[3]),
    alpha: match[4] ? Number(match[4]) : 1,
  };
}

function mixRgbaColors(from: string, to: string, amount: number): string {
  const t = clamp01(amount);
  const fromColor = parseRgbaChannels(from);
  const toColor = parseRgbaChannels(to);

  const red = Math.round(lerp(fromColor.red, toColor.red, t));
  const green = Math.round(lerp(fromColor.green, toColor.green, t));
  const blue = Math.round(lerp(fromColor.blue, toColor.blue, t));
  const alpha = lerp(fromColor.alpha, toColor.alpha, t);

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}

function buildHitWaveTextStyle(
  baseColor: string,
  hitColor: string,
  baseShadow: string,
  hitShadow: string,
  waveProgress: number | null,
  waveScale: number,
  shakeActive: boolean,
): CSSProperties {
  const shadow = shakeActive || waveProgress !== null ? `${hitShadow}, ${baseShadow}` : baseShadow;

  if (waveProgress === null) {
    return {
      color: baseColor,
      textShadow: shadow,
    };
  }

  const progress = Math.max(0, waveProgress);
  const mainProgress = clamp01(progress);
  const tailProgress = progress <= 1 ? 0 : clamp01((progress - 1) / 0.58);
  const expansion = easeOutCubic(mainProgress);
  const pulse = Math.sin(Math.PI * mainProgress) * (1 - tailProgress * 0.75);
  const ringCenter =
    8 +
    expansion * (84 + waveScale * 11) +
    tailProgress * (34 + waveScale * 16);
  const ringWidth = 9 + waveScale * 6.4 + pulse * 6;
  const inner = Math.max(0, ringCenter - ringWidth);
  const outer = ringCenter + ringWidth;
  const baseSolid = replaceAlpha(baseColor, Math.min(0.99, parseBaseAlpha(baseColor) + 0.02));
  const hitStrong = replaceAlpha(hitColor, Math.max(0.22, 0.96 - tailProgress * 0.58));
  const hitMid = replaceAlpha(hitColor, Math.max(0.16, 0.66 + pulse * 0.16 - tailProgress * 0.4));
  const hitSoft = replaceAlpha(hitColor, Math.max(0.08, 0.26 + pulse * 0.12 - tailProgress * 0.2));
  const coreGlow = replaceAlpha(
    hitColor,
    Math.max(0.02, 0.2 + waveScale * 0.03 - mainProgress * 0.32 - tailProgress * 0.1),
  );
  const earlyCore = 8 + waveScale * 8 + (1 - mainProgress) * 12;
  const outerStop = Math.max(100, outer + 10);
  const weight = Math.round(500 + pulse * 115 + waveScale * 12 - tailProgress * 55);
  const letterSpacing = `${(-0.003 - pulse * 0.004 - waveScale * 0.0012).toFixed(4)}em`;
  const stroke = `${(0.08 + pulse * 0.12 + waveScale * 0.02 - tailProgress * 0.05).toFixed(2)}px ${replaceAlpha(hitColor, Math.max(0.04, 0.08 + pulse * 0.1 - tailProgress * 0.06))}`;
  const returnPhase =
    tailProgress <= 0.2 ? 0 : easeInOutCubic((tailProgress - 0.2) / 0.8);

  if (mainProgress < 0.18 && tailProgress === 0) {
    return {
      backgroundImage: `radial-gradient(circle at 50% 50%, ${hitStrong} 0%, ${hitMid} ${earlyCore.toFixed(2)}%, ${baseSolid} ${(earlyCore + 12).toFixed(2)}%, ${baseSolid} 100%)`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
      textShadow: shadow,
      fontWeight: weight,
      letterSpacing,
      WebkitTextStroke: stroke,
    };
  }

  if (returnPhase > 0) {
    const returnStartColor = mixRgbaColors(hitColor, baseColor, 0.88);
    const returnColor = mixRgbaColors(returnStartColor, baseColor, returnPhase);
    const returnWeight = Math.round(520 - returnPhase * 26);
    const returnLetterSpacing = `${(-0.0018 * (1 - returnPhase)).toFixed(4)}em`;
    const returnStroke = `${(0.05 * (1 - returnPhase)).toFixed(2)}px ${replaceAlpha(hitColor, Math.max(0.01, 0.06 * (1 - returnPhase)))}`;

    return {
      color: returnColor,
      WebkitTextFillColor: returnColor,
      textShadow: returnPhase > 0.45 ? baseShadow : shadow,
      fontWeight: returnWeight,
      letterSpacing: returnLetterSpacing,
      WebkitTextStroke: returnStroke,
    };
  }

  const ringLead = Math.max(0, inner - 5);

  return {
    backgroundImage: `radial-gradient(circle at 50% 50%, ${coreGlow} 0%, ${coreGlow} ${Math.max(4, earlyCore * 0.72).toFixed(2)}%, ${baseSolid} ${ringLead.toFixed(2)}%, ${hitStrong} ${inner.toFixed(2)}%, ${hitMid} ${ringCenter.toFixed(2)}%, ${hitSoft} ${outer.toFixed(2)}%, ${baseSolid} ${outerStop.toFixed(2)}%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    textShadow: shadow,
    fontWeight: weight,
    letterSpacing,
    WebkitTextStroke: stroke,
  };
}

function getHitWaveScale(damage: number, maxHp: number): number {
  const normalizedDamage = clamp01(damage / Math.max(1, maxHp));
  return 1.35 + normalizedDamage * 2.8;
}

function getMonsterImpactBandDuration(critical: boolean): number {
  return critical ? 960 : 780;
}

function getMonsterImpactSettleDelay(critical: boolean): number {
  return critical ? 860 : 700;
}

function getRadialHoleInfluence(normalizedDistance: number): number {
  const raw = clamp01(1 - normalizedDistance);
  return raw * raw * (3 - 2 * raw);
}

function getMonsterImpactPulse(progress: number): number {
  const clamped = clamp01(progress);
  const swell = Math.sin(Math.PI * clamped);
  const settle =
    clamped <= 0.42 ? 1 : 1 - easeInOutCubic((clamped - 0.42) / 0.58) * 0.9;
  return swell * settle;
}

function buildMonsterAsciiGlyphs(lines: string[]): MonsterAsciiGlyph[] {
  const rowCount = Math.max(1, lines.length);
  const maxColumns = Math.max(1, ...lines.map((line) => Math.max(1, line.length - 1)));
  const glyphs: MonsterAsciiGlyph[] = [];

  lines.forEach((line, row) => {
    for (let column = 0; column < line.length; column += 1) {
      const char = line[column];
      if (char === " ") continue;

      glyphs.push({
        char,
        row,
        column,
        rowRatio: rowCount <= 1 ? 0.5 : row / (rowCount - 1),
        columnRatio: maxColumns <= 1 ? 0.5 : column / maxColumns,
      });
    }
  });

  return glyphs;
}

function getGlyphColorKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function buildEquipmentGlyphColorMap(
  lines: string[],
  items: EquipmentDefinition[],
): GlyphColorMap {
  const glyphColors: GlyphColorMap = new Map();

  for (const item of items) {
    for (const tintRange of item.tintRanges) {
      const line = lines[tintRange.row];
      if (!line) {
        continue;
      }

      const endColumn = Math.min(tintRange.endColumn, line.length - 1);
      for (let column = tintRange.startColumn; column <= endColumn; column += 1) {
        if (line[column] === " ") {
          continue;
        }

        glyphColors.set(getGlyphColorKey(tintRange.row, column), item.fragmentTone);
      }
    }
  }

  return glyphColors;
}

function renderMonsterAsciiImpactCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metrics: MonsterAsciiCanvasMetrics | null,
  glyphs: MonsterAsciiGlyph[],
  impact: MonsterAsciiImpactState | null,
  baseColor: string,
  now: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!metrics || !impact) {
    return;
  }

  const progress = clamp01((now - impact.startedAt) / impact.duration);
  const pulse = getMonsterImpactPulse(progress);
  const expansion = easeOutCubic(progress);
  const radiusXRatio = Math.max(0.12, impact.radiusRatio * 1.22);
  const radiusYRatio = Math.max(0.11, impact.radiusRatio * 0.98);
  const maxPush = 14 + impact.strength * 24 + Math.min(metrics.width, metrics.height) * impact.radiusRatio * 0.12;
  const hitColor = "rgba(198, 18, 34, 0.99)";
  const waveFront = Math.min(1.28, 0.08 + expansion * 1.04);
  const waveWidth = Math.max(0.12, 0.34 - expansion * 0.1);

  ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
  ctx.font = metrics.font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = baseColor;

  for (const glyph of glyphs) {
    const dxRatio = (glyph.columnRatio - impact.columnRatio) / radiusXRatio;
    const dyRatio = (glyph.rowRatio - impact.centerRatio) / radiusYRatio;
    const distance = Math.hypot(dxRatio, dyRatio);
    const influence = getRadialHoleInfluence(distance);

    let x = glyph.column * metrics.charWidth;
    let y = glyph.row * metrics.lineHeight + metrics.baseline;

    if (influence > 0.0001) {
      let dirX = dxRatio;
      let dirY = dyRatio;
      const directionLength = Math.hypot(dirX, dirY);

      if (directionLength < 0.0001) {
        dirX = impact.direction;
        dirY = 0;
      } else {
        dirX /= directionLength;
        dirY /= directionLength;
      }

      const outward = pulse * influence * maxPush * (0.52 + (1 - Math.min(1, distance)) * 0.84);
      const swirl = Math.sin((1 - Math.min(1, distance)) * Math.PI) * pulse * 2.4;

      x += dirX * outward - dirY * swirl;
      y += dirY * outward * 0.88 + dirX * swirl * 0.45;
    }

    const waveBand = clamp01(1 - Math.abs(distance - waveFront) / waveWidth);
    const innerHeat = influence * Math.max(0, 0.34 - expansion * 0.22);
    const redMix = clamp01(Math.max(innerHeat, waveBand * (0.52 + pulse * 0.34)));
    if (redMix > 0.02) {
      ctx.fillStyle = mixRgbaColors(baseColor, hitColor, Math.min(0.98, 0.08 + redMix * 0.9));
      ctx.shadowColor = replaceAlpha(hitColor, 0.08 + redMix * 0.18);
      ctx.shadowBlur = 3 + redMix * 7;
    } else {
      ctx.fillStyle = baseColor;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    ctx.fillText(glyph.char, x, y);
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function renderLiveAsciiDisplacementCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metrics: MonsterAsciiCanvasMetrics | null,
  glyphs: MonsterAsciiGlyph[],
  field: LiveAsciiDisplacementState | null,
  baseColor: string,
  glyphColors: GlyphColorMap,
  now: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!metrics || !field) {
    return;
  }

  const wobble = 0.94 + Math.sin(now * 0.018) * 0.06;
  const radiusXRatio = Math.max(0.14, field.radiusRatio * 1.08);
  const radiusYRatio = Math.max(0.14, field.radiusRatio * 0.96);
  const maxPush = 8 + field.strength * 18 + Math.min(metrics.width, metrics.height) * 0.02;

  ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
  ctx.font = metrics.font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = baseColor;

  for (const glyph of glyphs) {
    const dxRatio = (glyph.columnRatio - field.columnRatio) / radiusXRatio;
    const dyRatio = (glyph.rowRatio - field.centerRatio) / radiusYRatio;
    const distance = Math.hypot(dxRatio, dyRatio);
    const influence = getRadialHoleInfluence(distance);

    let x = glyph.column * metrics.charWidth;
    let y = glyph.row * metrics.lineHeight + metrics.baseline;

    if (influence > 0.0001) {
      let dirX = dxRatio;
      let dirY = dyRatio;
      const directionLength = Math.hypot(dirX, dirY);

      if (directionLength < 0.0001) {
        dirX = field.direction;
        dirY = 0;
      } else {
        dirX /= directionLength;
        dirY /= directionLength;
      }

      const edgeBias = 1 - Math.min(1, distance);
      const outward = influence * maxPush * wobble * (0.68 + edgeBias * 0.52);
      const swirl = Math.sin(edgeBias * Math.PI) * (0.7 + field.strength * 0.34) * wobble;

      x += dirX * outward - dirY * swirl * 1.1;
      y += dirY * outward * 0.76 + dirX * swirl * 0.62;
    }

    ctx.fillStyle = glyphColors.get(getGlyphColorKey(glyph.row, glyph.column)) ?? baseColor;
    ctx.fillText(glyph.char, x, y);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}


/** Map tailwind color classes to approximate canvas RGBA */
function classToCanvasColor(cls?: string): string {
  if (!cls) return "rgba(180, 180, 180, 0.6)";
  if (cls.includes("ember")) return "rgba(255, 170, 0, 0.85)";
  if (cls.includes("sky")) return "rgba(100, 200, 255, 0.8)";
  if (cls.includes("blue")) return "rgba(80, 160, 255, 0.75)";
  if (cls.includes("cyan")) return "rgba(80, 220, 240, 0.8)";
  if (cls.includes("teal")) return "rgba(80, 200, 180, 0.75)";
  if (cls.includes("red")) return "rgba(255, 90, 70, 0.8)";
  if (cls.includes("orange")) return "rgba(255, 170, 80, 0.8)";
  if (cls.includes("green")) return "rgba(80, 220, 100, 0.75)";
  if (cls.includes("purple")) return "rgba(180, 120, 255, 0.75)";
  if (cls.includes("yellow")) return "rgba(255, 220, 80, 0.85)";
  if (cls.includes("gray")) return "rgba(150, 150, 150, 0.5)";
  return "rgba(180, 180, 180, 0.6)";
}

/* ================================================================
   Effect particle spawners
   ================================================================ */

/* ================================================================
   Component
   ================================================================ */

/**
 * 전투 콘솔, ASCII 캐릭터, 투사체 연출을 함께 렌더링하는 메인 전투 UI다.
 */
export default function BattleCombat({
  monsterName,
  monsterAscii,
  playerAscii,
  equippedItems,
  monsterHp,
  monsterMaxHp,
  monsterShield,
  language,
  nextIntent,
  nextIntentLabel,
  battleLog,
  ambientText,
  turn,
  playerHp,
  playerMaxHp,
  playerMana,
  playerMaxMana,
  playerShield,
  playerStats,
  targetOptions,
  onAction,
  potionAvailable,
  onPotionUse,
  projectileCallbackRef,
}: BattleCombatProps) {
  const combatText = BATTLE_COMBAT_TEXT[language];
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [promptEffect, setPromptEffect] = useState<PromptEffectState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [pendingAction, setPendingAction] = useState<PlayerActionDraft | null>(null);
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeMonster, setShakeMonster] = useState(false);
  const [crtNoiseLevel, setCrtNoiseLevel] = useState<CrtNoiseLevel>("off");
  const [glitchActive, setGlitchActive] = useState(false);
  const [lungePlayer, setLungePlayer] = useState(false);
  const [monsterDying, setMonsterDying] = useState(false);
  const [hitAbsorbPlayer, setHitAbsorbPlayer] = useState(false);
  const [hitAbsorbMonster, setHitAbsorbMonster] = useState(false);
  const [playerHitWaveProgress, setPlayerHitWaveProgress] = useState<number | null>(null);
  const [monsterHitWaveProgress, setMonsterHitWaveProgress] = useState<number | null>(null);
  const [playerHitWaveScale, setPlayerHitWaveScale] = useState(1.35);
  const [monsterHitWaveScale, setMonsterHitWaveScale] = useState(1.35);
  const [playerAsciiCanvasActive, setPlayerAsciiCanvasActive] = useState(false);
  const [monsterImpactCanvasActive, setMonsterImpactCanvasActive] = useState(false);
  const [potionHomePosition, setPotionHomePosition] = useState<Point | null>(null);
  const [potionRestPosition, setPotionRestPosition] = useState<Point | null>(null);
  const [potionDragPosition, setPotionDragPosition] = useState<Point | null>(null);
  const [potionDragging, setPotionDragging] = useState(false);
  const [potionHovered, setPotionHovered] = useState(false);
  const [potionHoveringPlayer, setPotionHoveringPlayer] = useState(false);
  const [hoveredEquipmentId, setHoveredEquipmentId] = useState<string | null>(null);
  const battleFrameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneFxCanvasRef = useRef<HTMLCanvasElement>(null);
  const promptEffectCanvasRef = useRef<HTMLCanvasElement>(null);
  const playerAsciiCanvasRef = useRef<HTMLCanvasElement>(null);
  const monsterAsciiCanvasRef = useRef<HTMLCanvasElement>(null);
  const playerAsciiPreRef = useRef<HTMLPreElement>(null);
  const monsterAsciiPreRef = useRef<HTMLPreElement>(null);
  const playerOverlayRef = useRef<HTMLCanvasElement>(null);
  const monsterOverlayRef = useRef<HTMLCanvasElement>(null);
  const monsterIntentOverlayRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const slashesRef = useRef<SlashWave[]>([]);
  const effectsRef = useRef<SpriteEffect[]>([]);
  const forceFieldsRef = useRef<ForceField[]>([]);
  const sceneScatterRef = useRef<EffectParticle[]>([]);
  const intentSparksRef = useRef<EffectParticle[]>([]);
  const consolePulsesRef = useRef<ConsolePulse[]>([]);
  const lastIntentSparkFrameRef = useRef(0);
  const noiseResetRef = useRef<number | null>(null);
  const playerHitWaveFrameRef = useRef<number | null>(null);
  const monsterHitWaveFrameRef = useRef<number | null>(null);
  const promptResolveTimeoutRef = useRef<number | null>(null);
  const potionPointerOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const potionRestModeRef = useRef<"home" | "dropped">("home");
  const activePotionPointerIdRef = useRef<number | null>(null);
  const playerAsciiMetricsRef = useRef<MonsterAsciiCanvasMetrics | null>(null);
  const monsterAsciiMetricsRef = useRef<MonsterAsciiCanvasMetrics | null>(null);
  const playerPotionDisplacementRef = useRef<LiveAsciiDisplacementState | null>(null);
  const monsterImpactRef = useRef<MonsterAsciiImpactState | null>(null);
  const monsterImpactCallbackTimeoutRef = useRef<number | null>(null);
  const monsterImpactVisualTimeoutRef = useRef<number | null>(null);
  const prevPlayerHpRef = useRef(playerHp);
  const prevPlayerShieldRef = useRef(playerShield);
  const prevMonsterHpRef = useRef(monsterHp);
  const prevMonsterShieldRef = useRef(monsterShield);

  /* Keep text data in a ref so the RAF loop never needs to restart */
  const textRef = useRef({
    nextIntent,
    nextIntentLabel,
    monsterShield,
    ambientText,
    battleLog,
    monsterHp,
    turn,
    shieldLabel: combatText.shieldLabel,
  });
  const sceneAnchors = useMemo(() => getSceneAnchors(W, H), []);
  const projectileSceneAnchors = useMemo(() => getProjectileSceneAnchors(SCENE_W, SCENE_H), []);

  useEffect(() => {
    textRef.current = {
      nextIntent,
      nextIntentLabel,
      monsterShield,
      ambientText,
      battleLog,
      monsterHp,
      turn,
      shieldLabel: combatText.shieldLabel,
    };
  }, [ambientText, battleLog, combatText.shieldLabel, monsterHp, monsterShield, nextIntent, nextIntentLabel, turn]);

  const pendingTargeting = pendingAction ? getActionTargeting(pendingAction) : null;
  const availableTargets = useMemo(() => {
    if (!pendingAction) return [];
    if (pendingTargeting === "self") {
      return targetOptions.filter((target) => target.side === "player");
    }
    if (pendingTargeting === "all-enemies") {
      return targetOptions.filter((target) => target.side === "enemy");
    }
    return targetOptions;
  }, [pendingAction, pendingTargeting, targetOptions]);

  const submitResolvedAction = useCallback(
    (action: PlayerActionDraft, targetId: string) => {
      switch (action.type) {
        case "attack":
          onAction({ type: "attack", targetId });
          break;
        case "defend":
          onAction({ type: "defend", targetId });
          break;
        case "heal":
          onAction({ type: "heal", targetId });
          break;
        case "spell":
          onAction({ type: "spell", spell: action.spell, mode: action.mode, targetId });
          break;
      }

      setPendingAction(null);
      setSelectedTargetIndex(0);
      setShowPrompt(false);
      setPromptInput("");
    },
    [onAction],
  );

  const stageAction = useCallback(
    (action: PlayerActionDraft) => {
      const targeting = getActionTargeting(action);
      if (targeting === "self") {
        submitResolvedAction(action, PLAYER_TARGET_ID);
        return;
      }

      setPendingAction(action);
      setSelectedTargetIndex(0);
      setShowPrompt(false);
      setPromptInput("");
    },
    [submitResolvedAction],
  );

  const confirmTargetAtIndex = useCallback(
    (index: number) => {
      if (!pendingAction) return;
      const target = availableTargets[index];
      if (!target) return;
      setSelectedTargetIndex(index);
      submitResolvedAction(pendingAction, target.id);
    },
    [availableTargets, pendingAction, submitResolvedAction],
  );

  const setCrtReaction = useCallback((noiseLevel: CrtNoiseLevel, duration: number) => {
    if (noiseResetRef.current) {
      window.clearTimeout(noiseResetRef.current);
      noiseResetRef.current = null;
    }

    setCrtNoiseLevel(noiseLevel);
    setGlitchActive(noiseLevel === "strong");

    if (noiseLevel === "off") {
      return;
    }

    noiseResetRef.current = window.setTimeout(() => {
      setCrtNoiseLevel("off");
      setGlitchActive(false);
      noiseResetRef.current = null;
    }, duration);
  }, []);

  const startHitWave = useCallback((
    target: "player" | "monster",
    duration: number,
    damage: number,
    maxHp: number,
  ) => {
    const startedAt = performance.now();
    const settleDuration = 300;
    const frameRef = target === "player" ? playerHitWaveFrameRef : monsterHitWaveFrameRef;
    const setProgress = target === "player" ? setPlayerHitWaveProgress : setMonsterHitWaveProgress;
    const setScale = target === "player" ? setPlayerHitWaveScale : setMonsterHitWaveScale;
    const waveScale = getHitWaveScale(damage, maxHp);

    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    setScale(waveScale);

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const progress = elapsed / duration;
      setProgress(progress);

      if (elapsed < duration + settleDuration) {
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      frameRef.current = null;
      setProgress(null);
      setScale(1.35);
    };

    setProgress(0);
    frameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const triggerMonsterImpactBand = useCallback((
    impactPoint: Point,
    damage: number,
    critical = false,
  ) => {
    const duration = getMonsterImpactBandDuration(critical);
    const normalizedDamage = clamp01(damage / Math.max(1, monsterMaxHp));
    const strength = Math.min(2.2, 1.26 + normalizedDamage * 1.62 + (critical ? 0.38 : 0));
    const radiusRatio = Math.min(0.34, 0.19 + normalizedDamage * 0.12 + (critical ? 0.05 : 0));
    const sceneRect = sceneFxCanvasRef.current?.getBoundingClientRect();
    const spriteRect = monsterAsciiPreRef.current?.getBoundingClientRect();
    const hasValidRects =
      !!sceneRect && !!spriteRect && sceneRect.width > 0 && sceneRect.height > 0 && spriteRect.width > 0 && spriteRect.height > 0;
    const centerRatio = hasValidRects
      ? clamp01(
          ((sceneRect.top + (impactPoint.y / SCENE_H) * sceneRect.height) - spriteRect.top) /
            spriteRect.height,
        )
      : clamp01((impactPoint.y - SCENE_H * 0.045) / (SCENE_H * 0.72));
    const columnRatio = hasValidRects
      ? clamp01(
          ((sceneRect.left + (impactPoint.x / SCENE_W) * sceneRect.width) - spriteRect.left) /
            spriteRect.width,
        )
      : clamp01(
          (impactPoint.x - (projectileSceneAnchors.monsterShield.x - (projectileSceneAnchors.monsterCore.x - projectileSceneAnchors.monsterShield.x) * 0.58)) /
            Math.max(1, (projectileSceneAnchors.monsterCore.x - projectileSceneAnchors.monsterShield.x) * 2.5),
        );
    const direction: -1 | 1 = impactPoint.x <= projectileSceneAnchors.monsterCore.x ? 1 : -1;

    if (monsterImpactVisualTimeoutRef.current) {
      window.clearTimeout(monsterImpactVisualTimeoutRef.current);
      monsterImpactVisualTimeoutRef.current = null;
    }

    monsterImpactRef.current = {
      startedAt: performance.now(),
      duration,
      direction,
      strength,
      centerRatio,
      columnRatio,
      radiusRatio,
    };
    setMonsterImpactCanvasActive(true);
    monsterImpactVisualTimeoutRef.current = window.setTimeout(() => {
      monsterImpactVisualTimeoutRef.current = null;
      monsterImpactRef.current = null;
      setMonsterImpactCanvasActive(false);
    }, duration + 34);
  }, [monsterMaxHp, projectileSceneAnchors.monsterCore.x, projectileSceneAnchors.monsterShield.x]);

  useEffect(() => {
    const playerHitWaveFrame = playerHitWaveFrameRef;
    const monsterHitWaveFrame = monsterHitWaveFrameRef;

    return () => {
      if (promptResolveTimeoutRef.current) {
        window.clearTimeout(promptResolveTimeoutRef.current);
      }
      if (noiseResetRef.current) {
        window.clearTimeout(noiseResetRef.current);
      }
      if (playerHitWaveFrame.current) {
        window.cancelAnimationFrame(playerHitWaveFrame.current);
      }
      if (monsterHitWaveFrame.current) {
        window.cancelAnimationFrame(monsterHitWaveFrame.current);
      }
      if (monsterImpactCallbackTimeoutRef.current) {
        window.clearTimeout(monsterImpactCallbackTimeoutRef.current);
      }
      if (monsterImpactVisualTimeoutRef.current) {
        window.clearTimeout(monsterImpactVisualTimeoutRef.current);
      }
    };
  }, []);

  const hpRatio = monsterMaxHp > 0 ? monsterHp / monsterMaxHp : 1;
  const monsterTone =
    hpRatio > 0.75
      ? "rgba(224, 224, 224, 0.9)"
      : hpRatio > 0.5
        ? "rgba(198, 198, 198, 0.86)"
        : hpRatio > 0.25
          ? "rgba(168, 168, 168, 0.84)"
          : "rgba(146, 146, 146, 0.88)";
  const enemyBarWidth = 10;
  const enemyHealthFill = Math.max(
    0,
    Math.min(enemyBarWidth, Math.round((monsterHp / Math.max(1, monsterMaxHp)) * enemyBarWidth)),
  );
  const enemyTotalFill = Math.max(
    enemyHealthFill,
    Math.min(
      enemyBarWidth,
      Math.round(((monsterHp + monsterShield) / Math.max(1, monsterMaxHp)) * enemyBarWidth),
    ),
  );
  const enemyShieldFill = Math.max(0, enemyTotalFill - enemyHealthFill);
  const playerAsciiText = playerAscii.join("\n");
  const equippedItemList = useMemo(() => getEquippedItems(equippedItems), [equippedItems]);
  const playerGlyphColorMap = useMemo(
    () => buildEquipmentGlyphColorMap(playerAscii, equippedItemList),
    [equippedItemList, playerAscii],
  );
  const playerAsciiGlyphs = useMemo(() => buildMonsterAsciiGlyphs(playerAscii), [playerAscii]);
  const monsterAsciiText = monsterAscii.join("\n");
  const monsterAsciiGlyphs = useMemo(() => buildMonsterAsciiGlyphs(monsterAscii), [monsterAscii]);
  const promptEffectActive = Boolean(promptEffect);
  const playerAsciiMarkup = useMemo(() => {
    const nodes: ReactNode[] = [];
    let tintedKey = 0;

    playerAscii.forEach((line, row) => {
      let buffer = "";
      let activeColor: string | null = null;

      const flush = () => {
        if (!buffer) {
          return;
        }

        if (activeColor) {
          nodes.push(
            <span key={`player-tint-${tintedKey += 1}`} style={{ color: activeColor }}>
              {buffer}
            </span>,
          );
        } else {
          nodes.push(buffer);
        }

        buffer = "";
      };

      for (let column = 0; column < line.length; column += 1) {
        const nextColor = playerGlyphColorMap.get(getGlyphColorKey(row, column)) ?? null;
        if (nextColor !== activeColor) {
          flush();
          activeColor = nextColor;
        }

        buffer += line[column];
      }

      flush();
      activeColor = null;

      if (row < playerAscii.length - 1) {
        nodes.push("\n");
      }
    });

    return nodes;
  }, [playerAscii, playerGlyphColorMap]);
  const playerAsciiStyle = buildHitWaveTextStyle(
    "rgba(244, 244, 244, 0.98)",
    "rgba(176, 8, 20, 0.99)",
    "0 0 1px rgba(255,255,255,0.25), 0 0 10px rgba(255,255,255,0.06)",
    "0 0 16px rgba(128, 0, 12, 0.62)",
    playerHitWaveProgress,
    playerHitWaveScale,
    shakePlayer,
  );
  const monsterAsciiStyle = buildHitWaveTextStyle(
    monsterTone,
    "rgba(176, 8, 20, 0.99)",
    "0 0 1px rgba(255,255,255,0.18), 0 0 8px rgba(255,255,255,0.04)",
    "0 0 16px rgba(128, 0, 12, 0.58)",
    monsterHitWaveProgress,
    monsterHitWaveScale,
    shakeMonster,
  );
  const playerAsciiClassName = `m-0 whitespace-pre text-[8.8px] leading-[9px] select-none sm:text-[10px] sm:leading-[10.2px] lg:text-[11.8px] lg:leading-[12px] ${
    hitAbsorbPlayer ? "animate-hit-absorb" : ""
  }`;
  const monsterAsciiClassName = `m-0 whitespace-pre text-[6.1px] leading-[6.4px] select-none sm:text-[6.9px] sm:leading-[7.2px] lg:text-[8px] lg:leading-[8.3px] ${
    hitAbsorbMonster ? "animate-hit-absorb" : ""
  }`;
  const playerAsciiRenderRef = useRef({
    glyphs: playerAsciiGlyphs,
    glyphColors: playerGlyphColorMap,
  });
  const monsterAsciiRenderRef = useRef({ glyphs: monsterAsciiGlyphs, tone: monsterTone });

  useEffect(() => {
    playerAsciiRenderRef.current = {
      glyphs: playerAsciiGlyphs,
      glyphColors: playerGlyphColorMap,
    };
  }, [playerAsciiGlyphs, playerGlyphColorMap]);

  useEffect(() => {
    monsterAsciiRenderRef.current = { glyphs: monsterAsciiGlyphs, tone: monsterTone };
  }, [monsterAsciiGlyphs, monsterTone]);

  const syncPlayerAsciiCanvasMetrics = useCallback(() => {
    const canvas = playerAsciiCanvasRef.current;
    const pre = playerAsciiPreRef.current;
    if (!canvas || !pre) return;

    const rect = pre.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.round(rect.width * dpr));
    const targetHeight = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const styles = window.getComputedStyle(pre);
    const fontSize = parseFloat(styles.fontSize) || 12;
    const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.05;
    const font = `${styles.fontWeight} ${fontSize}px ${styles.fontFamily}`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = font;

    playerAsciiMetricsRef.current = {
      dpr,
      width: rect.width,
      height: rect.height,
      charWidth: ctx.measureText("M").width,
      lineHeight,
      baseline: fontSize * 0.84 + Math.max(0, (lineHeight - fontSize) * 0.5),
      font,
    };
  }, []);

  const syncMonsterAsciiCanvasMetrics = useCallback(() => {
    const canvas = monsterAsciiCanvasRef.current;
    const pre = monsterAsciiPreRef.current;
    if (!canvas || !pre) return;

    const rect = pre.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.round(rect.width * dpr));
    const targetHeight = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const styles = window.getComputedStyle(pre);
    const fontSize = parseFloat(styles.fontSize) || 8;
    const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.05;
    const font = `${styles.fontWeight} ${fontSize}px ${styles.fontFamily}`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = font;

    monsterAsciiMetricsRef.current = {
      dpr,
      width: rect.width,
      height: rect.height,
      charWidth: ctx.measureText("M").width,
      lineHeight,
      baseline: fontSize * 0.84 + Math.max(0, (lineHeight - fontSize) * 0.5),
      font,
    };
  }, []);

  useEffect(() => {
    syncPlayerAsciiCanvasMetrics();

    const frame = window.requestAnimationFrame(syncPlayerAsciiCanvasMetrics);
    const pre = playerAsciiPreRef.current;
    let observer: ResizeObserver | null = null;

    if (pre && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        syncPlayerAsciiCanvasMetrics();
      });
      observer.observe(pre);
    }

    window.addEventListener("resize", syncPlayerAsciiCanvasMetrics);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", syncPlayerAsciiCanvasMetrics);
    };
  }, [playerAsciiText, syncPlayerAsciiCanvasMetrics]);

  useEffect(() => {
    syncMonsterAsciiCanvasMetrics();

    const frame = window.requestAnimationFrame(syncMonsterAsciiCanvasMetrics);
    const pre = monsterAsciiPreRef.current;
    let observer: ResizeObserver | null = null;

    if (pre && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        syncMonsterAsciiCanvasMetrics();
      });
      observer.observe(pre);
    }

    window.addEventListener("resize", syncMonsterAsciiCanvasMetrics);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", syncMonsterAsciiCanvasMetrics);
    };
  }, [monsterAsciiText, syncMonsterAsciiCanvasMetrics]);

  const syncPotionHomePosition = useCallback(() => {
    const frame = battleFrameRef.current;
    const playerPre = playerAsciiPreRef.current;
    if (!frame || !playerPre) return;

    const frameRect = frame.getBoundingClientRect();
    const playerRect = playerPre.getBoundingClientRect();
    if (frameRect.width < 1 || frameRect.height < 1 || playerRect.width < 1 || playerRect.height < 1) {
      return;
    }

    const nextHome = {
      x: playerRect.left - frameRect.left + playerRect.width * 0.55 - 50,
      y: playerRect.top - frameRect.top + playerRect.height * 0 - 150,
    };

    setPotionHomePosition((current) => {
      if (
        current &&
        Math.abs(current.x - nextHome.x) < 0.5 &&
        Math.abs(current.y - nextHome.y) < 0.5
      ) {
        return current;
      }
      return nextHome;
    });

    setPotionRestPosition((current) => {
      if (potionRestModeRef.current === "dropped" && current) {
        return current;
      }
      if (
        current &&
        Math.abs(current.x - nextHome.x) < 0.5 &&
        Math.abs(current.y - nextHome.y) < 0.5
      ) {
        return current;
      }
      return nextHome;
    });
  }, []);

  useEffect(() => {
    syncPotionHomePosition();

    const frame = window.requestAnimationFrame(syncPotionHomePosition);
    const playerPre = playerAsciiPreRef.current;
    const battleFrame = battleFrameRef.current;
    let observer: ResizeObserver | null = null;

    if ((playerPre || battleFrame) && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        syncPotionHomePosition();
      });
      if (playerPre) {
        observer.observe(playerPre);
      }
      if (battleFrame) {
        observer.observe(battleFrame);
      }
    }

    window.addEventListener("resize", syncPotionHomePosition);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", syncPotionHomePosition);
    };
  }, [playerAsciiText, potionAvailable, syncPotionHomePosition]);

  const updatePotionHoverState = useCallback((framePoint: Point) => {
    const frameRect = battleFrameRef.current?.getBoundingClientRect();
    const playerRect = playerAsciiPreRef.current?.getBoundingClientRect();
    if (!frameRect || !playerRect || playerRect.width < 1 || playerRect.height < 1) {
      playerPotionDisplacementRef.current = null;
      setPotionHoveringPlayer(false);
      setPlayerAsciiCanvasActive(false);
      return false;
    }

    const viewportPoint = {
      x: frameRect.left + framePoint.x,
      y: frameRect.top + framePoint.y,
    };
    const hovering = pointInsideDomRect(viewportPoint, playerRect, 18);
    setPotionHoveringPlayer((current) => (current === hovering ? current : hovering));
    setPlayerAsciiCanvasActive((current) => (current === hovering ? current : hovering));

    if (!hovering) {
      playerPotionDisplacementRef.current = null;
      return false;
    }

    const columnRatio = clamp01((viewportPoint.x - playerRect.left) / playerRect.width);
    const centerRatio = clamp01((viewportPoint.y - playerRect.top) / playerRect.height);
    const centeredX = columnRatio - 0.5;
    const centeredY = centerRatio - 0.44;
    const distance = Math.min(1, Math.hypot(centeredX * 1.45, centeredY * 1.28));

    playerPotionDisplacementRef.current = {
      direction: centeredX <= 0 ? -1 : 1,
      strength: 1.12 + (1 - distance) * 1.06,
      centerRatio,
      columnRatio,
      radiusRatio: 0.22 + (1 - distance) * 0.08,
    };
    return true;
  }, []);

  const getClampedPotionFramePoint = useCallback((clientX: number, clientY: number) => {
    const frameRect = battleFrameRef.current?.getBoundingClientRect();
    if (!frameRect) {
      return null;
    }

    const rawX = clientX - frameRect.left - potionPointerOffsetRef.current.x;
    const rawY = clientY - frameRect.top - potionPointerOffsetRef.current.y;

    return {
      x: Math.max(POTION_WIDTH * 0.5, Math.min(frameRect.width - POTION_WIDTH * 0.5, rawX)),
      y: Math.max(POTION_HEIGHT * 0.5, Math.min(frameRect.height - POTION_HEIGHT * 0.5, rawY)),
    };
  }, []);

  const handlePotionPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!potionAvailable) return;

    const targetRect = event.currentTarget.getBoundingClientRect();
    activePotionPointerIdRef.current = event.pointerId;
    potionPointerOffsetRef.current = {
      x: event.clientX - (targetRect.left + targetRect.width * 0.5),
      y: event.clientY - (targetRect.top + targetRect.height * 0.5),
    };

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPotionDragging(true);

    const nextPoint = getClampedPotionFramePoint(event.clientX, event.clientY);
    if (!nextPoint) {
      return;
    }

    setPotionDragPosition(nextPoint);
    updatePotionHoverState(nextPoint);
  }, [getClampedPotionFramePoint, potionAvailable, updatePotionHoverState]);

  const handlePotionPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!potionDragging || activePotionPointerIdRef.current !== event.pointerId) return;

    const nextPoint = getClampedPotionFramePoint(event.clientX, event.clientY);
    if (!nextPoint) {
      return;
    }

    event.preventDefault();
    setPotionDragPosition(nextPoint);
    updatePotionHoverState(nextPoint);
  }, [getClampedPotionFramePoint, potionDragging, updatePotionHoverState]);

  const finishPotionDrag = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    if (activePotionPointerIdRef.current !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePotionPointerIdRef.current = null;

    const nextPoint = getClampedPotionFramePoint(event.clientX, event.clientY);
    const hoveringPlayer = cancelled || !nextPoint ? false : updatePotionHoverState(nextPoint);
    let potionConsumed = false;

    if (!cancelled && hoveringPlayer && nextPoint) {
      const healedAmount = onPotionUse();
      if (healedAmount > 0) {
        potionConsumed = true;
        const frameRect = battleFrameRef.current?.getBoundingClientRect();
        if (frameRect && frameRect.width > 0 && frameRect.height > 0) {
          spawnPotionShatterBurst(sceneScatterRef.current, {
            x: (nextPoint.x / frameRect.width) * SCENE_W,
            y: (nextPoint.y / frameRect.height) * SCENE_H,
          });
        } else {
          spawnPotionShatterBurst(sceneScatterRef.current, projectileSceneAnchors.playerCore);
        }
      } else if (playerHp >= playerMaxHp && potionHomePosition) {
        potionRestModeRef.current = "home";
        setPotionRestPosition(potionHomePosition);
      }
    }

    if (!potionConsumed && nextPoint) {
      if (!(hoveringPlayer && playerHp >= playerMaxHp && potionHomePosition)) {
        potionRestModeRef.current = "dropped";
        setPotionRestPosition(nextPoint);
      }
    }

    playerPotionDisplacementRef.current = null;
    setPlayerAsciiCanvasActive(false);
    setPotionHovered(false);
    setPotionHoveringPlayer(false);
    setPotionDragging(false);
    setPotionDragPosition(null);
  }, [getClampedPotionFramePoint, onPotionUse, playerHp, playerMaxHp, potionHomePosition, projectileSceneAnchors.playerCore, updatePotionHoverState]);

  const handlePotionPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    finishPotionDrag(event, false);
  }, [finishPotionDrag]);

  const handlePotionPointerCancel = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    finishPotionDrag(event, true);
  }, [finishPotionDrag]);

  // ── Effect helpers ──
  const triggerEffect = useCallback(
    (
      type: SpriteEffect["type"],
      target: "player" | "monster",
      duration: number,
      element?: string,
    ) => {
      const overlayRef = target === "player" ? playerOverlayRef : monsterOverlayRef;
      const canvas = overlayRef.current;
      const w = canvas?.width ?? 200;
      const h = canvas?.height ?? 200;

      let particles: EffectParticle[];
      let persistent = false;
      switch (type) {
        case "heal":
          particles = spawnHealParticles(w, h);
          break;
        case "slash":
          particles = spawnSlashParticles(w, h);
          break;
        case "defend":
          particles = spawnDefendParticles(w, h);
          break;
        case "spell":
          particles = spawnSpellParticles(w, h, element);
          break;
        case "charge":
          particles = spawnChargeParticles(w, h);
          persistent = true;
          break;
        case "shieldCharge":
          particles = spawnShieldChargeParticles(w, h);
          persistent = true;
          break;
        case "hit":
          particles = spawnHitParticles(w, h, element);
          break;
        default:
          particles = [];
      }

      effectsRef.current.push({
        type,
        target,
        element,
        startTime: performance.now(),
        duration,
        particles,
        persistent,
      });
    },
    [],
  );

  // ── Detect heal (playerHp increase) ──
  useEffect(() => {
    if (playerHp > prevPlayerHpRef.current) {
      triggerEffect("heal", "player", 2400);
    }
    prevPlayerHpRef.current = playerHp;
  }, [playerHp, triggerEffect]);

  // ── Shield visual: persist while playerShield > 0 ──
  const shieldForceFieldRef = useRef<ForceField | null>(null);
  useEffect(() => {
    if (playerShield > 0 && prevPlayerShieldRef.current === 0) {
      // Shield just activated — start persistent defend effect + force field
      const overlayRef = playerOverlayRef;
      const canvas = overlayRef.current;
      const ew = canvas?.width ?? 200;
      const eh = canvas?.height ?? 200;
      effectsRef.current.push({
        type: "defend",
        target: "player",
        startTime: performance.now(),
        duration: 999999,
        particles: spawnDefendParticles(ew, eh),
        persistent: true,
      });
      const ff: ForceField = {
        x: sceneAnchors.playerShield.center.x,
        y: sceneAnchors.playerShield.center.y,
        radius: 120,
        strength: 1.2,
        startTime: performance.now(),
        duration: 999999,
      };
      forceFieldsRef.current.push(ff);
      shieldForceFieldRef.current = ff;
    }
    if (playerShield === 0 && prevPlayerShieldRef.current > 0) {
      // Shield broke — shatter burst + clear
      spawnImpactBurst(
        sceneScatterRef.current,
        { x: SCENE_W * 0.35, y: SCENE_H * 0.49 },
        "shieldBreak",
      );

      effectsRef.current = effectsRef.current.filter(
        e => !(e.type === "defend" && e.target === "player"),
      );
      if (shieldForceFieldRef.current) {
        forceFieldsRef.current = forceFieldsRef.current.filter(
          ff => ff !== shieldForceFieldRef.current,
        );
        shieldForceFieldRef.current = null;
      }
    }
    prevPlayerShieldRef.current = playerShield;
  }, [playerShield, sceneAnchors.playerShield.center.x, sceneAnchors.playerShield.center.y, triggerEffect]);

  // ── Monster shield visual: persist while monsterShield > 0 ──
  const monsterShieldForceFieldRef = useRef<ForceField | null>(null);
  useEffect(() => {
    if (monsterShield > 0 && prevMonsterShieldRef.current === 0) {
      const canvas = monsterOverlayRef.current;
      const ew = canvas?.width ?? 200;
      const eh = canvas?.height ?? 200;
      effectsRef.current.push({
        type: "defend",
        target: "monster",
        startTime: performance.now(),
        duration: 999999,
        particles: spawnMonsterDefendParticles(ew, eh),
        persistent: true,
      });
      const ff: ForceField = {
        x: sceneAnchors.monsterShield.center.x,
        y: sceneAnchors.monsterShield.center.y,
        radius: 120,
        strength: -1.2,
        startTime: performance.now(),
        duration: 999999,
      };
      forceFieldsRef.current.push(ff);
      monsterShieldForceFieldRef.current = ff;
    }
    if (monsterShield === 0 && prevMonsterShieldRef.current > 0) {
      // Shield broke — shatter burst + clear
      spawnImpactBurst(
        sceneScatterRef.current,
        projectileSceneAnchors.monsterShield,
        "shieldBreak",
      );

      effectsRef.current = effectsRef.current.filter(
        e => !(e.type === "defend" && e.target === "monster"),
      );
      if (monsterShieldForceFieldRef.current) {
        forceFieldsRef.current = forceFieldsRef.current.filter(
          ff => ff !== monsterShieldForceFieldRef.current,
        );
        monsterShieldForceFieldRef.current = null;
      }
    }
    prevMonsterShieldRef.current = monsterShield;
  }, [
    monsterShield,
    projectileSceneAnchors.monsterShield,
    sceneAnchors.monsterShield.center.x,
    sceneAnchors.monsterShield.center.y,
  ]);

  // ── Detect monster death (guard: only fire once, delayed for projectile+hit) ──
  const monsterDeathFiredRef = useRef(false);
  const monsterDeathTimerRef = useRef<number>(0);
  useEffect(() => {
    if (monsterHp <= 0 && prevMonsterHpRef.current > 0 && !monsterDeathFiredRef.current) {
      monsterDeathFiredRef.current = true;
      // HP now changes on impact, so only leave a short pause for the hit flash.
      monsterDeathTimerRef.current = window.setTimeout(() => {
        setMonsterDying(true);
      }, 360);
    }
    prevMonsterHpRef.current = monsterHp;
    return () => {
      if (monsterDeathTimerRef.current) {
        window.clearTimeout(monsterDeathTimerRef.current);
      }
    };
  }, [monsterHp]);

  const flashShieldImpact = useCallback(
    (target: "player" | "monster", outcome: "perfect" | "partial" = "perfect") => {
      const center =
        target === "player"
          ? { x: SCENE_W * 0.35, y: SCENE_H * 0.49 }
          : projectileSceneAnchors.monsterShield;

      triggerEffect("defend", target, 700);
      spawnImpactBurst(
        sceneScatterRef.current,
        center,
        outcome === "perfect" ? "shieldBreak" : "shieldHit",
      );
      if (target === "player") {
        consolePulsesRef.current.push({
          color: "blue",
          startTime: performance.now(),
          duration: outcome === "perfect" ? 820 : 680,
          strength: outcome === "perfect" ? "strong" : "soft",
        });
        setCrtReaction(outcome === "perfect" ? "off" : "soft", outcome === "perfect" ? 0 : 420);
      }
    },
    [
      projectileSceneAnchors.monsterShield,
      setCrtReaction,
      triggerEffect,
    ],
  );

  const flashMonsterImpact = useCallback(
    (word: string, impactPoint: Point, element?: string, damage = 0, critical = false) => {
      const impactTone = critical ? "critical" : word === "STRIKE" ? "strike" : element;
      const settleDelay = getMonsterImpactSettleDelay(critical);
      setShakeMonster(true);
      window.setTimeout(() => setShakeMonster(false), 600);
      startHitWave("monster", 620, damage, monsterMaxHp);
      triggerMonsterImpactBand(impactPoint, damage, critical);
      if (word === "STRIKE") {
        triggerEffect("slash", "monster", 1320);
      } else {
        triggerEffect("spell", "monster", 1640, element);
      }
      triggerEffect("hit", "monster", 920, impactTone);
      spawnImpactBurst(sceneScatterRef.current, impactPoint, "monsterHit", impactTone);
      setHitAbsorbMonster(true);
      window.setTimeout(() => setHitAbsorbMonster(false), 620);
      return settleDelay;
    },
    [monsterMaxHp, startHitWave, triggerEffect, triggerMonsterImpactBand],
  );

  const flashPlayerImpact = useCallback((outcome: "partial" | "full" = "full", damage = 0) => {
    setShakePlayer(true);
    window.setTimeout(() => setShakePlayer(false), 600);
    startHitWave("player", outcome === "full" ? 540 : 480, damage, playerMaxHp);
    triggerEffect("hit", "player", 600);
    setHitAbsorbPlayer(true);
    window.setTimeout(() => setHitAbsorbPlayer(false), 500);
    consolePulsesRef.current.push({
      color: "red",
      startTime: performance.now(),
      duration: outcome === "full" ? 860 : 620,
      strength: outcome === "full" ? "strong" : "soft",
    });
    setCrtReaction(outcome === "full" ? "strong" : "soft", outcome === "full" ? 620 : 360);
  }, [playerMaxHp, setCrtReaction, startHitWave, triggerEffect]);

  // ── Projectile callback ──
  useEffect(() => {
    projectileCallbackRef.current = (request: CombatAnimationRequest) => {
      if (!request.word) return;

      if (request.fromPlayer) {
        if (request.word === "STRIKE") {
          setLungePlayer(true);
          window.setTimeout(() => setLungePlayer(false), 700);
        }

        const isSelfReturn = request.targetSide === "player" && !request.missed;
        const missHeading = {
          x: projectileSceneAnchors.monsterCore.x - projectileSceneAnchors.playerMuzzle.x,
          y: projectileSceneAnchors.monsterCore.y - projectileSceneAnchors.playerMuzzle.y,
        };
        const isMonsterBodyHit =
          !request.missed &&
          request.targetSide === "enemy" &&
          !request.blocked &&
          !isSelfReturn;
        const target = request.missed
          ? sampleRandomOffscreenPoint(projectileSceneAnchors.playerMuzzle, missHeading)
          : isSelfReturn
            ? request.blocked
              ? projectileSceneAnchors.playerShield
              : projectileSceneAnchors.playerCore
            : request.blocked
              ? projectileSceneAnchors.monsterShield
              : isMonsterBodyHit
                ? sampleMonsterImpactPoint(projectileSceneAnchors)
                : projectileSceneAnchors.monsterCore;
        const returnTurn = isSelfReturn
          ? {
              x: projectileSceneAnchors.playerMuzzle.x + SCENE_W * 0.24,
              y: projectileSceneAnchors.playerMuzzle.y - SCENE_H * 0.23,
            }
          : undefined;
        const returnControl = isSelfReturn && returnTurn
          ? {
              x: returnTurn.x + SCENE_W * 0.04,
              y: returnTurn.y + SCENE_H * 0.05,
            }
          : undefined;
        const directionX = target.x - projectileSceneAnchors.playerMuzzle.x;
        const directionY = target.y - projectileSceneAnchors.playerMuzzle.y;
        const directionLength = Math.max(1, Math.hypot(directionX, directionY));
        const impactInset = request.missed
          ? 0
          : isSelfReturn
            ? 8 + request.word.length * 5
            : isMonsterBodyHit
              ? 0
              : 16 + request.word.length * 11;
        const impactX = target.x + (directionX / directionLength) * impactInset;
        const impactY = target.y + (directionY / directionLength) * impactInset;

        projectilesRef.current.push({
          chars: request.word.split(""),
          x: projectileSceneAnchors.playerMuzzle.x,
          y: projectileSceneAnchors.playerMuzzle.y,
          startX: projectileSceneAnchors.playerMuzzle.x,
          startY: projectileSceneAnchors.playerMuzzle.y,
          controlX: returnControl?.x,
          controlY: returnControl?.y,
          turnX: returnTurn?.x,
          turnY: returnTurn?.y,
          targetX: impactX,
          targetY: impactY,
          startTime: performance.now(),
          duration: isSelfReturn ? 1180 : 920,
          alive: true,
          fromPlayer: true,
          element: request.element,
          shielded: request.shielded,
          blocked: request.blocked,
          critical: request.critical,
          missed: request.missed,
          onImpact: () => {
            if (request.missed) {
              request.onImpact?.();
              return;
            }

            if (request.shielded) {
              flashShieldImpact(
                request.targetSide === "player" ? "player" : "monster",
                request.blocked ? "perfect" : "partial",
              );
            }
            if (!request.blocked) {
              if (request.targetSide === "player") {
                spawnImpactBurst(
                  sceneScatterRef.current,
                  { x: impactX, y: impactY },
                  "monsterHit",
                  request.critical ? "critical" : request.element ?? "strike",
                );
                flashPlayerImpact(
                  request.shielded ? "partial" : "full",
                  request.impactDamage ?? 0,
                );
              } else {
                const settleDelay = flashMonsterImpact(
                  request.word,
                  { x: impactX, y: impactY },
                  request.element,
                  request.impactDamage ?? 0,
                  request.critical,
                );
                if (monsterImpactCallbackTimeoutRef.current) {
                  window.clearTimeout(monsterImpactCallbackTimeoutRef.current);
                  monsterImpactCallbackTimeoutRef.current = null;
                }
                monsterImpactCallbackTimeoutRef.current = window.setTimeout(() => {
                  monsterImpactCallbackTimeoutRef.current = null;
                  request.onImpact?.();
                }, settleDelay);
                return;
              }
            }
            request.onImpact?.();
          },
          offsets: request.word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
        });
        return;
      }

      slashesRef.current.push({
        label: request.word,
        points: buildSlashSamples(
          sceneAnchors.slashStart,
          sceneAnchors.slashControl,
          sceneAnchors.slashEnd,
        ),
        blocked: request.blocked,
        shielded: request.shielded,
        alive: true,
        startTime: performance.now(),
        duration: 760,
        recoveryDuration: 1050,
        onImpact: () => {
          if (request.shielded) {
            flashShieldImpact("player", request.blocked ? "perfect" : "partial");
          }
          if (!request.blocked) {
            flashPlayerImpact(request.shielded ? "partial" : "full", request.impactDamage ?? 0);
          }
          request.onImpact?.();
        },
      });
    };
    return () => {
      projectileCallbackRef.current = null;
    };
  }, [
    flashMonsterImpact,
    flashPlayerImpact,
    flashShieldImpact,
    projectileCallbackRef,
    projectileSceneAnchors,
    sceneAnchors,
  ]);

  // ── Canvas loop — pretext dynamic layout + projectiles + effects ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sceneFxCanvas = sceneFxCanvasRef.current;
    const sceneFxCtx = sceneFxCanvas?.getContext("2d") ?? null;

    canvas.width = W;
    canvas.height = H;
    if (sceneFxCanvas) {
      sceneFxCanvas.width = SCENE_W;
      sceneFxCanvas.height = SCENE_H;
    }

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      sceneFxCtx?.clearRect(0, 0, SCENE_W, SCENE_H);
      const sceneRect = sceneFxCanvas?.getBoundingClientRect() ?? null;
      const consoleRect = canvas.getBoundingClientRect();
      const canProjectToConsole =
        !!sceneRect && sceneRect.width > 0 && sceneRect.height > 0 && consoleRect.width > 0 && consoleRect.height > 0;
      const {
        nextIntent: intent,
        nextIntentLabel: intentLabel,
        monsterShield: mShield,
        ambientText: ambient,
        battleLog: log,
        monsterHp: currentMonsterHp,
        turn: currentTurn,
        shieldLabel,
      } = textRef.current;
      const projectiles = projectilesRef.current;
      const slashes = slashesRef.current;
      const forceFields = forceFieldsRef.current;
      const now = performance.now();
      const intentSparkFrameDuration = 1000 / 12;
      const advanceIntentSparkFrame =
        now - lastIntentSparkFrameRef.current >= intentSparkFrameDuration;
      if (advanceIntentSparkFrame) {
        lastIntentSparkFrameRef.current = now;
      }
      const activeSlashFields: SlashField[] = [];
      const activeSlashRender: Array<{
        slash: SlashWave;
        visiblePoints: SlashSample[];
        intensity: number;
        sweep: number;
      }> = [];
      const torchFlicker = Math.max(
        0.58,
        Math.min(
          0.94,
          0.76 +
            Math.sin(now * 0.0042) * 0.08 +
            Math.sin(now * 0.0018 + 1.4) * 0.05,
        ),
      );
      const torchInk = 0.08 + torchFlicker * 0.16;

      // Prune expired force fields
      forceFieldsRef.current = forceFields.filter(
        (ff) => now - ff.startTime < ff.duration,
      );

      for (const slash of slashes) {
        if (!slash.alive) continue;

        const elapsed = now - slash.startTime;
        const totalDuration = slash.duration + slash.recoveryDuration;
        if (elapsed > totalDuration) {
          slash.alive = false;
          continue;
        }

        const sweep = clamp01(elapsed / slash.duration);
        const recover =
          elapsed <= slash.duration
            ? 0
            : clamp01((elapsed - slash.duration) / slash.recoveryDuration);
        const intensity =
          sweep < 1
            ? 0.18 + easeOutCubic(sweep) * 0.82
            : 1 - easeOutCubic(easeInOutCubic(recover));
        const visiblePoints = slash.points.filter((point) => point.t <= Math.max(0.08, sweep));

        activeSlashFields.push({
          points: visiblePoints,
          intensity: intensity * (slash.blocked ? 0.72 : 1),
          thickness: slash.blocked ? SLASH_THICKNESS * 0.88 : SLASH_THICKNESS * 1.18,
          strength: slash.blocked ? 21 : 30,
          alphaLoss: slash.blocked ? 0.3 : 0.5,
        });
        activeSlashRender.push({ slash, visiblePoints, intensity, sweep });

        if (!slash.impactTriggered && sweep >= 0.72) {
          slash.impactTriggered = true;
          slash.onImpact?.();
        }
      }

      slashesRef.current = slashes.filter((slash) => slash.alive);

      ctx.font = makeFont(560, BASE_FONT_SIZE);
      ctx.textBaseline = "top";
      const frame = drawAsciiConsoleFrame(
        ctx,
        `rgba(214, 184, 124, ${(0.24 + torchFlicker * 0.16).toFixed(2)})`,
      );

      ctx.font = CRT_FONT;
      const consoleCharWidth = ctx.measureText("M").width;

      const consolePulses = consolePulsesRef.current.filter(
        (pulse) => now - pulse.startTime < pulse.duration,
      );
      consolePulsesRef.current = consolePulses;
      const consoleInnerStartX = frame.startX + consoleCharWidth * 2;
      const consoleInnerWidth = consoleCharWidth * Math.max(1, frame.cols - 4);
      const textBounds = {
        startX: consoleInnerStartX,
        maxWidth: consoleInnerWidth,
        lineHeight: LINE_H,
      };
      const consoleProjectiles: Projectile[] = [];
      const projectileRenderState: Array<{
        projectile: Projectile;
        angle: number;
        progress: number;
        travel: number;
      }> = [];

      for (const p of projectiles) {
        if (!p.alive) continue;

        const progress = clamp01((now - p.startTime) / p.duration);
        const hasReturnTurn = p.turnX !== undefined && p.turnY !== undefined;
        const travel = hasReturnTurn
          ? progress
          : p.controlX !== undefined && p.controlY !== undefined
            ? easeInOutCubic(progress)
            : easeInCubic(progress);
        const basePoint = hasReturnTurn
          ? (() => {
              const split = 0.54;
              if (travel <= split) {
                const outbound = easeOutCubic(travel / split);
                return sampleQuadraticPoint(
                  { x: p.startX, y: p.startY },
                  {
                    x: lerp(p.startX, p.turnX!, 0.78),
                    y: Math.min(p.startY, p.turnY!) - SCENE_H * 0.035,
                  },
                  { x: p.turnX!, y: p.turnY! },
                  outbound,
                );
              }

              const returning = easeInOutCubic((travel - split) / (1 - split));
              return sampleQuadraticPoint(
                { x: p.turnX!, y: p.turnY! },
                {
                  x: p.controlX ?? lerp(p.turnX!, p.targetX, 0.35),
                  y: p.controlY ?? lerp(p.turnY!, p.targetY, 0.45),
                },
                { x: p.targetX, y: p.targetY },
                returning,
              );
            })()
          : p.controlX !== undefined && p.controlY !== undefined
            ? sampleQuadraticPoint(
                { x: p.startX, y: p.startY },
                { x: p.controlX, y: p.controlY },
                { x: p.targetX, y: p.targetY },
                travel,
              )
            : {
                x: lerp(p.startX, p.targetX, travel),
                y: lerp(p.startY, p.targetY, travel),
              };
        const tangent = hasReturnTurn
          ? (() => {
              const split = 0.54;
              if (travel <= split) {
                const outbound = easeOutCubic(travel / split);
                return sampleQuadraticTangent(
                  { x: p.startX, y: p.startY },
                  {
                    x: lerp(p.startX, p.turnX!, 0.78),
                    y: Math.min(p.startY, p.turnY!) - SCENE_H * 0.035,
                  },
                  { x: p.turnX!, y: p.turnY! },
                  outbound,
                );
              }

              const returning = easeInOutCubic((travel - split) / (1 - split));
              return sampleQuadraticTangent(
                { x: p.turnX!, y: p.turnY! },
                {
                  x: p.controlX ?? lerp(p.turnX!, p.targetX, 0.35),
                  y: p.controlY ?? lerp(p.turnY!, p.targetY, 0.45),
                },
                { x: p.targetX, y: p.targetY },
                returning,
              );
            })()
          : p.controlX !== undefined && p.controlY !== undefined
            ? sampleQuadraticTangent(
                { x: p.startX, y: p.startY },
                { x: p.controlX, y: p.controlY },
                { x: p.targetX, y: p.targetY },
                travel,
              )
            : {
                x: p.targetX - p.startX,
                y: p.targetY - p.startY,
              };
        const angle = Math.atan2(tangent.y, tangent.x);

        p.x = basePoint.x;
        p.y = basePoint.y;

        p.offsets.forEach((offset) => {
          offset.dx = 0;
          offset.dy = 0;
          offset.rot = 0;
        });

        projectileRenderState.push({ projectile: p, angle, progress, travel });

        if (!canProjectToConsole || !sceneRect) {
          continue;
        }

        const consolePoint = mapScenePointToConsolePoint({ x: p.x, y: p.y }, sceneRect, consoleRect);
        if (
          consolePoint.x >= -DISPLACE_RADIUS &&
          consolePoint.x <= W + DISPLACE_RADIUS &&
          consolePoint.y >= -DISPLACE_RADIUS &&
          consolePoint.y <= H + DISPLACE_RADIUS
        ) {
          consoleProjectiles.push({
            ...p,
            x: consolePoint.x,
            y: consolePoint.y,
          });
        }
      }

      let y = frame.topY + LINE_H + 14;

      // 1. Monster intent (orange, highest priority)
      y = renderTextBlockPhysics(
        ctx,
        `> ${intentLabel}`,
        `rgba(255, 170, 60, ${(0.72 + torchFlicker * 0.14).toFixed(2)})`,
        y,
        consoleProjectiles,
        forceFields,
        activeSlashFields,
        { fontWeight: 700, inkBleed: 0.22 + torchInk },
        textBounds,
      );
      y += 4;

      if (mShield > 0) {
        y = renderTextBlockPhysics(
          ctx,
          `  [${shieldLabel}: ${mShield}]`,
          "rgba(100, 180, 255, 0.68)",
          y,
          consoleProjectiles,
          forceFields,
          activeSlashFields,
          { fontWeight: 620, inkBleed: 0.08 + torchInk * 0.28 },
          textBounds,
        );
      }

      // 2. Ambient text (dim, medium priority)
      y = renderTextBlockPhysics(
        ctx,
        ambient,
        `rgba(180, 180, 180, ${(0.4 + torchFlicker * 0.08).toFixed(2)})`,
        y,
        consoleProjectiles,
        forceFields,
        activeSlashFields,
        { fontWeight: 430, inkBleed: 0.03 + torchInk * 0.15 },
        textBounds,
      );
      y += 4;

      // Separator
      drawAsciiConsoleRule(
        ctx,
        y,
        frame,
        `rgba(255, 255, 255, ${(0.12 + torchFlicker * 0.04).toFixed(2)})`,
      );
      y += 8;

      // 3. Battle log (scrolls up)
      const maxLogLines = Math.floor((frame.bottomY - y - 8) / LINE_H);
      const visibleLog = log.slice(-maxLogLines);

      for (let entryIndex = 0; entryIndex < visibleLog.length; entryIndex += 1) {
        const entry = visibleLog[entryIndex];
        const recency =
          visibleLog.length <= 1
            ? 1
            : entryIndex / (visibleLog.length - 1);
        ctx.font = CRT_FONT;
        y = renderTextBlockPhysics(
          ctx,
          entry.text,
          classToCanvasColor(entry.color),
          y,
          consoleProjectiles,
          forceFields,
          activeSlashFields,
          {
            fontWeight: 480 + recency * 180,
            inkBleed: 0.03 + recency * 0.12 + torchInk * 0.25,
          },
          textBounds,
        );
      }

      // ── Crescent slash sweep ──
      for (const { slash, visiblePoints, intensity, sweep } of activeSlashRender) {
        ctx.save();
        ctx.font = "bold 18px 'Courier New', monospace";
        ctx.shadowBlur = 18;
        ctx.shadowColor = slash.blocked
          ? "rgba(140, 210, 255, 0.4)"
          : "rgba(255, 240, 240, 0.42)";

        for (let index = 0; index < visiblePoints.length; index += 1) {
          const point = visiblePoints[index];
          const localWidth = (6 + point.t * 26) * intensity;
          const bandCount = Math.max(1, Math.round(localWidth / 6));

          for (let band = -bandCount; band <= bandCount; band += 1) {
            const bandT = bandCount === 0 ? 0 : band / bandCount;
            const edgeWeight = 1 - Math.abs(bandT);
            const ripple = Math.sin(now * 0.014 + index * 0.42 + band * 0.7) * (2.1 + edgeWeight * 1.4);
            const offsetX = point.nx * bandT * localWidth;
            const offsetY = point.ny * bandT * localWidth * 0.94;
            const char =
              Math.abs(band) === bandCount
                ? band < 0
                  ? "/"
                  : "\\"
                : edgeWeight > 0.6
                  ? "#"
                  : edgeWeight > 0.32
                    ? "="
                    : "-";
            const alpha = Math.min(
              0.92,
              (0.12 + intensity * 0.76) * (0.28 + point.t * 0.72) * (0.34 + edgeWeight * 0.66),
            );
            ctx.fillStyle = slash.blocked
              ? `rgba(150, 215, 255, ${alpha.toFixed(2)})`
              : `rgba(255, 238, 238, ${alpha.toFixed(2)})`;
            ctx.fillText(
              char,
              point.x + offsetX + point.nx * ripple,
              point.y + offsetY + point.ny * ripple * 0.85,
            );
          }
        }

        const head = visiblePoints[visiblePoints.length - 1];
        if (head && sweep > 0.3) {
          const label = slash.label.slice(0, 6).split("");
          ctx.font = "bold 14px 'Courier New', monospace";
          for (let index = 0; index < label.length; index += 1) {
            const trail = index / Math.max(1, label.length - 1);
            ctx.fillStyle = slash.blocked
              ? `rgba(170, 220, 255, ${(0.24 + intensity * 0.28).toFixed(2)})`
              : `rgba(255, 255, 255, ${(0.22 + intensity * 0.32).toFixed(2)})`;
            ctx.fillText(
              label[index],
              head.x - index * 12 + head.nx * (12 + trail * 8),
              head.y - index * 6 + head.ny * (10 + trail * 6),
            );
          }
        }

        ctx.restore();
      }

      for (const pulse of consolePulses) {
        renderConsolePulse(ctx, frame, consoleCharWidth, pulse, now);
      }

      // ── Projectiles ──

      for (const { projectile: p, angle, progress, travel } of projectileRenderState) {
        if (!p.alive) continue;

        if (sceneFxCtx) {
          const projectileTone = getProjectileTone(p.element, p.critical);
          const projectileVisual = getProjectileVisual(projectileTone);
          const criticalScaleBoost = p.critical ? 1.34 : 1;
          const projectileScale = lerp(1.06, 0.82, travel) * criticalScaleBoost;
          const trailSpacing = lerp(16, 12.5, travel) * (p.critical ? 1.14 : 1);
          const glowBlur = lerp(22, 15, travel) * (p.critical ? 1.42 : 1);
          sceneFxCtx.save();
          sceneFxCtx.font = `bold ${Math.round(24 * projectileScale)}px 'Courier New', monospace`;
          sceneFxCtx.fillStyle = projectileVisual.fill;
          sceneFxCtx.shadowColor = projectileVisual.shadow;
          sceneFxCtx.shadowBlur = glowBlur;

          for (let index = 0; index < p.chars.length; index += 1) {
            const along = -(p.chars.length - 1 - index) * trailSpacing;
            sceneFxCtx.save();
            sceneFxCtx.translate(
              p.x + Math.cos(angle) * along,
              p.y + Math.sin(angle) * along,
            );
            sceneFxCtx.rotate(angle * 0.12);
            sceneFxCtx.scale(projectileScale, projectileScale);
            sceneFxCtx.fillText(p.chars[index], 0, 0);
            sceneFxCtx.restore();
          }

          const headChar = p.blocked ? "#" : projectileVisual.head;
          sceneFxCtx.globalAlpha = (0.26 + Math.sin(travel * Math.PI) * 0.38) * (p.missed ? 0.86 : 1);
          sceneFxCtx.save();
          sceneFxCtx.translate(p.x + Math.cos(angle) * 8, p.y + Math.sin(angle) * 8);
          sceneFxCtx.scale(projectileScale * (p.critical ? 1.22 : 1.12), projectileScale * (p.critical ? 1.22 : 1.12));
          sceneFxCtx.font = "bold 32px 'Courier New', monospace";
          sceneFxCtx.fillText(headChar, 0, 0);
          sceneFxCtx.restore();
          sceneFxCtx.restore();
        }

        if (!p.impactTriggered && progress >= 1) {
          p.impactTriggered = true;
          p.onImpact?.();
          p.alive = false;
        }
      }

      projectilesRef.current = projectiles.filter((p) => p.alive);

      // ── Scene scatter particles (shield breaks / impact bursts) ──
      const scatter = sceneScatterRef.current;
      for (let si = scatter.length - 1; si >= 0; si--) {
        const sp = scatter[si];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.94;
        sp.vy *= 0.94;
        sp.life += 1;
        if (sp.life > sp.maxLife) {
          scatter.splice(si, 1);
          continue;
        }
        if (!sceneFxCtx) {
          continue;
        }
        const ratio = sp.life / sp.maxLife;
        const fade = ratio > 0.45 ? 1 - (ratio - 0.45) / 0.55 : 1;
        sceneFxCtx.save();
        sceneFxCtx.globalAlpha = fade * sp.alpha;
        sceneFxCtx.font = `bold ${sp.size}px 'Courier New', monospace`;
        sceneFxCtx.fillStyle = sp.color;
        sceneFxCtx.shadowColor = sp.color;
        sceneFxCtx.shadowBlur = 10;
        sceneFxCtx.fillText(sp.char, sp.x, sp.y);
        sceneFxCtx.restore();
      }

      const playerAsciiCanvas = playerAsciiCanvasRef.current;
      if (playerAsciiCanvas) {
        const playerAsciiCtx = playerAsciiCanvas.getContext("2d");
        if (playerAsciiCtx) {
          renderLiveAsciiDisplacementCanvas(
            playerAsciiCtx,
            playerAsciiCanvas,
            playerAsciiMetricsRef.current,
            playerAsciiRenderRef.current.glyphs,
            playerPotionDisplacementRef.current,
            PLAYER_ASCII_CANVAS_TONE,
            playerAsciiRenderRef.current.glyphColors,
            now,
          );
        }
      }

      const monsterAsciiCanvas = monsterAsciiCanvasRef.current;
      if (monsterAsciiCanvas) {
        const monsterAsciiCtx = monsterAsciiCanvas.getContext("2d");
        if (monsterAsciiCtx) {
          renderMonsterAsciiImpactCanvas(
            monsterAsciiCtx,
            monsterAsciiCanvas,
            monsterAsciiMetricsRef.current,
            monsterAsciiRenderRef.current.glyphs,
            monsterImpactRef.current,
            monsterAsciiRenderRef.current.tone,
            now,
          );
        }
      }

      // ── Sprite overlay effects ──
      const effects = effectsRef.current;
      const playerOverlay = playerOverlayRef.current;
      const monsterOverlay = monsterOverlayRef.current;
      const monsterIntentOverlay = monsterIntentOverlayRef.current;

      if (playerOverlay) {
        const pCtx = playerOverlay.getContext("2d");
        if (pCtx) {
          renderOverlayEffects(pCtx, effects, "player", playerOverlay.width, playerOverlay.height);
        }
      }
      if (monsterOverlay) {
        const mCtx = monsterOverlay.getContext("2d");
        if (mCtx) {
          renderOverlayEffects(mCtx, effects, "monster", monsterOverlay.width, monsterOverlay.height);
        }
      }
      if (monsterIntentOverlay) {
        const intentCtx = monsterIntentOverlay.getContext("2d");
        if (intentCtx) {
          intentCtx.clearRect(0, 0, monsterIntentOverlay.width, monsterIntentOverlay.height);
          renderIntentSparks(
            intentCtx,
            intentSparksRef.current,
            now,
            intent,
            currentTurn === "player" && currentMonsterHp > 0,
            advanceIntentSparkFrame,
            monsterIntentOverlay.width,
            monsterIntentOverlay.height,
          );
        }
      }

      // Prune finished effects
      effectsRef.current = effects.filter(
        (e) => now - e.startTime < e.duration,
      );

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // stable — reads from textRef

  useEffect(() => {
    const canvas = promptEffectCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    if (!promptEffect) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let frame = 0;

    const draw = () => {
      const evaluation = promptEffect.evaluation;
      const elapsed = performance.now() - promptEffect.startedAt;
      const explosiveFailure = evaluation.outcome === "failure";
      const deflectBeforeBox = !explosiveFailure && !evaluation.combinationAdequate && evaluation.combinationLoad > 0;
      const arrivalDuration = explosiveFailure ? 1380 : deflectBeforeBox ? 1280 : 1180;
      const holdDuration = explosiveFailure ? 260 : deflectBeforeBox ? 120 : 0;
      const flightProgress = clamp01(elapsed / arrivalDuration);
      const holdProgress = clamp01(Math.max(0, elapsed - arrivalDuration) / Math.max(1, holdDuration));
      const resolveProgress = clamp01(
        Math.max(0, elapsed - arrivalDuration - holdDuration) /
          Math.max(1, promptEffect.duration - arrivalDuration - holdDuration),
      );
      const sourceChars = Array.from(`> ${promptEffect.text}`);
      const flightChars = Array.from(promptEffect.text);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle =
        explosiveFailure
          ? "rgba(18, 5, 5, 0.94)"
          : promptEffect.evaluation.outcome === "risky"
            ? "rgba(18, 22, 10, 0.93)"
            : "rgba(8, 18, 12, 0.94)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.font = CRT_FONT;
      ctx.textBaseline = "top";
      const consoleCharWidth = ctx.measureText("M").width;
      const consoleFrame = drawAsciiConsoleFrame(
        ctx,
        explosiveFailure
          ? "rgba(214, 116, 108, 0.34)"
          : promptEffect.evaluation.outcome === "risky"
            ? "rgba(188, 255, 146, 0.28)"
            : "rgba(132, 255, 168, 0.28)",
      );
      const ruleY = consoleFrame.topY + LINE_H * 2;
      drawAsciiConsoleRule(
        ctx,
        ruleY,
        consoleFrame,
        explosiveFailure
          ? "rgba(255, 132, 120, 0.2)"
          : promptEffect.evaluation.outcome === "risky"
            ? "rgba(182, 255, 136, 0.2)"
            : "rgba(122, 255, 156, 0.2)",
      );

      const sourceWidths = sourceChars.map((char) => ctx.measureText(char).width);
      const textWidths = flightChars.map((char) => ctx.measureText(char).width);
      const textTotalWidth = textWidths.reduce((sum, width) => sum + width, 0);
      const sourceStartX = consoleFrame.startX + consoleCharWidth * 2;
      const sourceY = consoleFrame.bottomY - LINE_H * 2.35;
      const sourceCharX: number[] = [];
      let sourceCursorX = sourceStartX;
      sourceWidths.forEach((width) => {
        sourceCharX.push(sourceCursorX);
        sourceCursorX += width;
      });

      const boxCols = Math.max(24, consoleFrame.cols - 9);
      const boxRows = 7;
      const boxFrame = drawAsciiPanelFrame(
        ctx,
        consoleFrame.startX + consoleCharWidth * 3,
        ruleY + LINE_H + 8,
        boxCols,
        boxRows,
        explosiveFailure
          ? "rgba(255, 118, 108, 0.34)"
          : promptEffect.evaluation.outcome === "risky"
            ? "rgba(182, 255, 136, 0.28)"
            : "rgba(122, 255, 156, 0.3)",
      );
      const boxX = boxFrame.startX;
      const boxY = boxFrame.topY;
      const boxRightX = boxFrame.startX + (boxFrame.cols - 1) * consoleCharWidth;
      const boxInnerStartX = boxFrame.startX + consoleCharWidth * 1.5;
      const boxInnerWidth = Math.max(180, boxRightX - boxInnerStartX - consoleCharWidth * 2);
      const boxHeight = boxFrame.bottomY - boxFrame.topY;
      const targetStartX = Math.max(boxInnerStartX, boxInnerStartX + (boxInnerWidth - textTotalWidth) / 2);
      const targetCharX: number[] = [];
      let targetCursorX = targetStartX;
      textWidths.forEach((width) => {
        targetCharX.push(targetCursorX);
        targetCursorX += width;
      });
      const destinationY = boxY + LINE_H * 2.6;
      const deflectPlaneY = boxFrame.bottomY - LINE_H * 1.35;

      ctx.fillStyle = "rgba(244, 214, 170, 0.18)";
      ctx.fillText(
        explosiveFailure ? "| integrity://fractured" : deflectBeforeBox ? "| integrity://frayed" : "| integrity://stable",
        boxFrame.startX + consoleCharWidth * 2,
        boxFrame.topY + LINE_H * 0.95,
      );

      ctx.fillStyle = "rgba(255, 190, 112, 0.22)";
      ctx.fillText(">", sourceStartX, sourceY);
      ctx.fillStyle = "rgba(244, 214, 170, 0.18)";
      ctx.fillText(
        "_".repeat(Math.max(10, Math.min(boxFrame.cols - 6, Math.ceil((textTotalWidth + consoleCharWidth * 1.5) / consoleCharWidth)))),
        sourceStartX + consoleCharWidth * 1.2,
        sourceY + LINE_H * 0.76,
      );

      if (deflectBeforeBox) {
        const barrierProgress = clamp01((flightProgress - 0.64) / 0.3);
        if (barrierProgress > 0) {
          const glow = 0.2 + Math.sin(elapsed * 0.018) * 0.06 + barrierProgress * 0.16;
          ctx.fillStyle = `rgba(255, 214, 166, ${Math.max(0.12, glow).toFixed(2)})`;
          ctx.fillText(
            "=".repeat(Math.max(10, boxFrame.cols - 6)),
            boxFrame.startX + consoleCharWidth * 2,
            deflectPlaneY,
          );
        }
      }

      flightChars.forEach((char, index) => {
        const kind = promptEffect.charKinds[index] ?? "unknown";
        if (kind === "space") {
          return;
        }

        const seedIndex = index + 1;
        const sourceX = sourceCharX[index + 2] ?? sourceStartX;
        const targetX = targetCharX[index] ?? targetStartX;
        const baseColor =
          kind === "connector"
            ? "rgba(112, 196, 255, 0.95)"
            : kind === "contrast"
              ? "rgba(255, 174, 92, 0.96)"
              : kind === "rune"
                ? "rgba(255, 108, 88, 0.98)"
                : "rgba(238, 214, 172, 0.96)";
        const successColor =
          promptEffect.evaluation.outcome === "risky"
            ? "rgba(176, 255, 146, 0.96)"
            : "rgba(122, 255, 156, 0.98)";
        const swirlRadius = 42 + ((seededWave(seedIndex, 1.8) + 1) / 2) * 22;
        const spiralTurns = 1.6 + ((seededWave(seedIndex, 3.4) + 1) / 2) * 1.8;
        const baseTravel = easeInOutCubic(flightProgress);
        const xTravel = lerp(sourceX, targetX, baseTravel);
        const yTravel = lerp(sourceY, destinationY, baseTravel);
        const spiralAngle = elapsed * 0.01 + seedIndex * 0.7 + (1 - baseTravel) * spiralTurns * Math.PI * 2;
        const spiralStrength = (1 - baseTravel) * swirlRadius;
        let x = xTravel + Math.cos(spiralAngle) * spiralStrength;
        let y = yTravel + Math.sin(spiralAngle) * spiralStrength * 0.65;
        let rotation = (1 - baseTravel) * seededWave(seedIndex, 6.2) * 1.2;
        let alpha = 0.96;
        let drawColor = mixRgbaColors(baseColor, successColor, Math.min(1, baseTravel * 0.82));

        if (deflectBeforeBox) {
          const deflectAt = 0.76;
          if (baseTravel >= deflectAt) {
            const deflectT = clamp01((baseTravel - deflectAt) / (1 - deflectAt));
            const deflectDirection = seededWave(seedIndex, 7.1) >= 0 ? 1 : -1;
            const reboundLift = Math.sin(deflectT * Math.PI) * (10 + ((seededWave(seedIndex, 5.1) + 1) / 2) * 10);
            const reboundSpread = (22 + ((seededWave(seedIndex, 7.4) + 1) / 2) * 36) * easeOutCubic(deflectT);
            x = targetX + deflectDirection * reboundSpread;
            y = deflectPlaneY - reboundLift + 116 * deflectT * deflectT;
            rotation += deflectT * seededWave(seedIndex, 8.9) * 3.4;
            alpha = Math.max(0.08, 1 - deflectT * 0.62);
            drawColor = mixRgbaColors(baseColor, "rgba(255, 230, 204, 0.98)", Math.min(0.76, deflectT * 0.94));
          }
        }

        if (explosiveFailure) {
          if (elapsed <= arrivalDuration + holdDuration) {
            x = lerp(sourceX, targetX, baseTravel) + Math.cos(spiralAngle) * spiralStrength;
            y = lerp(sourceY, destinationY, baseTravel) + Math.sin(spiralAngle) * spiralStrength * 0.65;
            if (flightProgress >= 1) {
              const jitter = (1 - holdProgress) * 2.4;
              x = targetX + seededWave(seedIndex, 10.1) * jitter;
              y = destinationY + seededWave(seedIndex, 11.3) * jitter;
            }
            drawColor = mixRgbaColors(baseColor, "rgba(255, 230, 212, 0.98)", Math.min(0.62, flightProgress * 0.58 + holdProgress * 0.22));
          } else {
            const spreadProgress = clamp01(resolveProgress / 0.42);
            const fallProgress = clamp01((resolveProgress - 0.18) / 0.82);
            const angle = ((seededWave(seedIndex, 2.7) + 1) / 2) * Math.PI * 2;
            const burstDistance =
              (96 + ((seededWave(seedIndex, 4.6) + 1) / 2) * 164) * easeOutCubic(spreadProgress);
            const drop = 14 * spreadProgress + 172 * fallProgress * fallProgress;
            x = targetX + Math.cos(angle) * burstDistance;
            y = destinationY + Math.sin(angle) * burstDistance * 0.86 + drop;
            rotation = (spreadProgress + fallProgress * 0.6) * seededWave(seedIndex, 9.7) * 9.2;
            alpha = Math.max(0, 1 - resolveProgress * 0.72);
            drawColor = mixRgbaColors(baseColor, "rgba(255, 248, 236, 0.98)", 0.56);
          }
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = drawColor;
        ctx.shadowBlur =
          promptEffect.evaluation.outcome === "failure" ? 14 : 18;
        ctx.fillStyle = drawColor;
        ctx.fillText(char, 0, 0);
        if (promptEffect.evaluation.outcome !== "failure") {
          ctx.globalAlpha = alpha * 0.2;
          ctx.fillText(char, 0.9, 0.9);
        }
        ctx.restore();
      });

      if (explosiveFailure) {
        const burstAlpha = Math.max(0.08, 0.4 - resolveProgress * 0.24 + holdProgress * 0.1);
        const burstChars = ["#", "*", "+", "x", "\\", "/"];
        ctx.font = makeFont(680, 13);
        ctx.fillStyle = `rgba(255, 214, 196, ${burstAlpha.toFixed(2)})`;
        for (let ray = 0; ray < 18; ray += 1) {
          const angle = (Math.PI * 2 * ray) / 18 + resolveProgress * 0.24;
          const radius = 18 + easeOutCubic(resolveProgress) * (34 + (ray % 4) * 16);
          const x = canvas.width / 2 + Math.cos(angle) * radius;
          const y = destinationY + 12 + Math.sin(angle) * radius * 0.72;
          ctx.fillText(burstChars[ray % burstChars.length], x, y);
        }
        ctx.font = CRT_FONT;
      }

      if (deflectBeforeBox) {
        const drainAlpha = 0.16 + Math.sin(elapsed * 0.014) * 0.05;
        ctx.fillStyle = `rgba(255, 196, 136, ${Math.max(0.08, drainAlpha).toFixed(2)})`;
        ctx.fillRect(boxX + 16, boxY + boxHeight - 26, Math.max(120, textTotalWidth * 0.72), 1);
      }

      ctx.restore();

      if (elapsed < promptEffect.duration) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [promptEffect]);

  const executeChoice = useCallback(
    (index: number) => {
      if (index === 0) {
        stageAction({ type: "attack" });
      } else if (index === 1) {
        stageAction({ type: "defend" });
      } else {
        setPendingAction(null);
        setPromptEffect(null);
        setPromptInput("");
        setShowPrompt(true);
      }
    },
    [stageAction],
  );

  // ── Keyboard navigation ──
  useEffect(() => {
    if (turn !== "player") return;

    const handler = (e: KeyboardEvent) => {
      if (showPrompt) {
        if (promptEffectActive) {
          e.preventDefault();
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          setPromptEffect(null);
          setShowPrompt(false);
          setPromptInput("");
        }
        return;
      }

      if (pendingAction) {
        if (e.key === "Escape") {
          e.preventDefault();
          setPendingAction(null);
          setSelectedTargetIndex(0);
          return;
        }

        if (e.key === "ArrowUp" || e.key === "w") {
          e.preventDefault();
          setSelectedTargetIndex((value) =>
            value <= 0 ? Math.max(availableTargets.length - 1, 0) : value - 1,
          );
          return;
        }

        if (e.key === "ArrowDown" || e.key === "s") {
          e.preventDefault();
          setSelectedTargetIndex((value) =>
            value >= availableTargets.length - 1 ? 0 : value + 1,
          );
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          confirmTargetAtIndex(selectedTargetIndex);
          return;
        }

        if (/^[1-9]$/.test(e.key)) {
          const index = Number(e.key) - 1;
          if (index < availableTargets.length) {
            e.preventDefault();
            confirmTargetAtIndex(index);
          }
        }
        return;
      }

      if (e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        setSelectedIndex((v) => (v <= 0 ? 2 : v - 1));
      } else if (e.key === "ArrowDown" || e.key === "s") {
        e.preventDefault();
        setSelectedIndex((v) => (v >= 2 ? 0 : v + 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        executeChoice(selectedIndex);
      } else if (e.key === "1") {
        e.preventDefault();
        executeChoice(0);
      } else if (e.key === "2") {
        e.preventDefault();
        executeChoice(1);
      } else if (e.key === "3") {
        e.preventDefault();
        executeChoice(2);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    availableTargets.length,
    confirmTargetAtIndex,
    executeChoice,
    pendingAction,
    selectedIndex,
    selectedTargetIndex,
    showPrompt,
    promptEffectActive,
    turn,
  ]);

  // ── Prompt submit ──
  const handlePromptSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (turn !== "player" || promptEffectActive) return;

      const raw = promptInput.trim();
      if (!raw) return;

      if (isWordPromptCandidate(raw)) {
        const evaluation = evaluatePromptAction(raw, playerStats);
        const effect: PromptEffectState = {
          text: buildPromptEffectText(evaluation),
          charKinds: buildPromptCharKinds(evaluation),
          evaluation,
          judgement: getPromptJudgementCopy(evaluation, playerStats, language),
          startedAt: performance.now(),
          duration:
            evaluation.outcome === "failure"
              ? 3200
              : evaluation.outcome === "risky"
                ? 2500
                : 2200,
        };

        setPromptInput("");
        setPromptEffect(effect);

        if (promptResolveTimeoutRef.current) {
          window.clearTimeout(promptResolveTimeoutRef.current);
        }

        promptResolveTimeoutRef.current = window.setTimeout(() => {
          promptResolveTimeoutRef.current = null;
          setPromptEffect(null);
          setShowPrompt(false);
          onAction({ type: "prompt", evaluation });
        }, effect.duration);
        return;
      }

      const lower = raw.toLowerCase();
      const defendPrefix = ["defend:", "방어:"].find((prefix) => lower.startsWith(prefix));
      const isDefendMode = Boolean(defendPrefix);
      const spellQuery = defendPrefix ? raw.slice(defendPrefix.length).trim() : raw;

      const spell = findSpell(normalizeSpellQuery(spellQuery));
      if (spell) {
        const mode =
          isDefendMode && spell.modes.includes("defend")
            ? ("defend" as const)
            : ("attack" as const);
        stageAction({ type: "spell", spell, mode });
      } else {
        if (
          lower.includes("heal") ||
          lower.includes("breath") ||
          lower.includes("rest") ||
          lower.includes("호흡") ||
          lower.includes("회복")
        ) {
          stageAction({ type: "heal" });
        } else {
          stageAction({ type: "attack" });
        }
      }
    },
    [language, onAction, playerStats, promptEffectActive, promptInput, stageAction, turn],
  );

  const CHOICES = useMemo(
    () => [
      { key: "1", label: combatText.attackLabel, hint: combatText.attackHint },
      { key: "2", label: combatText.defendLabel, hint: combatText.defendHint },
      { key: "3", label: combatText.promptLabel, hint: combatText.promptHint },
    ],
    [combatText],
  );

  const pendingActionLabel = !pendingAction
    ? ""
    : pendingAction.type === "attack"
      ? combatText.attackLabel
      : pendingAction.type === "spell"
        ? getLocalizedSpellName(pendingAction.spell.name, language)
      : pendingAction.type === "heal"
          ? combatText.healLabel
          : combatText.defendLabel;

  const pendingActionHint = !pendingAction
    ? ""
    : pendingTargeting === "all-enemies"
      ? combatText.chooseEnemyHint
      : pendingTargeting === "single"
        ? combatText.chooseSingleHint
        : combatText.chooseSelfHint;
  const activePotionPosition = potionDragging
    ? potionDragPosition ?? potionRestPosition ?? potionHomePosition
    : potionRestPosition ?? potionHomePosition;

  return (
    <div className="flex w-full flex-col items-center gap-4 px-3 pb-8 animate-fade-in-quick sm:px-4">
      <div
        ref={battleFrameRef}
        className="relative w-full max-w-[1140px] overflow-hidden rounded-[24px] border border-white/10 bg-[#060606] shadow-[inset_0_0_60px_rgba(0,0,0,0.62),0_0_42px_rgba(0,0,0,0.78)]"
        style={{
          aspectRatio: "16 / 10",
          boxShadow: "0 32px 90px rgba(0, 0, 0, 0.65), inset 0 0 120px rgba(0, 0, 0, 0.55)",
        }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[#050505]" />
          <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_28%,rgba(244,214,168,0.08)_0%,rgba(0,0,0,0)_34%),linear-gradient(180deg,rgba(255,255,255,0.015)_0%,rgba(0,0,0,0.14)_24%,rgba(0,0,0,0.36)_100%)]" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.012) 0%, rgba(0, 0, 0, 0.08) 28%, rgba(0, 0, 0, 0.28) 100%)",
            }}
          />
        </div>

        <canvas
          ref={sceneFxCanvasRef}
          width={SCENE_W}
          height={SCENE_H}
          className="pointer-events-none absolute inset-0 z-[34] h-full w-full mix-blend-screen opacity-95"
        />

        <div
          className={`absolute bottom-[-11%] left-[-4%] z-40 ${
            shakePlayer ? "animate-sprite-shake" : ""
          } ${lungePlayer ? "animate-player-lunge" : ""}`}
        >
          <div
            className={`relative origin-bottom-left animate-player-breathe ${
              potionHoveringPlayer ? "drop-shadow-[0_0_18px_rgba(255,112,112,0.18)]" : ""
            }`}
          >
            <pre
              ref={playerAsciiPreRef}
              className={playerAsciiClassName}
              style={{
                ...playerAsciiStyle,
                opacity: playerAsciiCanvasActive ? 0 : 1,
              }}
            >
              {playerAsciiMarkup}
            </pre>
            <canvas
              ref={playerAsciiCanvasRef}
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
              style={{ opacity: playerAsciiCanvasActive ? 1 : 0 }}
            />
            <canvas
              ref={playerOverlayRef}
              width={980}
              height={980}
              className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
            />
            {equippedItemList.map((item) => {
              const isHovered = hoveredEquipmentId === item.id;
              const tooltipPositionClassName =
                item.anchor.tooltipSide === "left"
                  ? "right-[calc(100%+0.55rem)] top-1/2 -translate-y-1/2"
                  : item.anchor.tooltipSide === "right"
                    ? "left-[calc(100%+0.55rem)] top-1/2 -translate-y-1/2"
                    : "bottom-[calc(100%+0.55rem)] left-1/2 -translate-x-1/2";
              const slotLabel = getEquipmentSlotLabel(item.slot, language);

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`${slotLabel}: ${item.name[language]}`}
                  className="absolute z-[4] h-[34px] w-[48px] cursor-help border-0 bg-transparent p-0"
                  style={{
                    left: `calc(${item.anchor.leftPercent}% + ${item.anchor.offsetX}px)`,
                    top: `calc(${item.anchor.topPercent}% + ${item.anchor.offsetY}px)`,
                    transform: `translate(-50%, -50%) rotate(${item.anchor.rotationDeg}deg) scale(${item.anchor.scale})`,
                  }}
                  onMouseEnter={() => setHoveredEquipmentId(item.id)}
                  onMouseLeave={() =>
                    setHoveredEquipmentId((current) => (current === item.id ? null : current))
                  }
                  onFocus={() => setHoveredEquipmentId(item.id)}
                  onBlur={() =>
                    setHoveredEquipmentId((current) => (current === item.id ? null : current))
                  }
                >
                  <span className="relative block">
                    <span className="sr-only">{item.fragment}</span>
                    <span
                      className={`pointer-events-none absolute min-w-[180px] max-w-[220px] rounded-[14px] border border-white/12 bg-black/84 px-3 py-2 text-left font-crt transition-opacity duration-150 ${tooltipPositionClassName} ${
                        isHovered ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <span className="block text-[0.62rem] uppercase tracking-[0.18em] text-white/42">
                        {slotLabel}
                      </span>
                      <span className="mt-1 block text-[0.74rem] tracking-[0.08em] text-ember">
                        {item.name[language]}
                      </span>
                      <span className="mt-2 block text-[0.68rem] leading-[1.45] text-white/72">
                        {combatText.equipmentEffectLabel} {item.effectText[language]}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {potionAvailable && activePotionPosition && (
          <button
            type="button"
            aria-label={combatText.potionAriaLabel}
            className="absolute z-[44] border-0 bg-transparent p-0"
            style={{
              left: `${activePotionPosition.x}px`,
              top: `${activePotionPosition.y}px`,
              transform: `translate(-50%, -50%) scale(${potionDragging ? 1.06 : potionHoveringPlayer ? 1.08 : 1})`,
              animation: potionDragging
                ? "none"
                : "potion-orbit 5.2s cubic-bezier(0.37, 0, 0.18, 1) infinite, potion-spin 7.8s linear infinite",
              touchAction: "none",
            }}
            onPointerDown={handlePotionPointerDown}
            onPointerMove={handlePotionPointerMove}
            onPointerUp={handlePotionPointerUp}
            onPointerCancel={handlePotionPointerCancel}
            onMouseEnter={() => setPotionHovered(true)}
            onMouseLeave={() => setPotionHovered(false)}
          >
            <div
              className={`relative flex h-[92px] w-[56px] items-start justify-center transition-[filter,transform] duration-150 ${
                potionDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{
                filter: potionHoveringPlayer
                  ? "drop-shadow(0 0 22px rgba(255, 76, 76, 0.36)) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.36))"
                  : "drop-shadow(0 0 14px rgba(255, 92, 92, 0.22)) drop-shadow(0 10px 18px rgba(0, 0, 0, 0.32))",
              }}
            >
              <span className="pointer-events-none absolute left-1/2 top-[-0.9rem] -translate-x-1/2 whitespace-nowrap font-crt text-[0.52rem] tracking-[0.18em] text-[rgba(255,156,156,0.82)] [text-shadow:0_0_6px_rgba(184,28,44,0.26)]">
                {combatText.potionLabel}
              </span>
              <div className="pointer-events-none absolute left-1/2 top-[66px] h-[15px] w-[34px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,102,102,0.34)_0%,rgba(255,102,102,0.06)_58%,rgba(255,102,102,0)_100%)] blur-[4px]" />
              <div className="pointer-events-none absolute left-1/2 top-[7px] -translate-x-1/2">
                <HealthPotion />
              </div>
              <span
                className={`pointer-events-none absolute left-1/2 top-[calc(100%+0.15rem)] -translate-x-1/2 whitespace-nowrap font-crt text-[0.5rem] tracking-[0.06em] text-[rgba(255,186,186,0.78)] transition-opacity duration-150 ${
                  potionHovered && !potionDragging ? "opacity-100" : "opacity-0"
                }`}
              >
                {combatText.potionTooltip}
              </span>
            </div>
          </button>
        )}

        <div
          className={`absolute right-[12.5%] top-[2.8%] z-20 ${
            shakeMonster ? "animate-sprite-shake" : ""
          } ${monsterDying ? "animate-monster-sink" : ""}`}
        >
          <div className="relative">
            <canvas
              ref={monsterIntentOverlayRef}
              width={440}
              height={540}
              className="pointer-events-none absolute left-[calc(100%+0.45rem)] top-[2%] z-40 h-[92%] w-[150px] mix-blend-screen opacity-95 sm:w-[180px] lg:w-[220px]"
            />
            <div className="relative inline-block origin-bottom align-top animate-enemy-idle">
              <pre
                ref={monsterAsciiPreRef}
                className={monsterAsciiClassName}
                style={{
                  ...monsterAsciiStyle,
                  opacity: monsterImpactCanvasActive ? 0 : 1,
                }}
              >
                {monsterAsciiText}
              </pre>
              <canvas
                ref={monsterAsciiCanvasRef}
                className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
                style={{ opacity: monsterImpactCanvasActive ? 1 : 0 }}
              />
              <canvas
                ref={monsterOverlayRef}
                width={960}
                height={980}
                className="pointer-events-none absolute inset-[-7%] h-[114%] w-[114%] mix-blend-screen opacity-95"
              />
            </div>

            <div className="absolute left-1/2 top-[calc(100%+0.4rem)] z-30 -translate-x-1/2 font-crt text-[0.82rem] leading-[1.1] whitespace-nowrap">
              <span className="relative inline-block align-top">
                <span className="text-white/70">[</span>
                {Array.from({ length: enemyBarWidth }, (_, index) => {
                  const toneClass =
                    index < enemyHealthFill
                      ? "text-[rgba(224,130,118,0.9)]"
                      : index < enemyHealthFill + enemyShieldFill
                        ? "text-[rgba(118,176,255,0.92)]"
                        : "text-white/22";
                  const char = index < enemyHealthFill + enemyShieldFill ? "#" : "-";
                  return (
                    <span key={`enemy-bar-${index}`} className={toneClass}>
                      {char}
                    </span>
                  );
                })}
                <span className="text-white/70">]</span>
              </span>
              <span className="ml-2 text-white/58">
                {monsterHp}/{monsterMaxHp}
              </span>
            </div>
          </div>
        </div>

        <div
          className="absolute left-1/2 top-[48%] z-30 -translate-x-1/2 -translate-y-1/2"
          style={{ width: "min(82vw, 520px)" }}
        >
          <div
            className={`relative rounded-[24px] bg-black/18 ${
              glitchActive ? "animate-crt-glitch" : ""
            }`}
          >
            <canvas ref={canvasRef} className="relative block h-auto w-full" />
            {promptEffectActive && promptEffect && (
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-black/92">
                <canvas
                  ref={promptEffectCanvasRef}
                  width={W}
                  height={H}
                  className="absolute inset-0 h-full w-full"
                />
                <div className="absolute left-[10.2%] right-[10.2%] top-[8.6%] flex items-center justify-between font-crt text-[0.56rem] uppercase tracking-[0.16em] text-white/32">
                  <span>{combatText.judgementLabel}</span>
                  <span>{combatText.promptBusyLabel}</span>
                </div>
                <div className="absolute left-[10.2%] right-[10.2%] bottom-[7.2%] font-crt">
                  <p
                    className={`text-[0.74rem] uppercase tracking-[0.16em] ${
                      promptEffect.evaluation.outcome === "failure"
                        ? "text-[rgba(255,132,122,0.92)]"
                        : promptEffect.evaluation.outcome === "risky"
                          ? "text-[rgba(182,255,136,0.94)]"
                          : "text-[rgba(122,255,156,0.96)]"
                    }`}
                  >
                    {promptEffect.judgement.title}
                  </p>
                  <p className="mt-1 text-[0.66rem] leading-[1.45] text-white/52">
                    {promptEffect.judgement.detail}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-1/2 top-[71%] z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          <div className="flex items-end gap-6">
            <HeartHP
              current={playerHp}
              max={playerMaxHp}
              shield={playerShield}
              label={combatText.hpLabel}
              shieldLabel={combatText.shieldLabel}
            />
            <ManaFlask current={playerMana} max={playerMaxMana} label={combatText.manaLabel} />
          </div>
        </div>

        <div className="group absolute right-[7.2%] top-[71.3%] z-30 flex flex-col items-end font-crt">
          <button
            type="button"
            aria-label={combatText.lexiconLabel}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(148,255,173,0.22)] bg-black/52 text-[0.92rem] text-[rgba(176,255,188,0.86)] shadow-[0_0_18px_rgba(68,255,150,0.08),inset_0_0_12px_rgba(0,0,0,0.42)] transition-[transform,border-color,color,box-shadow] duration-150 hover:scale-[1.04] hover:border-[rgba(148,255,173,0.42)] hover:text-[rgba(210,255,218,0.98)] focus-visible:scale-[1.04] focus-visible:border-[rgba(148,255,173,0.42)] focus-visible:text-[rgba(210,255,218,0.98)] animate-equipment-rune"
          >
            ?
          </button>
          <div className="pointer-events-none absolute right-0 top-[calc(100%+0.7rem)] w-[236px] translate-y-2 rounded-[18px] border border-[rgba(138,255,176,0.16)] bg-black/82 px-4 py-3 opacity-0 shadow-[0_0_28px_rgba(0,0,0,0.38),inset_0_0_22px_rgba(0,0,0,0.46)] transition-[opacity,transform] duration-180 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 backdrop-blur-[4px]">
            <p className="text-[0.62rem] uppercase tracking-[0.2em] text-white/36">
              {combatText.lexiconLabel}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[0.72rem]">
              <div className="rounded-[12px] border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
                <p className="text-white/38">{combatText.decipherLabel}</p>
                <p className="mt-1 text-[0.88rem] text-[rgba(222,222,222,0.92)]">{playerStats.decipher}</p>
              </div>
              <div className="rounded-[12px] border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
                <p className="text-white/38">{combatText.combinationLabel}</p>
                <p className="mt-1 text-[0.88rem] text-[rgba(144,210,255,0.92)]">{playerStats.combination}</p>
              </div>
              <div className="rounded-[12px] border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
                <p className="text-white/38">{combatText.stabilityLabel}</p>
                <p className="mt-1 text-[0.88rem] text-[rgba(255,188,132,0.94)]">{playerStats.stability}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[0.64rem] tracking-[0.08em] text-white/44">
              <span>{combatText.strengthLabel} {playerStats.strength}</span>
              <span>{combatText.agilityLabel} {playerStats.agility}</span>
            </div>
          </div>
        </div>

        <CrtOverlay glitchActive={glitchActive} noiseLevel={crtNoiseLevel} />
      </div>

      {turn === "player" && !showPrompt && !pendingAction && (
        <div className="w-full max-w-[560px] font-crt text-[0.92rem] sm:text-[0.96rem]">
          {CHOICES.map((choice, index) => (
            <button
              key={choice.key}
              type="button"
              className={`block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left tracking-[0.06em] transition-colors duration-100 ${
                selectedIndex === index
                  ? "text-ember [text-shadow:0_0_6px_rgba(255,170,0,0.4)]"
                  : "text-ash/50 hover:text-ash/80"
              }`}
              onClick={() => executeChoice(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {selectedIndex === index ? "> " : "  "}[{choice.key}] {choice.label}
              <span className="ml-3 text-[0.72rem] text-white/28">{choice.hint}</span>
            </button>
          ))}
        </div>
      )}

      {turn === "player" && !showPrompt && pendingAction && (
        <div className="w-full max-w-[560px] font-crt text-[0.92rem] sm:text-[0.96rem]">
          <p className="px-3 pb-1 text-[0.7rem] uppercase tracking-[0.14em] text-white/38">
            {pendingActionLabel} {combatText.targetSuffix}
          </p>
          {availableTargets.map((target, index) => {
            const hitChance = Math.round(
              getActionHitChance(pendingAction, playerStats, target.side as BattleTargetSide) * 100,
            );
            const critChance = Math.round(
              getActionCritChance(pendingAction, playerStats, target.side as BattleTargetSide) * 100,
            );
            return (
              <button
                key={target.id}
                type="button"
                className={`block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left tracking-[0.06em] transition-colors duration-100 ${
                  selectedTargetIndex === index
                    ? "text-ember [text-shadow:0_0_6px_rgba(255,170,0,0.4)]"
                    : "text-ash/50 hover:text-ash/80"
                }`}
                onClick={() => confirmTargetAtIndex(index)}
                onMouseEnter={() => setSelectedTargetIndex(index)}
              >
                {selectedTargetIndex === index ? "> " : "  "}[{index + 1}] {" "}
                <span
                  className={target.side === "enemy"
                    ? selectedTargetIndex === index
                      ? "text-[rgba(255,118,108,0.98)]"
                      : "text-[rgba(214,78,68,0.94)]"
                    : undefined}
                >
                  {target.name}
                </span>
                <span className="ml-3 text-[0.72rem] text-white/28">
                  {combatText.hitLabel} {hitChance}% | {combatText.critLabel} {critChance}%
                </span>
              </button>
            );
          })}
          <p className="px-3 pt-1 text-[0.68rem] text-white/30">
            {pendingActionHint} [ESC] {combatText.cancelLabel}.
          </p>
        </div>
      )}

      {turn === "player" && showPrompt && !promptEffectActive && (
        <div className="w-full max-w-[560px] font-crt">
          <form onSubmit={handlePromptSubmit} className="flex items-center gap-2">
            <span className="font-bold text-ember">{">"}</span>
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={combatText.promptPlaceholder}
              autoFocus
              className="min-w-0 flex-1 border-0 border-b border-ember/30 bg-transparent text-[1rem] text-ember outline-none placeholder:text-white/25 focus:border-ember sm:text-[1.08rem]"
            />
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="cursor-pointer border-0 bg-transparent text-[0.8rem] text-white/40 hover:text-white/70"
            >
              [ESC]
            </button>
          </form>

          <p className="mt-1 text-[0.68rem] text-white/30">
            {combatText.promptHelp} {combatText.manaLabel}: {playerMana}
          </p>
        </div>
      )}

      {turn === "monster" && (
        <p
          className="m-0 animate-wait-blink text-center text-[0.9rem] uppercase tracking-[0.16em]"
          style={{ color: "rgba(255, 100, 80, 0.55)" }}
        >
          {combatText.monsterTurnMessage(monsterName)}
        </p>
      )}
    </div>
  );
}
