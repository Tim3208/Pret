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
  duration: number;
}

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
 * 입력 문자열을 평가하고 전투 화면에서 재생할 prompt 이펙트 모델로 변환한다.
 */
export function buildPromptEffectViewModel(
  raw: string,
  language: Language,
  playerStats: PlayerStats,
): PromptEffectViewModel {
  const evaluation = evaluatePromptAction(raw, playerStats);

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
    duration:
      evaluation.outcome === "failure"
        ? 3200
        : evaluation.outcome === "risky"
          ? 2500
          : 2200,
  };
}
