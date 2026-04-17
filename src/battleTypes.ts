// ── Element system ──────────────────────────────────────────
export type Element = "fire" | "water" | "earth" | "nature";

/**
 * 상성 우위를 갖는 원소를 매핑한 순환 규칙표다.
 *
 * fire → nature → earth → water → fire
 */
const ELEMENT_ADVANTAGE: Record<Element, Element> = {
  fire: "nature",
  nature: "earth",
  earth: "water",
  water: "fire",
};

/**
 * 공격 원소와 방어 원소의 상성을 계산한다.
 *
 * @param attack 공격 원소
 * @param defense 방어 원소
 * @returns 상성 배율
 */
export function getElementMultiplier(
  attack: Element,
  defense: Element,
): number {
  if (ELEMENT_ADVANTAGE[attack] === defense) return 2;
  if (ELEMENT_ADVANTAGE[defense] === attack) return 0.5;
  return 1;
}

// ── Player stats ────────────────────────────────────────────
/**
 * 플레이어 능력치 묶음이다.
 */
export interface PlayerStats {
  strength: number; // → maxHp, base attack dmg
  agility: number; // → base attack bonus, base shield bonus
  decipher: number; // → monster/prompt clarity
  combination: number; // → multi-word efficiency
  stability: number; // → maxMana, spell tier unlock, word stability
}

export type StabilityTier = 1 | 2 | 3;

/**
 * 안정성 수치로 해금된 주문 티어를 계산한다.
 */
export function getStabilityTier(stability: number): StabilityTier {
  if (stability >= 7) return 3;
  if (stability >= 4) return 2;
  return 1;
}

/**
 * 현재 능력치 기준 최대 체력을 계산한다.
 */
export function getMaxHp(stats: PlayerStats): number {
  return 20 + stats.strength * 2;
}

/**
 * 현재 능력치 기준 최대 마나를 계산한다.
 */
export function getMaxMana(stats: PlayerStats): number {
  return 8 + stats.stability * 3;
}

/**
 * 기본 물리 공격 피해량을 계산한다.
 */
export function getBaseAttackDamage(stats: PlayerStats): number {
  return 3 + stats.strength + stats.agility;
}

/**
 * 기본 방어 행동으로 얻는 방어막 수치를 계산한다.
 */
export function getBaseShield(stats: PlayerStats): number {
  return 2 + Math.floor(stats.agility * 1.5);
}

/**
 * 회복 행동의 기본 회복량을 반환한다.
 */
export function getHealAmount(stats?: PlayerStats): number {
  void stats;
  return 5;
}

export type BattleTargetSide = "player" | "enemy";

export interface BattleTargetOption {
  id: string;
  name: string;
  side: BattleTargetSide;
}

export const PLAYER_TARGET_ID = "player";
export const MONSTER_TARGET_ID = "monster";

export type ActionTargeting = "single" | "self" | "all-enemies";

// ── Spells ──────────────────────────────────────────────────
export type SpellMode = "attack" | "defend";

/**
 * 플레이어가 사용할 수 있는 주문 정의다.
 */
export interface Spell {
  name: string;
  element: Element;
  tier: StabilityTier;
  manaCost: number;
  modes: SpellMode[];
  baseDamage: number; // attack mode damage
  baseShield: number; // defend mode shield
  stunChance: number; // 0‑1
  healOnDefend: number; // nature spells heal when used defensively
  attackTargeting: ActionTargeting;
  defendTargeting?: ActionTargeting;
  hint: string; // shown as typing hint
}

