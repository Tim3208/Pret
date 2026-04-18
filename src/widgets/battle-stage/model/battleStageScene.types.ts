import type { MonsterAsciiGlyph } from "../lib/core";

export interface Point {
  x: number;
  y: number;
}

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

export interface SlashSample {
  x: number;
  y: number;
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

export interface PlayerAsciiRenderState {
  glyphColors: Map<string, string>;
  glyphs: MonsterAsciiGlyph[];
}

export interface MonsterAsciiRenderState {
  glyphs: MonsterAsciiGlyph[];
  tone: string;
}
