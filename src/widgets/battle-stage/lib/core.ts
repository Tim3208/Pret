// Shared combat geometry, animation data, and fixed scene measurements.
// Keep this file pure so BattleCombat can memoize and reuse the helpers safely.
export interface Projectile {
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

export interface Point {
  x: number;
  y: number;
}

export interface ShieldPlane {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
  center: Point;
}

export interface SlashSample extends Point {
  nx: number;
  ny: number;
  t: number;
}

export interface SlashWave {
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

export interface SlashField {
  points: SlashSample[];
  intensity: number;
  thickness: number;
  strength: number;
  alphaLoss: number;
}

export interface SceneAnchors {
  playerMuzzle: Point;
  monsterCore: Point;
  playerShield: ShieldPlane;
  monsterShield: ShieldPlane;
  slashStart: Point;
  slashControl: Point;
  slashEnd: Point;
}

export interface ProjectileSceneAnchors {
  playerMuzzle: Point;
  playerCore: Point;
  playerShield: Point;
  monsterCore: Point;
  monsterShield: Point;
}

export interface EffectParticle {
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

export interface SpriteEffect {
  type: "heal" | "slash" | "defend" | "spell" | "charge" | "shieldCharge" | "hit";
  target: "player" | "monster";
  element?: string;
  startTime: number;
  duration: number;
  particles: EffectParticle[];
  persistent?: boolean;
}

export interface ForceField {
  x: number;
  y: number;
  radius: number;
  strength: number;
  startTime: number;
  duration: number;
}

export interface TextRenderOptions {
  fontWeight?: number;
  fontSize?: number;
  inkBleed?: number;
}

export interface AsciiConsoleFrame {
  startX: number;
  cols: number;
  rows: number;
  topY: number;
  bottomY: number;
}

export interface ConsolePulse {
  color: "blue" | "red";
  startTime: number;
  duration: number;
  strength: "soft" | "strong";
}

export interface MonsterAsciiImpactState {
  startedAt: number;
  duration: number;
  direction: -1 | 1;
  strength: number;
  centerRatio: number;
  columnRatio: number;
  radiusRatio: number;
}

export interface LiveAsciiDisplacementState {
  direction: -1 | 1;
  strength: number;
  centerRatio: number;
  columnRatio: number;
  radiusRatio: number;
}

export interface MonsterAsciiGlyph {
  char: string;
  row: number;
  column: number;
  rowRatio: number;
  columnRatio: number;
}

export interface MonsterAsciiCanvasMetrics {
  dpr: number;
  width: number;
  height: number;
  charWidth: number;
  lineHeight: number;
  baseline: number;
  font: string;
}

// W/H describe the inner CRT console, while SCENE_W/H describe the wider FX stage.
export const CRT_FONT_FAMILY = "'Courier New', Courier, monospace";
export const BASE_FONT_SIZE = 12;
export const W = 480;
export const H = 320;
export const SCENE_W = 1140;
export const SCENE_H = 712;
export const LINE_H = 18;
export const PAD = 14;
export const TEXT_W = W - PAD * 2;
export const POTION_WIDTH = 56;
export const POTION_HEIGHT = 92;
export const DISPLACE_RADIUS = 90;
export const DISPLACE_Y = 28;
export const DISPLACE_X = 16;
export const SLASH_THICKNESS = 34;
export const PLAYER_ASCII_CANVAS_TONE = "rgba(244, 244, 244, 0.98)";

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

// Potion dragging works in viewport-space DOM rects, so this helper stays outside scene math.
export function pointInsideDomRect(point: Point, rect: DOMRect, padding = 0): boolean {
  return (
    point.x >= rect.left - padding &&
    point.x <= rect.right + padding &&
    point.y >= rect.top - padding &&
    point.y <= rect.bottom + padding
  );
}

export function easeOutCubic(value: number): number {
  const clamped = clamp01(value);
  return 1 - (1 - clamped) ** 3;
}

export function easeInCubic(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * clamped;
}

export function easeInOutCubic(value: number): number {
  const clamped = clamp01(value);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - ((-2 * clamped + 2) ** 3) / 2;
}

export function sampleQuadraticPoint(start: Point, control: Point, end: Point, t: number): Point {
  const inv = 1 - t;
  return {
    x: inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
    y: inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
  };
}

export function sampleQuadraticNormal(start: Point, control: Point, end: Point, t: number): Point {
  const dx = 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x);
  const dy = 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y);
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: -dy / length,
    y: dx / length,
  };
}

export function sampleQuadraticTangent(start: Point, control: Point, end: Point, t: number): Point {
  const dx = 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x);
  const dy = 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y);
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: dx / length,
    y: dy / length,
  };
}

export function makeShieldPlane(
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

// Pre-sample the slash curve once so the RAF loop can reuse tangents and normals cheaply.
export function buildSlashSamples(start: Point, control: Point, end: Point): SlashSample[] {
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

// These anchors are composition guides for the combat layout, not live DOM measurements.
export function getSceneAnchors(width: number, height: number): SceneAnchors {
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

// Projectile anchors use the larger scene canvas, so they can diverge from the CRT composition a bit.
export function getProjectileSceneAnchors(width: number, height: number): ProjectileSceneAnchors {
  return {
    playerMuzzle: { x: width * 0.28, y: height * 0.71 },
    playerCore: { x: width * 0.235, y: height * 0.63 },
    playerShield: { x: width * 0.292, y: height * 0.56 },
    monsterCore: { x: width * 0.774, y: height * 0.198 },
    monsterShield: { x: width * 0.736, y: height * 0.162 },
  };
}

// Misses still stay in the forward hemisphere so they read like overshoots, not random teleports.
export function sampleRandomOffscreenPoint(origin: Point, heading?: Point): Point {
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

    return normalizedHeading.x * normalizedCandidate.x + normalizedHeading.y * normalizedCandidate.y >= 0;
  });

  return candidates[Math.floor(Math.random() * candidates.length)] ?? {
    x: SCENE_W + padding,
    y: origin.y - padding,
  };
}

// Direct hits land in a loose torso pocket instead of the exact core point to avoid visual stacking.
export function sampleMonsterImpactPoint(anchors: ProjectileSceneAnchors): Point {
  const horizontalSpan = Math.max(22, Math.abs(anchors.monsterCore.x - anchors.monsterShield.x));
  const verticalSpan = Math.max(18, Math.abs(anchors.monsterCore.y - anchors.monsterShield.y));

  return {
    x: anchors.monsterCore.x - horizontalSpan * (0.55 + Math.random() * 1.25),
    y: anchors.monsterCore.y + verticalSpan * (0.45 + Math.random() * 1.45),
  };
}

// Scene hits are projected back into console space so the text layer can react to the same impact.
export function mapScenePointToConsolePoint(
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