import { useEffect, useRef } from "react";
import type { PromptEffectViewModel } from "@/features/battle-command-input";
import {
  type AsciiConsoleFrame,
  LINE_H,
  W,
  H,
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  lerp,
} from "../lib/core";
import {
  CRT_FONT,
  drawAsciiConsoleFrame,
  drawAsciiConsoleRule,
  makeFont,
} from "../lib/visuals";

interface PromptEffectOverlayProps {
  busyLabel: string;
  effect: PromptEffectViewModel;
  judgementLabel: string;
}

interface PromptEffectOverlayWord {
  text: string;
  kind: PromptEffectViewModel["evaluation"]["tokens"][number]["kind"];
}

type PromptFailureMode = "combination" | "stability";

function parseRgbaChannels(color: string) {
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

  return `rgba(${Math.round(lerp(fromColor.red, toColor.red, t))}, ${Math.round(lerp(fromColor.green, toColor.green, t))}, ${Math.round(lerp(fromColor.blue, toColor.blue, t))}, ${lerp(fromColor.alpha, toColor.alpha, t).toFixed(2)})`;
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

/**
 * 현재 실패가 조합 계열인지 안정성 계열인지 분류한다.
 */
function getPromptFailureMode(effect: PromptEffectViewModel): PromptFailureMode | null {
  if (effect.evaluation.outcome !== "failure") {
    return null;
  }

  return effect.evaluation.failureReason === "stability-overload"
    ? "stability"
    : "combination";
}

/**
 * 안정성 과부하의 부분 실패 구간인지 판별한다.
 */
function isPromptStabilityPartial(effect: PromptEffectViewModel): boolean {
  return effect.evaluation.outcome === "risky" && effect.evaluation.selfHpCost > 0;
}

/**
 * prompt 토큰을 화면 전용 단어 목록으로 정리한다.
 */
function buildPromptWords(effect: PromptEffectViewModel): PromptEffectOverlayWord[] {
  const words = effect.evaluation.tokens.map((token) => ({
    text: token.specialWord ?? token.raw,
    kind: token.kind,
  }));

  return words.length > 0 ? words : [{ text: effect.text, kind: "unknown" }];
}

/**
 * 판정 전 단어에 쓰는 중립 발광색을 고른다.
 */
function getPromptWordColor(kind: PromptEffectOverlayWord["kind"]): string {
  switch (kind) {
    case "connector":
      return "rgba(176, 208, 236, 0.92)";
    case "contrast":
      return "rgba(236, 198, 150, 0.94)";
    case "rune":
      return "rgba(224, 178, 156, 0.94)";
    case "unknown":
      return "rgba(228, 170, 164, 0.92)";
    default:
      return "rgba(236, 224, 204, 0.96)";
  }
}

/**
 * 최종 판정이 공개될 때 쓸 강조색을 고른다.
 */
function getPromptOutcomeColor(effect: PromptEffectViewModel): string {
  if (effect.evaluation.outcome === "failure") {
    return "rgba(255, 126, 112, 0.96)";
  }

  if (effect.evaluation.outcome === "risky") {
    return "rgba(240, 208, 122, 0.96)";
  }

  return "rgba(138, 255, 182, 0.96)";
}

/**
 * 조합 실패에서 폭발의 핵이 될 단어 인덱스를 고른다.
 */
function getCombinationCulpritIndexes(words: PromptEffectOverlayWord[]): number[] {
  const indexes = words.flatMap((word, index) =>
    word.kind === "connector" || word.kind === "contrast" ? [index] : [],
  );

  if (indexes.length > 0) {
    return indexes;
  }

  const fallbackIndex = words.findIndex((word) => word.kind !== "verb");
  return [fallbackIndex >= 0 ? fallbackIndex : Math.max(0, Math.floor(words.length / 2))];
}

/**
 * 가장 가까운 폭발 핵 단어와의 거리를 계산한다.
 */
function getNearestCulpritDistance(index: number, culpritIndexes: number[]): number {
  return culpritIndexes.reduce((nearest, culpritIndex) => {
    return Math.min(nearest, Math.abs(index - culpritIndex));
  }, Number.POSITIVE_INFINITY);
}

/**
 * 안정성 부분실패에서 끝까지 발사 동작을 유지할 핵심 단어인지 판별한다.
 */
function isStabilityCoreWord(
  word: PromptEffectOverlayWord,
  outerWeight: number,
): boolean {
  return outerWeight <= 0.34 || word.kind === "verb" || word.kind === "rune";
}

/**
 * 조합 실패 시 connector/contrast 단어 주변으로 ASCII 파편을 뿌린다.
 */
function drawCombinationBurst(
  ctx: CanvasRenderingContext2D,
  positions: Array<{ x: number; y: number }>,
  progress: number,
) {
  if (progress <= 0) {
    return;
  }

  const shards = ["#", "*", "+", "x", "\\", "/"];
  ctx.save();
  ctx.font = makeFont(700, 12);
  positions.forEach((position, positionIndex) => {
    for (let ray = 0; ray < 10; ray += 1) {
      const angle = (Math.PI * 2 * ray) / 10 + positionIndex * 0.45 + progress * 0.3;
      const radius = (18 + (ray % 4) * 8) * easeOutCubic(progress);
      const x = position.x + Math.cos(angle) * radius;
      const y = position.y + Math.sin(angle) * radius * 0.72;
      ctx.globalAlpha = Math.max(0, 0.84 - progress * 0.56);
      ctx.fillStyle = ray % 2 === 0 ? "rgba(255, 104, 92, 0.96)" : "rgba(255, 172, 144, 0.92)";
      ctx.fillText(shards[ray % shards.length], x, y);
    }
  });
  ctx.restore();
}

/**
 * 안정성 과부하 동안 문장 전체에 걸리는 진동 오프셋을 계산한다.
 */
function getStabilitySentenceShake(
  elapsed: number,
  index: number,
  intensity: number,
): { x: number; y: number } {
  if (intensity <= 0) {
    return { x: 0, y: 0 };
  }

  const swayX =
    Math.sin(elapsed * 0.062 + index * 0.9) * (0 + intensity * 2.4) +
    Math.cos(elapsed * 0.037 + index * 1.7) * (1.4 + intensity * 2.8);
  const swayY =
    Math.cos(elapsed * 0.054 + index * 1.2) * (0 + intensity * 1.2) +
    Math.sin(elapsed * 0.029 + index * 0.7) * (1 + intensity * 1.8);

  return {
    x: swayX * intensity,
    y: swayY * intensity * 0.9,
  };
}

/**
 * 중앙 판정 패널 외곽을 도는 결과 링을 그린다.
 */
function drawResultRing(
  ctx: CanvasRenderingContext2D,
  frame: AsciiConsoleFrame,
  charWidth: number,
  progress: number,
  color: string,
) {
  if (progress <= 0) {
    return;
  }

  const x = frame.startX + charWidth * 0.9;
  const y = frame.topY + LINE_H * 0.8;
  const width = Math.max(160, (frame.cols - 2.8) * charWidth);
  const height = Math.max(LINE_H * 2.8, (frame.rows - 2.5) * LINE_H);

  ctx.save();
  ctx.strokeStyle = mixRgbaColors("rgba(255, 255, 255, 0)", color, progress);
  ctx.lineWidth = 1.2 + progress * 1.2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 * progress;
  ctx.setLineDash([26, 12]);
  ctx.lineDashOffset = -72 * progress;
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.16 + progress * 0.14;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

export default function PromptEffectOverlay({
  busyLabel,
  effect,
  judgementLabel,
}: PromptEffectOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    let frame = 0;
    const words = buildPromptWords(effect);
    const failureMode = getPromptFailureMode(effect);
    const stabilityPartial = isPromptStabilityPartial(effect);
    const culpritIndexes = failureMode === "combination" ? getCombinationCulpritIndexes(words) : [];
    const wordStageDuration =
      effect.wordLiftDuration + effect.wordStagger * Math.max(0, words.length - 1);

    const draw = () => {
      const evaluation = effect.evaluation;
      const elapsed = performance.now() - effect.startedAt;
      const outcomeColor = getPromptOutcomeColor(effect);
      const resultProgress = clamp01(
        Math.max(0, elapsed - wordStageDuration) / Math.max(1, effect.resultRevealDuration),
      );
      const ringProgress = clamp01((resultProgress - 0.18) / 0.44);
      const tagProgress = clamp01((resultProgress - 0.48) / 0.24);
      const titleProgress = clamp01((resultProgress - 0.66) / 0.34);
      const holdProgress = clamp01(
        Math.max(0, elapsed - wordStageDuration - effect.resultRevealDuration) /
          Math.max(1, effect.postRevealHoldDuration),
      );
      const combinationPulseProgress =
        failureMode === "combination" ? clamp01((resultProgress - 0.12) / 0.28) : 0;
      const combinationBurstProgress =
        failureMode === "combination" ? clamp01((resultProgress - 0.38) / 0.42) : 0;
      const stabilityFailureBurstProgress =
        failureMode === "stability" ? clamp01((resultProgress - 0.18) / 0.68) : 0;
      const stabilityPartialCollapseProgress =
        stabilityPartial ? clamp01((resultProgress - 0.2) / 0.64) : 0;
      const stabilityShakeProgress =
        failureMode === "stability" || stabilityPartial
          ? clamp01(elapsed / Math.max(1, wordStageDuration)) *
            (1 - clamp01(resultProgress / 0.16))
          : 0;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(7, 8, 10, 0.96)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (ringProgress > 0) {
        ctx.fillStyle = mixRgbaColors("rgba(7, 8, 10, 0)", outcomeColor, ringProgress * 0.08);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.save();
      ctx.font = CRT_FONT;
      ctx.textBaseline = "top";
      const consoleCharWidth = ctx.measureText("M").width;
      const consoleFrame = drawAsciiConsoleFrame(
        ctx,
        mixRgbaColors("rgba(214, 204, 188, 0.24)", outcomeColor, ringProgress * 0.24),
      );
      const ruleY = consoleFrame.topY + LINE_H * 2;
      drawAsciiConsoleRule(
        ctx,
        ruleY,
        consoleFrame,
        mixRgbaColors("rgba(214, 204, 188, 0.16)", outcomeColor, ringProgress * 0.18),
      );
      const sourceStartX = consoleFrame.startX + consoleCharWidth * 2;
      const sourceY = consoleFrame.bottomY - LINE_H * 2.35;
      const promptPrefix = "> ";
      const wordWidths = words.map((word) => ctx.measureText(word.text).width);
      const wordGap = consoleCharWidth * 1.7;
      const boxTopOffset = 18;
      const destinationRowOffset = 2.55;
      const failureTagRowOffset = 4.45;
      const failureTitleRowOffset = 3.35;
      const sourceWordX: number[] = [];
      let sourceCursorX = sourceStartX + ctx.measureText(promptPrefix).width;
      wordWidths.forEach((width) => {
        sourceWordX.push(sourceCursorX);
        sourceCursorX += width + wordGap;
      });

      const boxCols = Math.max(24, consoleFrame.cols - 9);
      const boxRows = 6;
      const boxFrame = drawAsciiPanelFrame(
        ctx,
        consoleFrame.startX + consoleCharWidth * 3,
        ruleY + LINE_H + boxTopOffset,
        boxCols,
        boxRows,
        mixRgbaColors("rgba(214, 204, 188, 0.22)", outcomeColor, ringProgress * 0.22),
      );
      const boxRightX = boxFrame.startX + (boxFrame.cols - 1) * consoleCharWidth;
      const boxInnerStartX = boxFrame.startX + consoleCharWidth * 1.5;
      const boxInnerWidth = Math.max(180, boxRightX - boxInnerStartX - consoleCharWidth * 2);
      const boxInnerTopY = boxFrame.topY + LINE_H * 0.88;
      const boxInnerHeight = Math.max(LINE_H * 3.1, boxFrame.bottomY - boxInnerTopY - LINE_H * 0.74);
      const totalTargetWidth =
        wordWidths.reduce((sum, width) => sum + width, 0) + wordGap * Math.max(0, words.length - 1);
      const targetStartX = Math.max(boxInnerStartX, boxInnerStartX + (boxInnerWidth - totalTargetWidth) / 2);
      const targetWordX: number[] = [];
      let targetCursorX = targetStartX;
      wordWidths.forEach((width) => {
        targetWordX.push(targetCursorX);
        targetCursorX += width + wordGap;
      });
      const destinationY = boxFrame.topY + LINE_H * destinationRowOffset;

      if (failureMode || stabilityPartial) {
        const failurePulseProgress =
          failureMode === "combination"
            ? clamp01((resultProgress - 0.14) / 0.42)
            : clamp01((resultProgress - 0.2) / 0.46);

        if (failurePulseProgress > 0) {
          const failurePulse = 0.5 + Math.sin(elapsed * 0.024) * 0.5;
          const baseFill =
            failureMode === "combination"
              ? "rgba(86, 14, 12, 0.12)"
              : stabilityPartial
                ? "rgba(92, 18, 16, 0.09)"
                : "rgba(104, 18, 16, 0.12)";
          const flashFill =
            failureMode === "combination"
              ? "rgba(196, 42, 34, 0.26)"
              : stabilityPartial
                ? "rgba(170, 66, 54, 0.18)"
                : "rgba(224, 62, 50, 0.28)";

          ctx.save();
          ctx.fillStyle = mixRgbaColors(
            baseFill,
            flashFill,
            failurePulseProgress * (0.34 + failurePulse * 0.66),
          );
          ctx.fillRect(
            boxInnerStartX - consoleCharWidth * 0.45,
            boxInnerTopY,
            boxInnerWidth + consoleCharWidth * 0.9,
            boxInnerHeight,
          );
          ctx.restore();
        }
      }

      ctx.fillStyle = "rgba(255, 190, 112, 0.22)";
      ctx.fillText(">", sourceStartX, sourceY);

      const burstCenters: Array<{ x: number; y: number }> = [];
      const centerIndex = (words.length - 1) / 2;
      const maxOuterDistance = Math.max(
        1,
        ...words.map((_, index) => Math.abs(index - centerIndex)),
      );
      words.forEach((word, index) => {
        const startTime = index * effect.wordStagger;
        const wordProgress = clamp01(
          Math.max(0, elapsed - startTime) / Math.max(1, effect.wordLiftDuration),
        );
        const travelProgress = easeInOutCubic(wordProgress);
        const sourceX = sourceWordX[index] ?? sourceStartX;
        const targetX = targetWordX[index] ?? targetStartX;
        let x = lerp(sourceX, targetX, travelProgress);
        let y = lerp(sourceY, destinationY, travelProgress);
        let alpha = elapsed < startTime ? 0.12 : lerp(0.18, 1, travelProgress);
        let drawText = word.text;
        let drawColor = getPromptWordColor(word.kind);
        let scale = 1;
        const radialIndex = index - centerIndex;
        const outerWeight = Math.abs(radialIndex) / maxOuterDistance;
        const stabilityCoreWord = isStabilityCoreWord(word, outerWeight);

        if (elapsed < startTime) {
          x = sourceX;
          y = sourceY;
        }

        if (wordProgress >= 1 && evaluation.outcome !== "failure") {
          drawColor = mixRgbaColors(drawColor, outcomeColor, clamp01((resultProgress - 0.52) / 0.48));
        }

        if (wordProgress >= 1 && (failureMode === "stability" || stabilityPartial)) {
          const shake = getStabilitySentenceShake(elapsed, index, stabilityShakeProgress);
          x += shake.x;
          y += shake.y;
          scale += stabilityShakeProgress * 0.03;
          drawColor = mixRgbaColors(drawColor, "rgba(255, 164, 136, 0.96)", stabilityShakeProgress * 0.34);
        }

        if (wordProgress >= 1 && failureMode === "combination") {
          const isCulprit = culpritIndexes.includes(index);
          if (isCulprit) {
            drawColor = mixRgbaColors(drawColor, "rgba(255, 92, 78, 0.98)", Math.max(0.24, combinationPulseProgress));
            scale = 1 + combinationPulseProgress * 0.24 + Math.sin(elapsed * 0.035 + index) * 0.05 * (1 - combinationBurstProgress);
            alpha *= 1 - combinationBurstProgress * 0.94;
            y -= combinationPulseProgress * 6;
            x += Math.sin(elapsed * 0.02 + index) * 2.6 * (1 - combinationBurstProgress);
            burstCenters.push({
              x: targetX + wordWidths[index] / 2,
              y: destinationY + LINE_H * 0.42,
            });
          } else {
            const distance = getNearestCulpritDistance(index, culpritIndexes);
            const push = Math.max(0, 1 - distance / 2.6) * combinationBurstProgress;
            const direction = culpritIndexes.length > 0 && index < culpritIndexes[0] ? -1 : 1;
            x += direction * easeOutCubic(push) * (22 + distance * 8);
            y += (index % 2 === 0 ? -1 : 1) * 10 * push;
            alpha *= 1 - push * 0.42;

            if (push > 0.18) {
              const visibleCharacters = Math.max(1, Math.ceil(word.text.length * (1 - push * 0.46)));
              drawText = direction < 0 ? word.text.slice(word.text.length - visibleCharacters) : word.text.slice(0, visibleCharacters);
            }
          }
        }

        if (wordProgress >= 1 && failureMode === "stability") {
          const fallDirection = radialIndex === 0 ? (index % 2 === 0 ? -1 : 1) : Math.sign(radialIndex);
          const sideDrift = fallDirection * easeOutCubic(stabilityFailureBurstProgress) * (6 + outerWeight * 18);
          const fallDistance = easeOutCubic(stabilityFailureBurstProgress) * (22 + outerWeight * 30);
          drawColor = mixRgbaColors(
            drawColor,
            "rgba(255, 148, 136, 0.98)",
            Math.min(1, 0.3 + stabilityFailureBurstProgress * 0.7),
          );
          alpha *= 1 - stabilityFailureBurstProgress * 0.92;
          x += sideDrift;
          y += fallDistance;
          scale = 1 - stabilityFailureBurstProgress * 0.05;
        }

        if (wordProgress >= 1 && stabilityPartial) {
          if (!stabilityCoreWord) {
            const collapseDirection = radialIndex === 0 ? (index % 2 === 0 ? -1 : 1) : Math.sign(radialIndex);
            const collapseWindow = clamp01(
              (stabilityPartialCollapseProgress - (1 - outerWeight) * 0.3) / 0.7,
            );
            if (collapseWindow > 0) {
              const outwardShift = easeOutCubic(collapseWindow) * (10 + outerWeight * 30);
              drawColor = mixRgbaColors(drawColor, "rgba(214, 126, 108, 0.94)", collapseWindow * 0.6);
              alpha *= 1 - collapseWindow * (0.24 + outerWeight * 0.56);
              x += collapseDirection * outwardShift;
              y += easeOutCubic(collapseWindow) * (10 + outerWeight * 22);
              scale = 1 - collapseWindow * 0.08;
            }
          } else {
            drawColor = mixRgbaColors(drawColor, "rgba(255, 206, 158, 0.98)", stabilityPartialCollapseProgress * 0.24);
          }
        }

        if (!drawText) {
          return;
        }

        ctx.save();
        ctx.translate(x + wordWidths[index] / 2, y + LINE_H * 0.4);
        ctx.scale(scale, scale);
        ctx.translate(-(wordWidths[index] / 2), -(LINE_H * 0.4));
        ctx.globalAlpha = alpha;
        ctx.shadowColor = drawColor;
        ctx.shadowBlur = failureMode === "combination" && culpritIndexes.includes(index) ? 20 : 12;
        ctx.fillStyle = drawColor;
        ctx.fillText(drawText, 0, 0);
        ctx.restore();
      });

      if (failureMode === "combination" && burstCenters.length > 0) {
        drawCombinationBurst(ctx, burstCenters, combinationBurstProgress);
      }

      drawResultRing(ctx, boxFrame, consoleCharWidth, ringProgress, outcomeColor);

      if (tagProgress > 0 && effect.judgement.failureTag) {
        ctx.font = makeFont(620, 10);
        ctx.globalAlpha = tagProgress;
        ctx.fillStyle = mixRgbaColors("rgba(214, 204, 188, 0.22)", outcomeColor, Math.max(0.42, tagProgress));
        ctx.fillText(
          effect.judgement.failureTag,
          consoleFrame.startX + consoleCharWidth * 2,
          consoleFrame.bottomY - LINE_H * failureTagRowOffset,
        );
        ctx.globalAlpha = 1;
        ctx.font = CRT_FONT;
      }

      if (titleProgress > 0) {
        ctx.font = makeFont(700, 15);
        ctx.globalAlpha = titleProgress;
        ctx.fillStyle = mixRgbaColors("rgba(214, 204, 188, 0.2)", outcomeColor, titleProgress);
        ctx.fillText(
          effect.judgement.title,
          consoleFrame.startX + consoleCharWidth * 2,
          consoleFrame.bottomY - LINE_H * failureTitleRowOffset,
        );
        ctx.globalAlpha = 1;
        ctx.font = CRT_FONT;
      }

      if (holdProgress > 0 && holdProgress < 1) {
        ctx.save();
        ctx.globalAlpha = holdProgress * 0.06;
        ctx.fillStyle = outcomeColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      ctx.restore();

      if (elapsed < effect.duration) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [effect]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-black/92">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="absolute inset-0 h-full w-full"
      />
      <div className="absolute left-[10.2%] right-[10.2%] top-[8.6%] flex items-center justify-between font-crt text-[0.56rem] uppercase tracking-[0.16em] text-white/32">
        <span>{judgementLabel}</span>
        <span>{busyLabel}</span>
      </div>
    </div>
  );
}
