import {
  type CSSProperties,
  type FormEvent,
  type MutableRefObject,
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
import HeartHP from "./HeartHP";
import ManaFlask from "./ManaFlask";
import {
  type BattleTargetOption,
  type BattleTargetSide,
  type BattleLogEntry,
  type CombatAnimationRequest,
  type MonsterIntent,
  type PlayerAction,
  type PlayerActionDraft,
  type PlayerStats,
  PLAYER_TARGET_ID,
  findSpell,
  getActionCritChance,
  getActionHitChance,
  getActionTargeting,
} from "./battleTypes";

interface Projectile {
  chars: string[];
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startTime: number;
  duration: number;
  arcHeight: number;
  sway: number;
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

interface SlashSample extends Point {
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
  monsterHp: number;
  monsterMaxHp: number;
  monsterShield: number;
  nextIntent: MonsterIntent;
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

type CrtNoiseLevel = "off" | "soft" | "strong";

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
/** Radius within which a projectile displaces characters */
const DISPLACE_RADIUS = 90;
/** Maximum pixel push in Y */
const DISPLACE_Y = 28;
/** Maximum pixel push in X */
const DISPLACE_X = 16;
const SLASH_THICKNESS = 34;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
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
    monsterCore: { x: width * 0.94, y: height * 0.15 },
    playerShield: makeShieldPlane(
      { x: width * 0.24, y: height * 0.28 },
      { x: width * 0.36, y: height * 0.23 },
      width * 0.06,
      height * 0.34,
    ),
    monsterShield: makeShieldPlane(
      { x: width * 0.69, y: height * 0.17 },
      { x: width * 0.82, y: height * 0.21 },
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
    playerCore: { x: width * 0.345, y: height * 0.57 },
    playerShield: { x: width * 0.37, y: height * 0.48 },
    monsterCore: { x: width * 0.742, y: height * 0.23 },
    monsterShield: { x: width * 0.712, y: height * 0.18 },
  };
}

function sampleRandomOffscreenPoint(origin: Point): Point {
  const padding = 150;
  const candidates = [
    { x: -padding, y: Math.random() * SCENE_H },
    { x: SCENE_W + padding, y: Math.random() * SCENE_H },
    { x: Math.random() * SCENE_W, y: -padding },
    { x: Math.random() * SCENE_W, y: SCENE_H + padding },
  ].filter((point) => Math.hypot(point.x - origin.x, point.y - origin.y) > 260);

  return candidates[Math.floor(Math.random() * candidates.length)] ?? {
    x: SCENE_W + padding,
    y: origin.y - padding,
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

function getProjectileTone(element?: string, critical?: boolean): string {
  if (critical) return "critical";
  return element ?? "strike";
}

function getProjectileVisual(tone: string): {
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
        color: () =>
          `rgba(${235 + Math.random() * 20}, ${190 + Math.random() * 40}, ${70 + Math.random() * 40}, 1)`,
      };
    case "strike":
      return {
        chars: ["*", "+", "·", "x"],
        color: () =>
          `rgba(${96 + Math.random() * 26}, ${206 + Math.random() * 34}, ${255 - Math.random() * 12}, 1)`,
      };
    case "fire":
      return {
        chars: ["*", "x", "^", "~"],
        color: () =>
          `rgba(${220 + Math.random() * 35}, ${90 + Math.random() * 70}, ${20 + Math.random() * 25}, 1)`,
      };
    case "water":
      return {
        chars: ["*", "~", "o", "≈"],
        color: () =>
          `rgba(${90 + Math.random() * 40}, ${170 + Math.random() * 60}, ${255 - Math.random() * 20}, 1)`,
      };
    case "earth":
      return {
        chars: ["#", "*", "■", "+"],
        color: () =>
          `rgba(${165 + Math.random() * 45}, ${120 + Math.random() * 40}, ${60 + Math.random() * 20}, 1)`,
      };
    case "nature":
      return {
        chars: ["*", "♦", "+", "~"],
        color: () =>
          `rgba(${80 + Math.random() * 40}, ${190 + Math.random() * 45}, ${100 + Math.random() * 35}, 1)`,
      };
    default:
      return {
        chars: ["·", "•", "∘", ".", "×"],
        color: () =>
          `rgba(${200 + Math.random() * 55}, ${30 + Math.random() * 40}, ${20 + Math.random() * 30}, 1)`,
      };
  }
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

function spawnHealParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  for (let i = 0; i < 10; i++) {
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

function spawnSlashParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const slashChars = ["/", "\\", "-", "|", "X"];
  const cx = w * 0.5;
  const cy = h * 0.4;
  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 0.8) + Math.random() * Math.PI * 0.4; // roughly right-to-left slash
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

function spawnDefendParticles(w: number, h: number): EffectParticle[] {
  return spawnShieldPlaneParticles(w, h, "player");
}

function spawnMonsterDefendParticles(w: number, h: number): EffectParticle[] {
  return spawnShieldPlaneParticles(w, h, "monster");
}

function spawnSpellParticles(w: number, h: number, element?: string): EffectParticle[] {
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
  for (let i = 0; i < 22; i++) {
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

function spawnChargeParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const chars = ["·", "*", "◦", ".", "°"];
  const cx = w * 0.5;
  const cy = h * 0.45;
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 60;
    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
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

function spawnShieldChargeParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const chars = ["◆", "◇", "□", "○", "◈"];
  const cx = w * 0.5;
  const cy = h * 0.45;
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 15;
    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
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

function spawnHitParticles(w: number, h: number, tone?: string): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const impactVisual = getProjectileImpactVisual(tone);
  const cx = w * 0.4;
  const cy = h * 0.35;
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 50;
    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
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

function spawnImpactBurst(
  target: EffectParticle[],
  origin: Point,
  style: "shieldBreak" | "shieldHit" | "monsterHit",
  element?: string,
): void {
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

function renderIntentSparks(
  ctx: CanvasRenderingContext2D,
  sparks: EffectParticle[],
  now: number,
  nextIntent: MonsterIntent,
  active: boolean,
  advanceFrame: boolean,
  w: number,
  h: number,
): void {
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

function renderOverlayEffects(
  ctx: CanvasRenderingContext2D,
  effects: SpriteEffect[],
  targetSide: "player" | "monster",
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);
  const now = performance.now();

  for (const effect of effects) {
    if (effect.target !== targetSide) continue;
    const elapsed = now - effect.startTime;
    if (elapsed > effect.duration) continue;
    const progress = elapsed / effect.duration;
    const shieldPlane =
      effect.type === "defend" ? getOverlayShieldPlane(targetSide, w, h) : null;

    if (shieldPlane) {
      const plateAlpha = effect.persistent
        ? 0.72
        : Math.max(0.22, (1 - progress) * 0.9);
      drawShieldPlate(
        ctx,
        shieldPlane,
        plateAlpha,
        targetSide === "player"
          ? "rgba(110, 180, 255, 1)"
          : "rgba(90, 170, 255, 1)",
      );
    }

    for (const p of effect.particles) {
      p.life += 1;
      if (p.life > p.maxLife && effect.type !== "defend") continue;
      const lifeRatio = Math.min(p.life / p.maxLife, 1);

      if (effect.type === "charge") {
        // Spiral inward toward center
        const cx = w * 0.5;
        const cy = h * 0.45;
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
          const pullStrength = 0.02 + progress * 0.06;
          p.vx += (dx / dist) * pullStrength;
          p.vy += (dy / dist) * pullStrength;
          p.vx += (-dy / dist) * 0.3;
          p.vy += (dx / dist) * 0.3;
          p.vx *= 0.96;
          p.vy *= 0.96;
        }
        // Respawn particles that die (persistent loop)
        if (lifeRatio > 0.95 && effect.persistent) {
          const angle = Math.random() * Math.PI * 2;
          const sDist = 40 + Math.random() * 60;
          p.x = cx + Math.cos(angle) * sDist;
          p.y = cy + Math.sin(angle) * sDist;
          p.vx = 0;
          p.vy = 0;
          p.life = 0;
          p.alpha = 0.8;
        }
      } else if (effect.type === "shieldCharge") {
        // Expand outward from center
        const cx = w * 0.5;
        const cy = h * 0.45;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          p.vx += (dx / dist) * 0.04;
          p.vy += (dy / dist) * 0.04;
          // Slight orbit
          p.vx += (-dy / dist) * 0.15;
          p.vy += (dx / dist) * 0.15;
          p.vx *= 0.97;
          p.vy *= 0.97;
        }
        if (lifeRatio > 0.95 && effect.persistent) {
          const angle = Math.random() * Math.PI * 2;
          p.x = cx + (Math.random() - 0.5) * 10;
          p.y = cy + (Math.random() - 0.5) * 10;
          p.vx = Math.cos(angle) * (0.3 + Math.random() * 0.5);
          p.vy = Math.sin(angle) * (0.3 + Math.random() * 0.5);
          p.life = 0;
          p.alpha = 0.9;
        }
      } else if (effect.type === "hit") {
        // Pull toward hit center (first particle's original position approximated by center)
        if (p.life === 1) {
          // Store original position as target
          const angle = Math.atan2(p.y - h * 0.35, p.x - w * 0.4);
          p.vx = -Math.cos(angle) * 1.2;
          p.vy = -Math.sin(angle) * 1.2;
        }
        p.vx *= 0.92;
        p.vy *= 0.92;
      } else if (effect.type === "defend") {
        const plane = shieldPlane ?? getOverlayShieldPlane(targetSide, w, h);
        if (p.life > p.maxLife) {
          const point = pointOnPlane(plane, Math.random(), Math.random());
          const shieldChars = ["#", "=", "[", "]", "/", "\\"];
          p.x = point.x;
          p.y = point.y;
          p.char = shieldChars[Math.floor(Math.random() * shieldChars.length)];
          p.life = 0;
          p.alpha = 0;
          p.vx = (Math.random() - 0.5) * 0.18;
          p.vy = (Math.random() - 0.5) * 0.14;
        }
        p.alpha = lifeRatio < 0.15 ? lifeRatio / 0.15 : effect.persistent ? 0.92 : 1 - progress;
        p.x += Math.sin(p.life * 0.14 + p.y * 0.02) * 0.35;
        p.y += Math.cos(p.life * 0.12 + p.x * 0.01) * 0.18;
      }

      p.x += p.vx;
      p.y += p.vy;

      // Fade based on life
      let fadeAlpha = p.alpha;
      if (effect.type !== "defend") {
        fadeAlpha = lifeRatio > 0.6 ? p.alpha * (1 - (lifeRatio - 0.6) / 0.4) : p.alpha;
      }
      if (effect.type === "heal") {
        // Wave motion
        p.x += Math.sin(p.life * 0.12 + p.y * 0.05) * 0.6;
        fadeAlpha = lifeRatio < 0.1 ? lifeRatio / 0.1 : fadeAlpha;
      }

      if (fadeAlpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.font = `bold ${p.size}px 'Courier New', monospace`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillText(p.char, p.x, p.y);
      ctx.restore();
    }
  }
}

/* ================================================================
   Component
   ================================================================ */

export default function BattleCombat({
  monsterName,
  monsterAscii,
  playerAscii,
  monsterHp,
  monsterMaxHp,
  monsterShield,
  nextIntent,
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
  projectileCallbackRef,
}: BattleCombatProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptInput, setPromptInput] = useState("");
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneFxCanvasRef = useRef<HTMLCanvasElement>(null);
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
  const prevPlayerHpRef = useRef(playerHp);
  const prevPlayerShieldRef = useRef(playerShield);
  const prevMonsterHpRef = useRef(monsterHp);
  const prevMonsterShieldRef = useRef(monsterShield);

  /* Keep text data in a ref so the RAF loop never needs to restart */
  const textRef = useRef({ nextIntent, monsterShield, ambientText, battleLog });
  textRef.current = { nextIntent, monsterShield, ambientText, battleLog };
  const sceneAnchors = useRef(getSceneAnchors(W, H)).current;
  const projectileSceneAnchors = useRef(getProjectileSceneAnchors(SCENE_W, SCENE_H)).current;

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

  useEffect(() => {
    setSelectedTargetIndex(0);
  }, [pendingAction, availableTargets.length]);

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

  useEffect(() => {
    return () => {
      if (noiseResetRef.current) {
        window.clearTimeout(noiseResetRef.current);
      }
      if (playerHitWaveFrameRef.current) {
        window.cancelAnimationFrame(playerHitWaveFrameRef.current);
      }
      if (monsterHitWaveFrameRef.current) {
        window.cancelAnimationFrame(monsterHitWaveFrameRef.current);
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
  }, [monsterShield, projectileSceneAnchors.monsterShield]);

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
      setShakeMonster(true);
      window.setTimeout(() => setShakeMonster(false), 600);
      startHitWave("monster", 620, damage, monsterMaxHp);
      if (word === "STRIKE") {
        triggerEffect("slash", "monster", 1320);
      } else {
        triggerEffect("spell", "monster", 1640, element);
      }
      triggerEffect("hit", "monster", 920, impactTone);
      spawnImpactBurst(sceneScatterRef.current, impactPoint, "monsterHit", impactTone);
      setHitAbsorbMonster(true);
      window.setTimeout(() => setHitAbsorbMonster(false), 620);
    },
    [monsterMaxHp, startHitWave, triggerEffect],
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

        const target = request.missed
          ? sampleRandomOffscreenPoint(projectileSceneAnchors.playerMuzzle)
          : request.targetSide === "player"
            ? request.blocked
              ? projectileSceneAnchors.playerShield
              : projectileSceneAnchors.playerCore
            : request.blocked
              ? projectileSceneAnchors.monsterShield
              : projectileSceneAnchors.monsterCore;
        const directionX = target.x - projectileSceneAnchors.playerMuzzle.x;
        const directionY = target.y - projectileSceneAnchors.playerMuzzle.y;
        const directionLength = Math.max(1, Math.hypot(directionX, directionY));
        const impactInset = request.missed
          ? 0
          : request.targetSide === "player"
            ? 8 + request.word.length * 5
            : 16 + request.word.length * 11;
        const impactX = target.x + (directionX / directionLength) * impactInset;
        const impactY = target.y + (directionY / directionLength) * impactInset;

        projectilesRef.current.push({
          chars: request.word.split(""),
          x: projectileSceneAnchors.playerMuzzle.x,
          y: projectileSceneAnchors.playerMuzzle.y,
          startX: projectileSceneAnchors.playerMuzzle.x,
          startY: projectileSceneAnchors.playerMuzzle.y,
          targetX: impactX,
          targetY: impactY,
          startTime: performance.now(),
          duration: 920,
          arcHeight: 0,
          sway: 0,
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
                flashPlayerImpact(
                  request.shielded ? "partial" : "full",
                  request.impactDamage ?? 0,
                );
              } else {
                flashMonsterImpact(
                  request.word,
                  { x: impactX, y: impactY },
                  request.element,
                  request.impactDamage ?? 0,
                  request.critical,
                );
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
    projectileSceneAnchors.monsterCore,
    projectileSceneAnchors.monsterShield,
    projectileSceneAnchors.playerCore,
    projectileSceneAnchors.playerMuzzle,
    projectileSceneAnchors.playerShield,
    sceneAnchors.slashControl,
    sceneAnchors.slashEnd,
    sceneAnchors.slashStart,
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
        monsterShield: mShield,
        ambientText: ambient,
        battleLog: log,
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
        const travel = easeInCubic(progress);
        const baseX = lerp(p.startX, p.targetX, travel);
        const baseY = lerp(p.startY, p.targetY, travel);
        const angle = Math.atan2(p.targetY - p.startY, p.targetX - p.startX);

        p.x = baseX;
        p.y = baseY;

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
        `> ${intent.label}`,
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
          `  [Shield: ${mShield}]`,
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
            turn === "player" && monsterHp > 0,
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

  const executeChoice = useCallback(
    (index: number) => {
      if (index === 0) {
        stageAction({ type: "attack" });
      } else if (index === 1) {
        stageAction({ type: "defend" });
      } else {
        setPendingAction(null);
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
        if (e.key === "Escape") {
          e.preventDefault();
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
    turn,
  ]);

  // ── Prompt submit ──
  const handlePromptSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (turn !== "player") return;

      const raw = promptInput.trim();
      if (!raw) return;

      const isDefendMode = raw.toLowerCase().startsWith("defend:");
      const spellQuery = isDefendMode ? raw.slice(7).trim() : raw;

      const spell = findSpell(spellQuery);
      if (spell) {
        const mode =
          isDefendMode && spell.modes.includes("defend")
            ? ("defend" as const)
            : ("attack" as const);
        stageAction({ type: "spell", spell, mode });
      } else {
        const lower = raw.toLowerCase();
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
    [promptInput, stageAction, turn],
  );

  // Reset prompt on monster turn
  useEffect(() => {
    if (turn === "monster") {
      setShowPrompt(false);
      setPromptInput("");
      setPendingAction(null);
      setSelectedTargetIndex(0);
    }
  }, [turn]);

  const CHOICES = [
    { key: "1", label: "Attack", hint: "Physical attack" },
    { key: "2", label: "Defend", hint: "Raise a shield" },
    { key: "3", label: ">_", hint: "Spell or freeform" },
  ];

  const pendingActionLabel = !pendingAction
    ? ""
    : pendingAction.type === "attack"
      ? "Attack"
      : pendingAction.type === "spell"
        ? pendingAction.spell.name
        : pendingAction.type === "heal"
          ? "Heal"
          : "Defend";

  const pendingActionHint = !pendingAction
    ? ""
    : pendingTargeting === "all-enemies"
      ? "Choose an enemy. This spell still strikes every enemy in range."
      : pendingTargeting === "single"
        ? "Self-targets always hit. Other targets use your current hit and crit chances."
        : "This action can only affect yourself.";

  return (
    <div className="flex w-full flex-col items-center gap-4 px-3 pb-8 animate-fade-in-quick sm:px-4">
      <div
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
          className={`absolute bottom-[-17%] left-[-4%] z-40 ${
            shakePlayer ? "animate-sprite-shake" : ""
          } ${lungePlayer ? "animate-player-lunge" : ""}`}
        >
          <div className="relative origin-bottom-left animate-player-breathe">
            <pre
              className={`m-0 whitespace-pre text-[8.8px] leading-[9px] select-none sm:text-[10px] sm:leading-[10.2px] lg:text-[11.8px] lg:leading-[12px] ${
                hitAbsorbPlayer ? "animate-hit-absorb" : ""
              }`}
              style={playerAsciiStyle}
            >
              {playerAscii.join("\n")}
            </pre>
            <canvas
              ref={playerOverlayRef}
              width={980}
              height={980}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>
        </div>

        <div
          className={`absolute right-[17%] top-[6%] z-20 ${
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
            <div className="relative origin-bottom animate-enemy-idle">
              <pre
                className={`m-0 whitespace-pre text-[8.4px] leading-[8.7px] select-none sm:text-[9.6px] sm:leading-[9.9px] lg:text-[11.2px] lg:leading-[11.5px] ${
                  hitAbsorbMonster ? "animate-hit-absorb" : ""
                }`}
                style={monsterAsciiStyle}
              >
                {monsterAscii.join("\n")}
              </pre>
              <canvas
                ref={monsterOverlayRef}
                width={960}
                height={980}
                className="pointer-events-none absolute inset-[-7%] h-[114%] w-[114%] mix-blend-screen opacity-95"
              />
            </div>

            <div className="absolute left-1/2 top-[calc(100%+0.4rem)] z-30 -translate-x-1/2 font-crt text-[0.82rem] leading-[1.1] whitespace-nowrap">
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
          </div>
        </div>

        <div className="absolute left-1/2 top-[71%] z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          <div className="flex items-end gap-6">
            <HeartHP current={playerHp} max={playerMaxHp} shield={playerShield} />
            <ManaFlask current={playerMana} max={playerMaxMana} />
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
            {pendingActionLabel} target
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
                {selectedTargetIndex === index ? "> " : "  "}[{index + 1}] {target.name}
                <span className="ml-3 text-[0.72rem] text-white/28">
                  hit {hitChance}% | crit {critChance}%
                </span>
              </button>
            );
          })}
          <p className="px-3 pt-1 text-[0.68rem] text-white/30">
            {pendingActionHint} [ESC] cancel.
          </p>
        </div>
      )}

      {turn === "player" && showPrompt && (
        <div className="w-full max-w-[560px] font-crt">
          <form onSubmit={handlePromptSubmit} className="flex items-center gap-2">
            <span className="font-bold text-ember">{">"}</span>
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="cast a spell, heal, or act..."
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
            Spell names, "defend:Stone", "heal", or anything you can think of.
            Offensive actions will ask for a target.
            MP: {playerMana}
          </p>
        </div>
      )}

      {turn === "monster" && (
        <p
          className="m-0 animate-wait-blink text-center text-[0.9rem] uppercase tracking-[0.16em]"
          style={{ color: "rgba(255, 100, 80, 0.55)" }}
        >
          {monsterName} acts beyond the torchlight...
        </p>
      )}
    </div>
  );
}
