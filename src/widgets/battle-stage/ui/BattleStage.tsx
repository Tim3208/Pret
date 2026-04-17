import {
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type LayoutLine,
  type PreparedTextWithSegments,
  layoutWithLines,
  prepareWithSegments,
} from "@chenglou/pretext";
import { BATTLE_COMBAT_TEXT } from "@/content/text/battle/ui";
import {
  type BattleLogEntry,
  type BattleTargetOption,
  type CombatAnimationRequest,
  type PlayerAction,
} from "@/entities/combat";
import {
  type EquipmentDefinition,
  type EquippedItems,
  getEquippedItems,
} from "@/entities/equipment";
import type { Language } from "@/entities/locale";
import type { MonsterIntent } from "@/entities/monster";
import type { PlayerStats } from "@/entities/player";
import BattleCommandInput from "@/features/battle-command-input";
import {
  POTION_USE_BUTTON_HEIGHT,
  POTION_USE_BUTTON_WIDTH,
  PotionUseButton,
} from "@/features/potion-use";
import CrtOverlay from "@/shared/ui/crt-overlay";
import BattleLogPanel from "@/widgets/battle-log";
import { ResourcePanel } from "@/widgets/resource-panel";
import BattleEquipmentOverlay from "./BattleEquipmentOverlay";
import BattleMonsterPanel from "./BattleMonsterPanel";
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
} from "../lib/visuals";

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

interface BattleStageProps {
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
export default function BattleStage({
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
}: BattleStageProps) {
  const combatText = BATTLE_COMBAT_TEXT[language];
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
  const battleFrameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneFxCanvasRef = useRef<HTMLCanvasElement>(null);
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
  const playerAsciiText = playerAscii.join("\n");
  const equippedItemList = useMemo(() => getEquippedItems(equippedItems), [equippedItems]);
  const playerGlyphColorMap = useMemo(
    () => buildEquipmentGlyphColorMap(playerAscii, equippedItemList),
    [equippedItemList, playerAscii],
  );
  const playerAsciiGlyphs = useMemo(() => buildMonsterAsciiGlyphs(playerAscii), [playerAscii]);
  const monsterAsciiText = monsterAscii.join("\n");
  const monsterAsciiGlyphs = useMemo(() => buildMonsterAsciiGlyphs(monsterAscii), [monsterAscii]);
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
      x: Math.max(
        POTION_USE_BUTTON_WIDTH * 0.5,
        Math.min(frameRect.width - POTION_USE_BUTTON_WIDTH * 0.5, rawX),
      ),
      y: Math.max(
        POTION_USE_BUTTON_HEIGHT * 0.5,
        Math.min(frameRect.height - POTION_USE_BUTTON_HEIGHT * 0.5, rawY),
      ),
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
            <BattleEquipmentOverlay
              effectLabel={combatText.equipmentEffectLabel}
              inactiveLabel={combatText.equipmentInactiveLabel}
              items={equippedItemList}
              language={language}
            />
          </div>
        </div>

        {potionAvailable && activePotionPosition && (
          <PotionUseButton
            ariaLabel={combatText.potionAriaLabel}
            dragging={potionDragging}
            hovered={potionHovered}
            hoveringPlayer={potionHoveringPlayer}
            label={combatText.potionLabel}
            onHoverEnd={() => setPotionHovered(false)}
            onHoverStart={() => setPotionHovered(true)}
            onPointerCancel={handlePotionPointerCancel}
            onPointerDown={handlePotionPointerDown}
            onPointerMove={handlePotionPointerMove}
            onPointerUp={handlePotionPointerUp}
            position={activePotionPosition}
            tooltip={combatText.potionTooltip}
          />
        )}

        <BattleMonsterPanel
          monsterAsciiCanvasRef={monsterAsciiCanvasRef}
          monsterAsciiClassName={monsterAsciiClassName}
          monsterAsciiPreRef={monsterAsciiPreRef}
          monsterAsciiStyle={monsterAsciiStyle}
          monsterAsciiText={monsterAsciiText}
          monsterDying={monsterDying}
          monsterHp={monsterHp}
          monsterImpactCanvasActive={monsterImpactCanvasActive}
          monsterIntentOverlayRef={monsterIntentOverlayRef}
          monsterMaxHp={monsterMaxHp}
          monsterOverlayRef={monsterOverlayRef}
          monsterShield={monsterShield}
          shakeMonster={shakeMonster}
        />

        <BattleLogPanel canvasRef={canvasRef} glitchActive={glitchActive} />

        <div className="absolute left-1/2 top-[71%] z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          <ResourcePanel
            hpCurrent={playerHp}
            hpMax={playerMaxHp}
            manaCurrent={playerMana}
            manaMax={playerMaxMana}
            shield={playerShield}
            hpLabel={combatText.hpLabel}
            manaLabel={combatText.manaLabel}
            shieldLabel={combatText.shieldLabel}
          />
        </div>

        <CrtOverlay glitchActive={glitchActive} noiseLevel={crtNoiseLevel} />
      </div>

      <BattleCommandInput
        language={language}
        monsterName={monsterName}
        playerMana={playerMana}
        playerStats={playerStats}
        targetOptions={targetOptions}
        turn={turn}
        onAction={onAction}
      />
    </div>
  );
}
