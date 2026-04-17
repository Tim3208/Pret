// Pure rendering and particle helpers for BattleCombat.
// Timing, refs, and state ownership stay in BattleCombat itself.
import { type CSSProperties } from "react";
import {
  type LayoutLine,
  type PreparedTextWithSegments,
  layoutWithLines,
  prepareWithSegments,
} from "@chenglou/pretext";
import {
  type AsciiConsoleFrame,
  type ConsolePulse,
  type EffectParticle,
  type ForceField,
  type LiveAsciiDisplacementState,
  type MonsterAsciiCanvasMetrics,
  type MonsterAsciiGlyph,
  type MonsterAsciiImpactState,
  type Point,
  type Projectile,
  type ShieldPlane,
  type SlashField,
  type SlashSample,
  type SpriteEffect,
  type TextRenderOptions,
  BASE_FONT_SIZE,
  CRT_FONT_FAMILY,
  DISPLACE_RADIUS,
  DISPLACE_X,
  DISPLACE_Y,
  LINE_H,
  PAD,
  PLAYER_ASCII_CANVAS_TONE,
  TEXT_W,
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  makeShieldPlane,
} from "./core";

export function makeFont(weight: number = 500, size: number = BASE_FONT_SIZE): string {
  return `${weight} ${size}px ${CRT_FONT_FAMILY}`;
}

export const CRT_FONT = makeFont();