export const SPELLS: Spell[] = [
  // ── Fire (attack only) ──
  {
    name: "Flame",
    element: "fire",
    tier: 1,
    manaCost: 3,
    modes: ["attack"],
    baseDamage: 8,
    baseShield: 0,
    stunChance: 0,
    healOnDefend: 0,
    attackTargeting: "single",
    hint: "Fl___e",
  },
  {
    name: "Blaze",
    element: "fire",
    tier: 2,
    manaCost: 6,
    modes: ["attack"],
    baseDamage: 14,
    baseShield: 0,
    stunChance: 0,
    healOnDefend: 0,
    attackTargeting: "single",
    hint: "Bl__e",
  },
  {
    name: "Inferno",
    element: "fire",
    tier: 3,
    manaCost: 10,
    modes: ["attack"],
    baseDamage: 22,
    baseShield: 0,
    stunChance: 0,
    healOnDefend: 0,
    attackTargeting: "all-enemies",
    hint: "Inf___o",
  },

  // ── Water (attack + stun chance) ──
  {
    name: "Ripple",
    element: "water",
    tier: 1,
    manaCost: 3,
    modes: ["attack"],
    baseDamage: 6,
    baseShield: 0,
    stunChance: 0,
    healOnDefend: 0,
    attackTargeting: "single",
    hint: "Ri___e",
  },
  {
    name: "Torrent",
    element: "water",
    tier: 2,
    manaCost: 6,
    modes: ["attack"],
    baseDamage: 11,
    baseShield: 0,
    stunChance: 0.2,
    healOnDefend: 0,
    attackTargeting: "single",
    hint: "Tor___t",
  },
  {
    name: "Deluge",
    element: "water",
    tier: 3,
    manaCost: 10,
    modes: ["attack"],
    baseDamage: 18,
    baseShield: 0,
    stunChance: 0.5,
    healOnDefend: 0,
    attackTargeting: "all-enemies",
    hint: "Del__e",
  },

  // ── Earth (attack + defend) ──
  {
    name: "Stone",
    element: "earth",
    tier: 1,
    manaCost: 3,
    modes: ["attack", "defend"],
    baseDamage: 5,
    baseShield: 6,
    stunChance: 0,
    healOnDefend: 0,
    attackTargeting: "single",
    defendTargeting: "self",
    hint: "St__e",
  },
  {
    name: "Boulder",
    element: "earth",
    tier: 2,
    manaCost: 6,
    modes: ["attack", "defend"],
    baseDamage: 10,
    baseShield: 12,
    stunChance: 0,
    healOnDefend: 0,
    attackTargeting: "single",
    defendTargeting: "self",
    hint: "Bou___r",
  },
  {
    name: "Bastion",
    element: "earth",
    tier: 3,
    manaCost: 10,
    modes: ["attack", "defend"],
    baseDamage: 16,
    baseShield: 20,
    stunChance: 0,
    healOnDefend: 0,
    attackTargeting: "single",
    defendTargeting: "self",
    hint: "Bas___n",
  },

  // ── Nature (attack weak + defend/heal) ──
  {
    name: "Thorn",
    element: "nature",
    tier: 1,
    manaCost: 3,
    modes: ["attack", "defend"],
    baseDamage: 4,
    baseShield: 5,
    stunChance: 0,
    healOnDefend: 3,
    attackTargeting: "single",
    defendTargeting: "self",
    hint: "Th__n",
  },
  {
    name: "Verdure",
    element: "nature",
    tier: 2,
    manaCost: 6,
    modes: ["attack", "defend"],
    baseDamage: 7,
    baseShield: 10,
    stunChance: 0,
    healOnDefend: 6,
    attackTargeting: "single",
    defendTargeting: "self",
    hint: "Ver___e",
  },
  {
    name: "Sylvan",
    element: "nature",
    tier: 3,
    manaCost: 10,
    modes: ["attack", "defend"],
    baseDamage: 12,
    baseShield: 18,
    stunChance: 0,
    healOnDefend: 10,
    attackTargeting: "single",
    defendTargeting: "self",
    hint: "Syl__n",
  },
];

/**
 * 입력 문자열에 가장 가까운 주문을 찾는다.
 *
 * @param input 플레이어 입력값
 * @returns 일치하는 주문, 없으면 `null`
 */
export function findSpell(input: string): Spell | null {
  const normalised = input.trim().toLowerCase();
  if (!normalised) return null;

  // exact match
  for (const spell of SPELLS) {
    if (spell.name.toLowerCase() === normalised) return spell;
  }

  // fuzzy: Levenshtein ≤ 2
  for (const spell of SPELLS) {
    if (levenshtein(spell.name.toLowerCase(), normalised) <= 2) return spell;
  }

  return null;
}

/**
 * 두 문자열의 편집 거리를 계산한다.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Monster ─────────────────────────────────────────────────
export type MonsterIntentKind = "attack" | "defend" | "spell";
type IntentTelegraphStages = Record<"en" | "ko", [string, string, string, string, string]>;

/**
 * 몬스터가 다음 턴에 수행할 의도를 설명한다.
 */
export interface MonsterIntent {
  kind: MonsterIntentKind;
  label: string; // narrative hint for the player
  damage: number; // 0 if defend
  element?: Element;
  telegraphs: IntentTelegraphStages;
}

