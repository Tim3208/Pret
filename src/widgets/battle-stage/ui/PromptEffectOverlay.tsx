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

function seededWave(index: number, salt: number): number {
  return Math.sin(index * 12.9898 + salt * 78.233);
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

    const draw = () => {
      const evaluation = effect.evaluation;
      const elapsed = performance.now() - effect.startedAt;
      const explosiveFailure = evaluation.outcome === "failure";
      const deflectBeforeBox = !explosiveFailure && !evaluation.combinationAdequate && evaluation.combinationLoad > 0;
      const arrivalDuration = explosiveFailure ? 1380 : deflectBeforeBox ? 1280 : 1180;
      const holdDuration = explosiveFailure ? 260 : deflectBeforeBox ? 120 : 0;
      const flightProgress = clamp01(elapsed / arrivalDuration);
      const holdProgress = clamp01(Math.max(0, elapsed - arrivalDuration) / Math.max(1, holdDuration));
      const resolveProgress = clamp01(
        Math.max(0, elapsed - arrivalDuration - holdDuration) /
          Math.max(1, effect.duration - arrivalDuration - holdDuration),
      );
      const sourceChars = Array.from(`> ${effect.text}`);
      const flightChars = Array.from(effect.text);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle =
        explosiveFailure
          ? "rgba(18, 5, 5, 0.94)"
          : effect.evaluation.outcome === "risky"
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
          : effect.evaluation.outcome === "risky"
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
          : effect.evaluation.outcome === "risky"
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
          : effect.evaluation.outcome === "risky"
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
        const kind = effect.charKinds[index] ?? "unknown";
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
          effect.evaluation.outcome === "risky"
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
        ctx.shadowBlur = effect.evaluation.outcome === "failure" ? 14 : 18;
        ctx.fillStyle = drawColor;
        ctx.fillText(char, 0, 0);
        if (effect.evaluation.outcome !== "failure") {
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
      <div className="absolute left-[10.2%] right-[10.2%] bottom-[7.2%] font-crt">
        <p
          className={`text-[0.74rem] uppercase tracking-[0.16em] ${
            effect.evaluation.outcome === "failure"
              ? "text-[rgba(255,132,122,0.92)]"
              : effect.evaluation.outcome === "risky"
                ? "text-[rgba(182,255,136,0.94)]"
                : "text-[rgba(122,255,156,0.96)]"
          }`}
        >
          {effect.judgement.title}
        </p>
        <p className="mt-1 text-[0.66rem] leading-[1.45] text-white/52">
          {effect.judgement.detail}
        </p>
      </div>
    </div>
  );
}
