import { getPromptJudgementCopy, type PromptJudgementCopy } from "@/content/text/battle/prompt";
import {
  evaluatePromptAction,
  type PromptEvaluation,
  type PromptTokenKind,
} from "@/entities/combat";
import type { Language } from "@/entities/locale";
import type { PlayerStats } from "@/entities/player";

export interface PromptEffectViewModel {
  text: string;
  charKinds: Array<PromptTokenKind | "space">;
  evaluation: PromptEvaluation;
  judgement: PromptJudgementCopy;
  startedAt: number;
  wordLiftDuration: number;
  wordStagger: number;
  resultRevealDuration: number;
  postRevealHoldDuration: number;
  duration: number;
}

const PROMPT_WORD_LIFT_DURATION = 800;
const PROMPT_WORD_STAGGER = 520;
const PROMPT_RESULT_REVEAL_DURATION = 1000;
const PROMPT_POST_REVEAL_HOLD_DURATION = 920;

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

/**
 * 자유 입력이 word prompt 문법 후보인지 빠르게 판별한다.
 */
export function isWordPromptCandidate(raw: string): boolean {
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
    for (let charIndex = 0; charIndex < display.length; charIndex += 1) {
      charKinds.push(token.kind);
    }

    if (index < evaluation.tokens.length - 1) {
      charKinds.push("space");
    }
  });

  return charKinds;
}

/**
 * word prompt 연출의 전체 재생 시간을 계산한다.
 */
function getPromptEffectDuration(wordCount: number): number {
  const safeWordCount = Math.max(1, wordCount);
  return (
    PROMPT_WORD_LIFT_DURATION +
    PROMPT_WORD_STAGGER * Math.max(0, safeWordCount - 1) +
    PROMPT_RESULT_REVEAL_DURATION +
    PROMPT_POST_REVEAL_HOLD_DURATION
  );
}

/**
 * 입력 문자열을 평가하고 전투 화면에서 재생할 prompt 이펙트 모델로 변환한다.
 */
export function buildPromptEffectViewModel(
  raw: string,
  language: Language,
  playerStats: PlayerStats,
): PromptEffectViewModel {
  const evaluation = evaluatePromptAction(raw, playerStats);
  const wordCount = Math.max(1, evaluation.tokens.length);

  return {
    text: buildPromptEffectText(evaluation),
    charKinds: buildPromptCharKinds(evaluation),
    evaluation,
    judgement: getPromptJudgementCopy({
      language,
      decipher: playerStats.decipher,
      combination: playerStats.combination,
      stability: playerStats.stability,
      outcome: evaluation.outcome,
      failureReason: evaluation.failureReason,
      combinationLoad: evaluation.combinationLoad,
      stabilityCost: evaluation.stabilityCost,
      combinationAdequate: evaluation.combinationAdequate,
      selfHpCost: evaluation.selfHpCost,
      selfManaCost: evaluation.selfManaCost,
    }),
    startedAt: performance.now(),
    wordLiftDuration: PROMPT_WORD_LIFT_DURATION,
    wordStagger: PROMPT_WORD_STAGGER,
    resultRevealDuration: PROMPT_RESULT_REVEAL_DURATION,
    postRevealHoldDuration: PROMPT_POST_REVEAL_HOLD_DURATION,
    duration: getPromptEffectDuration(wordCount),
  };
}