export interface MonsterDef {
  name: string;
  maxHp: number;
  element?: Element; // innate element (for weakness calculation)
  intents: MonsterIntent[];
  revealTurnsAhead: number; // how many turns ahead to show intent
}

/**
 * 기본 전투에 등장하는 테스트 몬스터 정의다.
 */
export const HOLLOW_WRAITH: MonsterDef = {
  name: "Hollow Wraith",
  maxHp: 60,
  element: undefined, // no innate element
  intents: [
    {
      kind: "attack",
      label: "drawing a sword...",
      damage: 8,
      telegraphs: {
        en: [
          "Something shifts at its side...",
          "A long shape drags through the dark...",
          "The movement feels sharp...",
          "It is drawing a blade...",
          "It is drawing a sword...",
        ],
        ko: [
          "옆구리에서 무언가 꿈틀거린다...",
          "길쭉한 형체를 끌어올리는 듯하다...",
          "날카로운 움직임이 느껴진다...",
          "칼날을 끌어올리고 있다...",
          "검을 끌어올린다...",
        ],
      },
    },
    {
      kind: "attack",
      label: "preparing an attack...",
      damage: 6,
      telegraphs: {
        en: [
          "Its posture tightens...",
          "It gathers itself in a low stance...",
          "A hit feels imminent...",
          "It is readying an attack...",
          "It is preparing an attack...",
        ],
        ko: [
          "자세가 조금 굳어진다...",
          "낮게 몸을 모으는 듯하다...",
          "곧 타격이 올 것 같은 기분이 든다...",
          "공격 태세를 갖추고 있다...",
          "공격 태세를 가다듬는다...",
        ],
      },
    },
    {
      kind: "defend",
      label: "bracing for defense...",
      damage: 0,
      telegraphs: {
        en: [
          "Its outline grows denser...",
          "Something folds inward around its frame...",
          "It feels less exposed than before...",
          "It is settling into a guarded stance...",
          "It is bracing for defense...",
        ],
        ko: [
          "형체가 조금 짙어진다...",
          "몸 둘레로 무언가 접혀드는 듯하다...",
          "방금보다 빈틈이 줄어든 느낌이다...",
          "방어 자세로 몸을 굳히고 있다...",
          "방어 태세를 굳힌다...",
        ],
      },
    },
    {
      kind: "spell",
      label: "gathering the power of fire...",
      damage: 12,
      element: "fire",
      telegraphs: {
        en: [
          "Its fingers twitch in the dark...",
          "It seems to be tracing a circle...",
          "The gesture feels threatening...",
          "It is chanting an attack spell...",
          "It is preparing a fireball...",
        ],
        ko: [
          "손가락을 휘적인다...",
          "원을 그리는 듯 하다...",
          "위협이 느껴진다...",
          "공격 마법 영창을 하고 있다...",
          "화염구를 준비하고 있다...",
        ],
      },
    },
    {
      kind: "attack",
      label: "charging fiercely...",
      damage: 10,
      telegraphs: {
        en: [
          "Its weight tips forward...",
          "The floor protests beneath it...",
          "A rush feels close...",
          "It is coiling for a lunge...",
          "It is charging fiercely...",
        ],
        ko: [
          "무게 중심이 앞으로 쏠린다...",
          "바닥이 먼저 끙끙거린다...",
          "돌진의 기세가 느껴진다...",
          "몸을 웅크려 뛰쳐나올 듯하다...",
          "사납게 돌진할 기세다...",
        ],
      },
    },
    {
      kind: "defend",
      label: "summoning something...",
      damage: 0,
      telegraphs: {
        en: [
          "The air puckers beside it...",
          "Something stirs near its hands...",
          "An omen crawls into the room...",
          "It is calling something to its side...",
          "It is summoning something...",
        ],
        ko: [
          "주변 공기가 움푹 꺼지는 느낌이다...",
          "손끝 부근에서 무언가 꿈틀거린다...",
          "불길한 조짐이 방 안을 기어다닌다...",
          "무언가를 곁으로 불러들이고 있다...",
          "무언가를 불러내려 한다...",
        ],
      },
    },
  ],
  revealTurnsAhead: 1,
};

/**
 * 몬스터 의도 목록에서 다음 행동을 무작위 선택한다.
 */
export function pickMonsterIntent(monster: MonsterDef): MonsterIntent {
  return monster.intents[Math.floor(Math.random() * monster.intents.length)];
}