// Pretext preparation is reused heavily in the RAF loop, so cache it by font+text.
const preparedCache = new Map<string, PreparedTextWithSegments>();

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}::${text}`;
  const cached = preparedCache.get(key);
  if (cached) {
    return cached;
  }

  const prepared = prepareWithSegments(text, font);
  preparedCache.set(key, prepared);
  if (preparedCache.size > 200) {
    const first = preparedCache.keys().next().value;
    if (first) {
      preparedCache.delete(first);
    }
  }

  return prepared;
}

function getLayoutLines(
  text: string,
  font: string = CRT_FONT,
  maxWidth: number = TEXT_W,
): LayoutLine[] {
  if (!text) {
    return [];
  }

  try {
    const prepared = getPrepared(text, font);
    return layoutWithLines(prepared, maxWidth, LINE_H).lines;
  } catch {
    return [{ text, width: maxWidth, start: { segmentIndex: 0, graphemeIndex: 0 }, end: { segmentIndex: 0, graphemeIndex: 0 } }];
  }
}

function getConsolePerimeterPoint(
  frame: AsciiConsoleFrame,
  charWidth: number,
  slot: number,
): Point {
  // Treat the ASCII frame like a clockwise ring buffer so border pulses can march around it.
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

export function drawAsciiConsoleFrame(
  ctx: CanvasRenderingContext2D,
  color: string,
): AsciiConsoleFrame {
  const charWidth = ctx.measureText("M").width;
  const startX = 20;
  const topY = 18;
  const cols = Math.max(44, Math.floor((480 - startX * 2) / charWidth));
  const rows = Math.max(15, Math.floor((320 - topY * 2) / LINE_H));
  const rightX = startX + (cols - 1) * charWidth;

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

export function drawAsciiConsoleRule(
  ctx: CanvasRenderingContext2D,
  y: number,
  frame: AsciiConsoleFrame,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillText(`├${"─".repeat(frame.cols - 2)}┤`, frame.startX, y);
}

export function renderConsolePulse(
  ctx: CanvasRenderingContext2D,
  frame: AsciiConsoleFrame,
  charWidth: number,
  pulse: ConsolePulse,
  now: number,
): void {
  const progress = clamp01((now - pulse.startTime) / pulse.duration);
  if (progress >= 1) {
    return;
  }

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
    const point = getConsolePerimeterPoint(frame, charWidth, head - index * 2);
    const alpha = Math.max(0.12, 1 - index / markerCount) * (1 - progress * 0.38) * (0.8 + strength * 0.4);
    ctx.fillStyle = pulse.color === "blue"
      ? `rgba(170, 228, 255, ${alpha.toFixed(2)})`
      : `rgba(255, 116, 102, ${alpha.toFixed(2)})`;
    ctx.fillText(index % 3 === 0 ? "#" : index % 2 === 0 ? "*" : "+", point.x, point.y);
  }

  ctx.restore();
}

function parseBaseAlpha(rgba: string): number {
  const match = rgba.match(/,\s*([\d.]+)\s*\)/);
  return match ? Number(match[1]) : 0.75;
}

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

  return `rgba(${Math.round(lerp(fromColor.red, toColor.red, t))}, ${Math.round(lerp(fromColor.green, toColor.green, t))}, ${Math.round(lerp(fromColor.blue, toColor.blue, t))}, ${lerp(fromColor.alpha, toColor.alpha, t).toFixed(2)})`;
}

export function renderTextBlockPhysics(
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
  // Re-render each glyph with local offsets so projectiles, shields, and slash wake can bend text.
  const font = makeFont(options.fontWeight ?? 500, options.fontSize ?? BASE_FONT_SIZE);
  const lineHeight = bounds?.lineHeight ?? LINE_H;
  const startX = bounds?.startX ?? PAD;
  const maxWidth = bounds?.maxWidth ?? TEXT_W;
  const lines = getLayoutLines(text, font, maxWidth);
  if (lines.length === 0) {
    return startY;
  }

  ctx.font = font;
  const now = performance.now();
  const bleed = options.inkBleed ?? 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const baseY = startY + lineIndex * lineHeight;
    let cursorX = startX;

    for (let charIndex = 0; charIndex < line.text.length; charIndex += 1) {
      const glyph = line.text[charIndex];
      const charWidth = ctx.measureText(glyph).width;

      let offsetX = 0;
      let offsetY = 0;
      let alpha = parseBaseAlpha(fillStyle);

      for (const projectile of projectiles) {
        if (!projectile.alive) {
          continue;
        }

        const dx = cursorX - projectile.x;
        const dy = baseY - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < DISPLACE_RADIUS) {
          const force = (DISPLACE_RADIUS - distance) / DISPLACE_RADIUS;
          const forceSquared = force * force;
          offsetY += (dy > 0 ? 1 : -1) * forceSquared * DISPLACE_Y;
          offsetX += (dx > 0 ? 1 : -1) * forceSquared * DISPLACE_X;
          alpha = Math.max(0.08, alpha - force * 0.45);
        }
      }

      if (forceFields) {
        for (const field of forceFields) {
          const elapsed = now - field.startTime;
          if (elapsed < 0 || elapsed > field.duration) {
            continue;
          }

          const progress = elapsed / field.duration;
          const fadeIn = Math.min(progress * 4, 1);
          const fadeOut = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
          const intensity = fadeIn * fadeOut;
          const dx = cursorX - field.x;
          const dy = baseY - field.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < field.radius && distance > 1) {
            const t = (field.radius - distance) / field.radius;
            const pull = t * t * field.strength * intensity;
            offsetX += (dx / distance) * pull * DISPLACE_X * 1.5;
            offsetY += (dy / distance) * pull * DISPLACE_Y * 1.5;
            alpha = Math.max(0.08, alpha - Math.abs(t * intensity) * 0.3);
          }
        }
      }

      if (slashFields) {
        for (const slash of slashFields) {
          let nearestPoint: SlashSample | null = null;
          let nearestDistance = Number.POSITIVE_INFINITY;

          for (const point of slash.points) {
            const dx = cursorX - point.x;
            const dy = baseY - point.y;
            const distance = Math.hypot(dx, dy);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestPoint = point;
            }
          }

          if (!nearestPoint || nearestDistance >= slash.thickness) {
            continue;
          }

          const influence = ((slash.thickness - nearestDistance) / slash.thickness) ** 2;
          const side =
            (cursorX - nearestPoint.x) * nearestPoint.nx +
              (baseY - nearestPoint.y) * nearestPoint.ny >=
            0
              ? 1
              : -1;

          offsetX += nearestPoint.nx * side * influence * slash.strength * slash.intensity;
          offsetY += nearestPoint.ny * side * influence * slash.strength * 1.35 * slash.intensity;
          alpha = Math.max(0.05, alpha - influence * slash.alphaLoss * Math.max(0.4, slash.intensity));
        }
      }

      if (bleed > 0.02) {
        const bleedAlpha = Math.min(alpha, alpha * (0.28 + bleed));
        ctx.fillStyle = replaceAlpha(fillStyle, bleedAlpha);
        ctx.fillText(glyph, cursorX + offsetX + bleed, baseY + offsetY);
        ctx.fillText(glyph, cursorX + offsetX, baseY + offsetY + bleed * 0.55);
      }

      ctx.fillStyle = replaceAlpha(fillStyle, alpha);
      ctx.fillText(glyph, cursorX + offsetX, baseY + offsetY);
      cursorX += charWidth;
    }
  }

  return startY + lines.length * lineHeight;
}

export function buildHitWaveTextStyle(
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
  const ringCenter = 8 + expansion * (84 + waveScale * 11) + tailProgress * (34 + waveScale * 16);
  const ringWidth = 9 + waveScale * 6.4 + pulse * 6;
  const inner = Math.max(0, ringCenter - ringWidth);
  const outer = ringCenter + ringWidth;
  const baseSolid = replaceAlpha(baseColor, Math.min(0.99, parseBaseAlpha(baseColor) + 0.02));
  const hitStrong = replaceAlpha(hitColor, Math.max(0.22, 0.96 - tailProgress * 0.58));
  const hitMid = replaceAlpha(hitColor, Math.max(0.16, 0.66 + pulse * 0.16 - tailProgress * 0.4));
  const hitSoft = replaceAlpha(hitColor, Math.max(0.08, 0.26 + pulse * 0.12 - tailProgress * 0.2));
  const coreGlow = replaceAlpha(hitColor, Math.max(0.02, 0.2 + waveScale * 0.03 - mainProgress * 0.32 - tailProgress * 0.1));
  const earlyCore = 8 + waveScale * 8 + (1 - mainProgress) * 12;
  const outerStop = Math.max(100, outer + 10);
  const weight = Math.round(500 + pulse * 115 + waveScale * 12 - tailProgress * 55);
  const letterSpacing = `${(-0.003 - pulse * 0.004 - waveScale * 0.0012).toFixed(4)}em`;
  const stroke = `${(0.08 + pulse * 0.12 + waveScale * 0.02 - tailProgress * 0.05).toFixed(2)}px ${replaceAlpha(hitColor, Math.max(0.04, 0.08 + pulse * 0.1 - tailProgress * 0.06))}`;
  const returnPhase = tailProgress <= 0.2 ? 0 : easeInOutCubic((tailProgress - 0.2) / 0.8);

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

export function getHitWaveScale(damage: number, maxHp: number): number {
  const normalizedDamage = clamp01(damage / Math.max(1, maxHp));
  return 1.35 + normalizedDamage * 2.8;
}

export function getMonsterImpactBandDuration(critical: boolean): number {
  return critical ? 960 : 780;
}

export function getMonsterImpactSettleDelay(critical: boolean): number {
  return critical ? 860 : 700;
}

function getRadialHoleInfluence(normalizedDistance: number): number {
  const raw = clamp01(1 - normalizedDistance);
  return raw * raw * (3 - 2 * raw);
}

function getMonsterImpactPulse(progress: number): number {
  const clamped = clamp01(progress);
  const swell = Math.sin(Math.PI * clamped);
  const settle = clamped <= 0.42 ? 1 : 1 - easeInOutCubic((clamped - 0.42) / 0.58) * 0.9;
  return swell * settle;
}

// Flatten the sprite once so overlay canvases only need to redraw visible glyphs during impacts.
export function buildMonsterAsciiGlyphs(lines: string[]): MonsterAsciiGlyph[] {
  const rowCount = Math.max(1, lines.length);
  const maxColumns = Math.max(1, ...lines.map((line) => Math.max(1, line.length - 1)));
  const glyphs: MonsterAsciiGlyph[] = [];

  lines.forEach((line, row) => {
    for (let column = 0; column < line.length; column += 1) {
      const char = line[column];
      if (char === " ") {
        continue;
      }

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

export function renderMonsterAsciiImpactCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metrics: MonsterAsciiCanvasMetrics | null,
  glyphs: MonsterAsciiGlyph[],
  impact: MonsterAsciiImpactState | null,
  baseColor: string,
  now: number,
): void {
  // The monster pre stays static; this overlay redraw handles the localized red shockwave only.
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

export function renderLiveAsciiDisplacementCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metrics: MonsterAsciiCanvasMetrics | null,
  glyphs: MonsterAsciiGlyph[],
  field: LiveAsciiDisplacementState | null,
  baseColor: string = PLAYER_ASCII_CANVAS_TONE,
  now: number,
): void {
  // Player potion hover reuses the same glyph-local redraw approach, minus the damage tinting.
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

    ctx.fillText(glyph.char, x, y);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function getProjectileTone(element?: string, critical?: boolean): string {
  if (critical) {
    return "critical";
  }
  return element ?? "strike";
}

export function getProjectileVisual(tone: string): {
  fill: string;
  shadow: string;
  head: string;
} {
  switch (tone) {
    case "critical":
      return {
        fill: "rgba(255, 224, 120, 0.98)",
        shadow: "rgba(255, 206, 72, 0.72)",
        head: "$",
      };
    case "fire":
      return {
        fill: "rgba(255, 150, 64, 0.96)",
        shadow: "rgba(255, 110, 36, 0.62)",
        head: "*",
      };
    case "water":
      return {
        fill: "rgba(108, 214, 255, 0.96)",
        shadow: "rgba(76, 188, 255, 0.58)",
        head: "o",
      };
    case "earth":
      return {
        fill: "rgba(214, 172, 102, 0.96)",
        shadow: "rgba(164, 120, 68, 0.56)",
        head: "#",
      };
    case "nature":
      return {
        fill: "rgba(130, 220, 132, 0.96)",
        shadow: "rgba(70, 176, 92, 0.58)",
        head: "*",
      };
    default:
      return {
        fill: "rgba(106, 230, 255, 0.96)",
        shadow: "rgba(84, 218, 255, 0.52)",
        head: "*",
      };
  }
}

function getProjectileImpactVisual(tone?: string): {
  chars: string[];
  color: () => string;
} {
  switch (tone) {
    case "critical":
      return {
        chars: ["*", "+", "x", "$"],
        color: () => `rgba(${235 + Math.random() * 20}, ${190 + Math.random() * 40}, ${70 + Math.random() * 40}, 1)`,
      };
    case "strike":
      return {
        chars: ["*", "+", "·", "x"],
        color: () => `rgba(${96 + Math.random() * 26}, ${206 + Math.random() * 34}, ${255 - Math.random() * 12}, 1)`,
      };
    case "fire":
      return {
        chars: ["*", "x", "^", "~"],
        color: () => `rgba(${220 + Math.random() * 35}, ${90 + Math.random() * 70}, ${20 + Math.random() * 25}, 1)`,
      };
    case "water":
      return {
        chars: ["*", "~", "o", "≈"],
        color: () => `rgba(${90 + Math.random() * 40}, ${170 + Math.random() * 60}, ${255 - Math.random() * 20}, 1)`,
      };
    case "earth":
      return {
        chars: ["#", "*", "■", "+"],
        color: () => `rgba(${165 + Math.random() * 45}, ${120 + Math.random() * 40}, ${60 + Math.random() * 20}, 1)`,
      };
    case "nature":
      return {
        chars: ["*", "♦", "+", "~"],
        color: () => `rgba(${80 + Math.random() * 40}, ${190 + Math.random() * 45}, ${100 + Math.random() * 35}, 1)`,
      };
    default:
      return {
        chars: ["·", "•", "∘", ".", "×"],
        color: () => `rgba(${200 + Math.random() * 55}, ${30 + Math.random() * 40}, ${20 + Math.random() * 30}, 1)`,
      };
  }
}

export function classToCanvasColor(cls?: string): string {
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

function pointOnPlane(plane: ShieldPlane, u: number, v: number): Point {
  const top = {
    x: lerp(plane.topLeft.x, plane.topRight.x, u),
    y: lerp(plane.topLeft.y, plane.topRight.y, u),
  };
  const bottom = {
    x: lerp(plane.bottomLeft.x, plane.bottomRight.x, u),
    y: lerp(plane.bottomLeft.y, plane.bottomRight.y, u),
  };

  return {
    x: lerp(top.x, bottom.x, v),
    y: lerp(top.y, bottom.y, v),
  };
}

function getOverlayShieldPlane(targetSide: "player" | "monster", w: number, h: number): ShieldPlane {
  return targetSide === "player"
    ? makeShieldPlane(
        { x: w * 0.5, y: h * 0.23 },
        { x: w * 0.72, y: h * 0.17 },
        w * 0.08,
        h * 0.45,
      )
    : makeShieldPlane(
        { x: w * 0.2, y: h * 0.18 },
        { x: w * 0.42, y: h * 0.24 },
        -w * 0.08,
        h * 0.34,
      );
}

function drawShieldPlate(
  ctx: CanvasRenderingContext2D,
  plane: ShieldPlane,
  alpha: number,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  const gradient = ctx.createLinearGradient(
    plane.topLeft.x,
    plane.topLeft.y,
    plane.bottomRight.x,
    plane.bottomRight.y,
  );
  gradient.addColorStop(0, color.replace(", 1)", ", 0.08)"));
  gradient.addColorStop(0.5, color.replace(", 1)", ", 0.28)"));
  gradient.addColorStop(1, color.replace(", 1)", ", 0.12)"));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(plane.topLeft.x, plane.topLeft.y);
  ctx.lineTo(plane.topRight.x, plane.topRight.y);
  ctx.lineTo(plane.bottomRight.x, plane.bottomRight.y);
  ctx.lineTo(plane.bottomLeft.x, plane.bottomLeft.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color.replace(", 1)", ", 0.52)");
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plane.topLeft.x, plane.topLeft.y);
  ctx.lineTo(plane.topRight.x, plane.topRight.y);
  ctx.lineTo(plane.bottomRight.x, plane.bottomRight.y);
  ctx.lineTo(plane.bottomLeft.x, plane.bottomLeft.y);
  ctx.closePath();
  ctx.stroke();

  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.fillStyle = color.replace(", 1)", ", 0.72)");
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  for (let row = 0; row < 4; row += 1) {
    const v = 0.18 + row * 0.2;
    const left = pointOnPlane(plane, 0.06, v);
    const right = pointOnPlane(plane, 0.94, v);
    const segments = Math.max(5, Math.round(Math.hypot(right.x - left.x, right.y - left.y) / 16));

    for (let index = 0; index < segments; index += 1) {
      const t = segments === 1 ? 0 : index / (segments - 1);
      const point = {
        x: lerp(left.x, right.x, t),
        y: lerp(left.y, right.y, t),
      };
      ctx.fillText(index % 2 === 0 ? "#" : "=", point.x, point.y);
    }
  }

  ctx.restore();
}

function spawnShieldPlaneParticles(
  w: number,
  h: number,
  targetSide: "player" | "monster",
): EffectParticle[] {
  const plane = getOverlayShieldPlane(targetSide, w, h);
  const shieldChars = ["#", "=", "[", "]", "/", "\\"];
  return Array.from({ length: 22 }, () => {
    const point = pointOnPlane(plane, Math.random(), Math.random());
    return {
      x: point.x,
      y: point.y,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.24,
      char: shieldChars[Math.floor(Math.random() * shieldChars.length)],
      color: `rgba(${90 + Math.random() * 30}, ${160 + Math.random() * 50}, 255, 1)`,
      alpha: 0,
      life: 0,
      maxLife: 90 + Math.random() * 40,
      size: 9 + Math.random() * 4,
    };
  });
}

export function spawnHealParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  for (let index = 0; index < 10; index += 1) {
    particles.push({
      x: w * 0.2 + Math.random() * w * 0.6,
      y: h * 0.3 + Math.random() * h * 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.4 + Math.random() * 0.6),
      char: "+",
      color: `rgba(${60 + Math.random() * 40}, ${220 + Math.random() * 35}, ${80 + Math.random() * 40}, 1)`,
      alpha: 1,
      life: 0,
      maxLife: 50 + Math.random() * 30,
      size: 8 + Math.random() * 6,
    });
  }
  return particles;
}

export function spawnSlashParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const slashChars = ["/", "\\", "-", "|", "X"];
  const cx = w * 0.5;
  const cy = h * 0.4;
  for (let index = 0; index < 18; index += 1) {
    const angle = Math.PI * 0.8 + Math.random() * Math.PI * 0.4;
    const speed = 1.5 + Math.random() * 2;
    particles.push({
      x: cx + (Math.random() - 0.5) * 30,
      y: cy + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      char: slashChars[Math.floor(Math.random() * slashChars.length)],
      color: "rgba(200, 240, 255, 1)",
      alpha: 1,
      life: 0,
      maxLife: 28 + Math.random() * 14,
      size: 14 + Math.random() * 9,
    });
  }
  return particles;
}

export function spawnDefendParticles(w: number, h: number): EffectParticle[] {
  return spawnShieldPlaneParticles(w, h, "player");
}

export function spawnMonsterDefendParticles(w: number, h: number): EffectParticle[] {
  return spawnShieldPlaneParticles(w, h, "monster");
}

export function spawnSpellParticles(w: number, h: number, element?: string): EffectParticle[] {
  const particles: EffectParticle[] = [];
  let chars: string[];
  let colorFn: () => string;

  switch (element) {
    case "fire":
      chars = ["^", "~", "*", "▲"];
      colorFn = () => `rgba(${220 + Math.random() * 35}, ${80 + Math.random() * 80}, ${10 + Math.random() * 30}, 1)`;
      break;
    case "water":
      chars = ["~", "≈", "○", "."];
      colorFn = () => `rgba(${60 + Math.random() * 40}, ${160 + Math.random() * 60}, ${220 + Math.random() * 35}, 1)`;
      break;
    case "earth":
      chars = ["#", "■", "▓", "."];
      colorFn = () => `rgba(${160 + Math.random() * 60}, ${120 + Math.random() * 40}, ${40 + Math.random() * 30}, 1)`;
      break;
    case "nature":
      chars = ["*", ".", "♦", "~"];
      colorFn = () => `rgba(${40 + Math.random() * 40}, ${180 + Math.random() * 60}, ${60 + Math.random() * 40}, 1)`;
      break;
    default:
      chars = ["*", "◇", "△", "○"];
      colorFn = () => `rgba(${180 + Math.random() * 60}, ${140 + Math.random() * 60}, ${220 + Math.random() * 35}, 1)`;
  }

  const cx = w * 0.5;
  const cy = h * 0.4;
  for (let index = 0; index < 22; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 2;
    particles.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      char: chars[Math.floor(Math.random() * chars.length)],
      color: colorFn(),
      alpha: 1,
      life: 0,
      maxLife: 40 + Math.random() * 24,
      size: 12 + Math.random() * 9,
    });
  }
  return particles;
}

export function spawnChargeParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const chars = ["·", "*", "◦", ".", "°"];
  const cx = w * 0.5;
  const cy = h * 0.45;
  for (let index = 0; index < 20; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    particles.push({
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      char: chars[Math.floor(Math.random() * chars.length)],
      color: `rgba(${200 + Math.random() * 55}, ${40 + Math.random() * 60}, ${40 + Math.random() * 40}, 1)`,
      alpha: 0.8,
      life: 0,
      maxLife: 60 + Math.random() * 30,
      size: 6 + Math.random() * 5,
    });
  }
  return particles;
}

export function spawnShieldChargeParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const chars = ["◆", "◇", "□", "○", "◈"];
  const cx = w * 0.5;
  const cy = h * 0.45;
  for (let index = 0; index < 20; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 5 + Math.random() * 15;
    particles.push({
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
      vx: Math.cos(angle) * (0.8 + Math.random() * 0.5),
      vy: Math.sin(angle) * (0.8 + Math.random() * 0.5),
      char: chars[Math.floor(Math.random() * chars.length)],
      color: `rgba(${60 + Math.random() * 40}, ${120 + Math.random() * 80}, ${220 + Math.random() * 35}, 1)`,
      alpha: 0.85,
      life: 0,
      maxLife: 60 + Math.random() * 30,
      size: 6 + Math.random() * 5,
    });
  }
  return particles;
}

export function spawnHitParticles(w: number, h: number, tone?: string): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const impactVisual = getProjectileImpactVisual(tone);
  const cx = w * 0.4;
  const cy = h * 0.35;
  for (let index = 0; index < 22; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 50;
    particles.push({
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      char: impactVisual.chars[Math.floor(Math.random() * impactVisual.chars.length)],
      color: impactVisual.color(),
      alpha: 0.9,
      life: 0,
      maxLife: 38 + Math.random() * 24,
      size: 9 + Math.random() * 6,
    });
  }
  return particles;
}

export function spawnImpactBurst(
  target: EffectParticle[],
  origin: Point,
  style: "shieldBreak" | "shieldHit" | "monsterHit",
  element?: string,
): void {
  // Burst palettes are chosen by impact type so shield shatters stay visually separate from body hits.
  const impactVisual = getProjectileImpactVisual(element);
  const chars =
    style === "shieldBreak"
      ? ["#", "=", "[", "]", "/", "\\", "◇"]
      : style === "shieldHit"
        ? ["#", "=", "[", "]", "×"]
        : impactVisual.chars;

  const palette = () => {
    if (style === "shieldBreak" || style === "shieldHit") {
      return `rgba(${120 + Math.random() * 60}, ${180 + Math.random() * 45}, 255, 1)`;
    }
    return impactVisual.color();
  };

  const particleCount = style === "monsterHit" ? 24 : 20;
  const minSpeed = style === "monsterHit" ? 1.8 : 1.3;
  const maxSpeed = style === "monsterHit" ? 4.6 : 3.6;

  for (let index = 0; index < particleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / particleCount + (Math.random() - 0.5) * 0.4;
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
    target.push({
      x: origin.x + (Math.random() - 0.5) * 6,
      y: origin.y + (Math.random() - 0.5) * 6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      char: chars[Math.floor(Math.random() * chars.length)],
      color: palette(),
      alpha: 1,
      life: 0,
      maxLife: 20 + Math.random() * 20,
      size: style === "monsterHit" ? 12 + Math.random() * 8 : 10 + Math.random() * 6,
    });
  }
}

export function spawnPotionShatterBurst(target: EffectParticle[], origin: Point): void {
  const glassChars = ["/", "\\", "*", "+", "◇"];
  const liquidChars = ["~", "o", "•", ".", "+"];

  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index) / 18 + (Math.random() - 0.5) * 0.45;
    const speed = 1.8 + Math.random() * 3.8;
    target.push({
      x: origin.x + (Math.random() - 0.5) * 10,
      y: origin.y + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.2,
      char: glassChars[Math.floor(Math.random() * glassChars.length)],
      color: `rgba(${228 + Math.random() * 20}, ${232 + Math.random() * 18}, ${240 + Math.random() * 15}, 1)`,
      alpha: 0.95,
      life: 0,
      maxLife: 22 + Math.random() * 20,
      size: 11 + Math.random() * 8,
    });
  }

  for (let index = 0; index < 20; index += 1) {
    const angle = (Math.PI * 2 * index) / 20 + (Math.random() - 0.5) * 0.7;
    const speed = 1.4 + Math.random() * 3.2;
    target.push({
      x: origin.x + (Math.random() - 0.5) * 12,
      y: origin.y + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.35,
      char: liquidChars[Math.floor(Math.random() * liquidChars.length)],
      color: `rgba(${180 + Math.random() * 50}, ${18 + Math.random() * 32}, ${30 + Math.random() * 36}, 1)`,
      alpha: 1,
      life: 0,
      maxLife: 18 + Math.random() * 16,
      size: 10 + Math.random() * 7,
    });
  }

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8 + (Math.random() - 0.5) * 0.8;
    const speed = 1.2 + Math.random() * 2.3;
    target.push({
      x: origin.x + (Math.random() - 0.5) * 8,
      y: origin.y + (Math.random() - 0.5) * 6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.15,
      char: "=",
      color: `rgba(${118 + Math.random() * 32}, ${68 + Math.random() * 28}, ${28 + Math.random() * 14}, 1)`,
      alpha: 0.96,
      life: 0,
      maxLife: 20 + Math.random() * 18,
      size: 9 + Math.random() * 5,
    });
  }
}

export function renderIntentSparks(
  ctx: CanvasRenderingContext2D,
  sparks: EffectParticle[],
  now: number,
  nextIntent: { kind: string },
  active: boolean,
  advanceFrame: boolean,
  w: number,
  h: number,
): void {
  // Intent sparks are intentionally cheap and self-pruning because they animate every telegraph frame.
  if (!active) {
    sparks.length = 0;
    return;
  }

  const defensive = nextIntent.kind === "defend";
  const spawnLimit = defensive ? 28 : 40;
  const originX = w * 0.14;
  const originY = h * 0.54;
  const chars = defensive ? ["*", "+", "o", "[", "]"] : ["{", "}", "x", "+"];
  const guideColor = defensive ? "rgba(120, 198, 255, 0.96)" : "rgba(255, 102, 72, 0.96)";

  ctx.save();
  ctx.globalAlpha = defensive ? 0.34 : 0.4;
  ctx.font = `bold ${Math.max(30, Math.round(w * 0.15))}px 'Courier New', monospace`;
  ctx.fillStyle = guideColor;
  ctx.shadowColor = guideColor;
  ctx.shadowBlur = 22;
  const guideGlyph = defensive ? "[]" : "{}";
  for (let row = 0; row < 4; row += 1) {
    const drift = Math.sin(now * 0.0045 + row * 0.8) * 4;
    ctx.fillText(guideGlyph, w * 0.02, h * (0.2 + row * 0.16) + drift);
  }
  ctx.restore();

  if (advanceFrame && Math.random() < (defensive ? 0.42 : 0.55) && sparks.length < spawnLimit) {
    sparks.push({
      x: originX + Math.random() * w * 0.24,
      y: originY + (Math.random() - 0.5) * h * 0.28,
      vx: 0.65 + Math.random() * 0.56,
      vy: -(0.2 + Math.random() * 0.26),
      char: chars[Math.floor(Math.random() * chars.length)],
      color: defensive
        ? `rgba(${90 + Math.random() * 40}, ${170 + Math.random() * 50}, 255, 1)`
        : `rgba(255, ${70 + Math.random() * 60}, ${30 + Math.random() * 30}, 1)`,
      alpha: 1,
      life: 0,
      maxLife: 34 + Math.random() * 34,
      size: 20 + Math.random() * 12,
    });
  }

  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    const spark = sparks[index];
    if (advanceFrame) {
      spark.x += spark.vx + Math.sin(now * 0.004 + index) * 0.12;
      spark.y += spark.vy + Math.cos(now * 0.0035 + index * 0.6) * 0.06;
      spark.life += 1;
    }

    if (spark.life > spark.maxLife || spark.x > w + 18 || spark.y < -18) {
      sparks.splice(index, 1);
      continue;
    }

    const fade = 1 - spark.life / spark.maxLife;
    ctx.save();
    ctx.globalAlpha = 0.18 + fade * 0.78;
    ctx.font = `bold ${spark.size}px 'Courier New', monospace`;
    ctx.fillStyle = spark.color;
    ctx.shadowColor = spark.color;
    ctx.shadowBlur = 18;
    ctx.fillText(spark.char, spark.x, spark.y);
    ctx.restore();
  }
}

export function renderOverlayEffects(
  ctx: CanvasRenderingContext2D,
  effects: SpriteEffect[],
  targetSide: "player" | "monster",
  w: number,
  h: number,
): void {
  // Sprite-local overlays own their own particle motion, including persistent shield/charge refresh.
  ctx.clearRect(0, 0, w, h);
  const now = performance.now();

  for (const effect of effects) {
    if (effect.target !== targetSide) {
      continue;
    }

    const elapsed = now - effect.startTime;
    if (elapsed > effect.duration) {
      continue;
    }

    const progress = elapsed / effect.duration;
    const shieldPlane = effect.type === "defend" ? getOverlayShieldPlane(targetSide, w, h) : null;

    if (shieldPlane) {
      const plateAlpha = effect.persistent ? 0.72 : Math.max(0.22, (1 - progress) * 0.9);
      drawShieldPlate(
        ctx,
        shieldPlane,
        plateAlpha,
        targetSide === "player" ? "rgba(110, 180, 255, 1)" : "rgba(90, 170, 255, 1)",
      );
    }

    for (const particle of effect.particles) {
      particle.life += 1;
      if (particle.life > particle.maxLife && effect.type !== "defend") {
        continue;
      }

      const lifeRatio = Math.min(particle.life / particle.maxLife, 1);

      if (effect.type === "charge") {
        const cx = w * 0.5;
        const cy = h * 0.45;
        const dx = cx - particle.x;
        const dy = cy - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 2) {
          const pullStrength = 0.02 + progress * 0.06;
          particle.vx += (dx / distance) * pullStrength;
          particle.vy += (dy / distance) * pullStrength;
          particle.vx += (-dy / distance) * 0.3;
          particle.vy += (dx / distance) * 0.3;
          particle.vx *= 0.96;
          particle.vy *= 0.96;
        }
        if (lifeRatio > 0.95 && effect.persistent) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 40 + Math.random() * 60;
          particle.x = cx + Math.cos(angle) * distance;
          particle.y = cy + Math.sin(angle) * distance;
          particle.vx = 0;
          particle.vy = 0;
          particle.life = 0;
          particle.alpha = 0.8;
        }
      } else if (effect.type === "shieldCharge") {
        const cx = w * 0.5;
        const cy = h * 0.45;
        const dx = particle.x - cx;
        const dy = particle.y - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 1) {
          particle.vx += (dx / distance) * 0.04;
          particle.vy += (dy / distance) * 0.04;
          particle.vx += (-dy / distance) * 0.15;
          particle.vy += (dx / distance) * 0.15;
          particle.vx *= 0.97;
          particle.vy *= 0.97;
        }
        if (lifeRatio > 0.95 && effect.persistent) {
          const angle = Math.random() * Math.PI * 2;
          particle.x = cx + (Math.random() - 0.5) * 10;
          particle.y = cy + (Math.random() - 0.5) * 10;
          particle.vx = Math.cos(angle) * (0.3 + Math.random() * 0.5);
          particle.vy = Math.sin(angle) * (0.3 + Math.random() * 0.5);
          particle.life = 0;
          particle.alpha = 0.9;
        }
      } else if (effect.type === "hit") {
        if (particle.life === 1) {
          const angle = Math.atan2(particle.y - h * 0.35, particle.x - w * 0.4);
          particle.vx = -Math.cos(angle) * 1.2;
          particle.vy = -Math.sin(angle) * 1.2;
        }
        particle.vx *= 0.92;
        particle.vy *= 0.92;
      } else if (effect.type === "defend") {
        const plane = shieldPlane ?? getOverlayShieldPlane(targetSide, w, h);
        if (particle.life > particle.maxLife) {
          const point = pointOnPlane(plane, Math.random(), Math.random());
          const shieldChars = ["#", "=", "[", "]", "/", "\\"];
          particle.x = point.x;
          particle.y = point.y;
          particle.char = shieldChars[Math.floor(Math.random() * shieldChars.length)];
          particle.life = 0;
          particle.alpha = 0;
          particle.vx = (Math.random() - 0.5) * 0.18;
          particle.vy = (Math.random() - 0.5) * 0.14;
        }
        particle.alpha = lifeRatio < 0.15 ? lifeRatio / 0.15 : effect.persistent ? 0.92 : 1 - progress;
        particle.x += Math.sin(particle.life * 0.14 + particle.y * 0.02) * 0.35;
        particle.y += Math.cos(particle.life * 0.12 + particle.x * 0.01) * 0.18;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;

      let fadeAlpha = particle.alpha;
      if (effect.type !== "defend") {
        fadeAlpha = lifeRatio > 0.6 ? particle.alpha * (1 - (lifeRatio - 0.6) / 0.4) : particle.alpha;
      }
      if (effect.type === "heal") {
        particle.x += Math.sin(particle.life * 0.12 + particle.y * 0.05) * 0.6;
        fadeAlpha = lifeRatio < 0.1 ? lifeRatio / 0.1 : fadeAlpha;
      }

      if (fadeAlpha <= 0) {
        continue;
      }

      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.font = `bold ${particle.size}px 'Courier New', monospace`;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 8;
      ctx.fillText(particle.char, particle.x, particle.y);
      ctx.restore();
    }
  }
}