export function getMonsterIntentTelegraph(
  intent: MonsterIntent,
  decipher: number,
  language: "en" | "ko",
): string {
  const stageIndex = Math.max(0, Math.min(4, decipher - 1));
  return intent.telegraphs[language][stageIndex] ?? intent.label;
}

// ── Combat action types ─────────────────────────────────────
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

export type PlayerAction =
  | { type: "attack"; targetId: string }
  | { type: "defend"; targetId: string }
  | { type: "heal"; targetId: string }
  | { type: "spell"; spell: Spell; mode: SpellMode; targetId: string }
  | { type: "prompt"; evaluation: PromptEvaluation };

const PROMPT_CONNECTOR = "mor";
const PROMPT_CONTRAST = "ubt";
const PROMPT_RUNE = "xlew";
const ATTACK_ALIASES = new Set(["attack", "공격"]);
const DEFEND_ALIASES = new Set(["defense", "defend", "방어"]);

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

function clampChance(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const TEST_NON_SELF_HIT_CHANCE = 0.85;

/**
 * 기본 물리 공격의 명중 확률을 계산한다.
 */
export function getAttackHitChance(
  _stats: PlayerStats,
  targetSide: BattleTargetSide,
): number {
  if (targetSide === "player") return 1;
  return clampChance(TEST_NON_SELF_HIT_CHANCE, 0, 1);
}

/**
 * 주문 공격의 명중 확률을 계산한다.
 */
export function getSpellHitChance(
  _stats: PlayerStats,
  targetSide: BattleTargetSide,
): number {
  if (targetSide === "player") return 1;
  return clampChance(TEST_NON_SELF_HIT_CHANCE, 0, 1);
}

/**
 * 기본 물리 공격의 치명타 확률을 계산한다.
 */
export function getAttackCritChance(stats: PlayerStats): number {
  return clampChance(0.05 + stats.strength * 0.01, 0.05, 0.45);
}

/**
 * 공격형 주문의 치명타 확률을 계산한다.
 */
export function getSpellCritChance(stats: PlayerStats): number {
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

// ── Battle log ──────────────────────────────────────────────
export interface BattleLogEntry {
  text: string;
  color?: string; // tailwind text color class
}

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

// ── Equipment ───────────────────────────────────────────────
export type LocalizedCopy = Record<"en" | "ko", string>;

export type EquipmentSlot =
  | "head"
  | "necklace"
  | "shoulders"
  | "cloak"
  | "bracelet";

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

export interface EquipmentAnchor {
  leftPercent: number;
  topPercent: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  scale: number;
  tooltipSide: "above" | "left" | "right";
}

export interface EquipmentTintRange {
  row: number;
  startColumn: number;
  endColumn: number;
}

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

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, LocalizedCopy> = {
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

export const EQUIPMENT_POOL: EquipmentDefinition[] = [
  {
    id: "cinder-diadem",
    slot: "head",
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
    fragment: "WARD",
    fragmentTone: "rgba(65, 255, 113, 0.92)",
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

export function buildEquippedItems(
  items: EquipmentDefinition[],
): EquippedItems {
  return items.reduce<EquippedItems>((result, item) => {
    result[item.slot] = item;
    return result;
  }, {});
}

export const TEST_START_EQUIPPED_ITEMS: EquippedItems = buildEquippedItems(
  EQUIPMENT_POOL,
);

export function getEquipmentSlotLabel(
  slot: EquipmentSlot,
  language: "en" | "ko",
): string {
  return EQUIPMENT_SLOT_LABELS[slot][language];
}

export function getEquippedItems(equippedItems: EquippedItems): EquipmentDefinition[] {
  return Object.values(equippedItems).filter(
    (item): item is EquipmentDefinition => Boolean(item),
  );
}

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

export function getOfferableEquipmentItems(equippedItems: EquippedItems): EquipmentDefinition[] {
  const equippedIds = new Set(getEquippedItems(equippedItems).map((item) => item.id));
  return EQUIPMENT_POOL.filter((item) => !equippedIds.has(item.id));
}

export function isEquipmentPoolExhausted(equippedItems: EquippedItems): boolean {
  return getOfferableEquipmentItems(equippedItems).length === 0;
}

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

// ── Default starting stats ──────────────────────────────────
/**
 * 새 전투 시작 시 사용하는 기본 플레이어 능력치다.
 */
export const DEFAULT_STATS: PlayerStats = {
  strength: 6,
  agility: 5,
  decipher: 1,
  combination: 2,
  stability: 2,
};
