import {
  type FormEvent,
  type MutableRefObject,
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
  type BattleLogEntry,
  type MonsterIntent,
  type PlayerAction,
  type PlayerStats,
  SPELLS,
  findSpell,
} from "./battleTypes";

/* ================================================================
   Types
   ================================================================ */

interface Projectile {
  chars: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  fromPlayer: boolean;
  blocked?: boolean;
  offsets: { dx: number; dy: number; rot: number }[];
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
  onAction: (action: PlayerAction) => void;
  projectileCallbackRef: MutableRefObject<
    ((word: string, fromPlayer: boolean, opts?: { blocked?: boolean }) => void) | null
  >;
}

/* ================================================================
   Pretext helpers — character-level physics displacement
   ================================================================ */

const CRT_FONT = "500 13px 'Courier New', Courier, monospace";
const W = 480;
const H = 320;
const LINE_H = 18;
const PAD = 14;
const TEXT_W = W - PAD * 2;
/** Radius within which a projectile displaces characters */
const DISPLACE_RADIUS = 90;
/** Maximum pixel push in Y */
const DISPLACE_Y = 28;
/** Maximum pixel push in X */
const DISPLACE_X = 16;

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

function getLayoutLines(text: string): LayoutLine[] {
  if (!text) return [];
  try {
    const prepared = getPrepared(text, CRT_FONT);
    return layoutWithLines(prepared, TEXT_W, LINE_H).lines;
  } catch {
    return [{ text, width: TEXT_W, start: { segmentIndex: 0, graphemeIndex: 0 }, end: { segmentIndex: 0, graphemeIndex: 0 } }];
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
): number {
  const lines = getLayoutLines(text);
  if (lines.length === 0) return startY;

  ctx.font = CRT_FONT;
  const now = performance.now();

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const baseY = startY + li * LINE_H;
    let cx = PAD;

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

      ctx.fillStyle = replaceAlpha(fillStyle, alpha);
      ctx.fillText(ch, cx + offsetX, baseY + offsetY);
      cx += charW;
    }
  }

  return startY + lines.length * LINE_H;
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
  for (let i = 0; i < 12; i++) {
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
      maxLife: 20 + Math.random() * 10,
      size: 10 + Math.random() * 6,
    });
  }
  return particles;
}

function spawnDefendParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const shieldChars = ["[", "|", "]", "#", "="];
  for (let i = 0; i < 18; i++) {
    const row = i / 18;
    particles.push({
      x: w * 0.7 + Math.random() * 10,
      y: h * 0.05 + row * h * 0.9,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.15,
      char: shieldChars[Math.floor(Math.random() * shieldChars.length)],
      color: `rgba(${80 + Math.random() * 40}, ${160 + Math.random() * 60}, 255, 1)`,
      alpha: 0,
      life: 0,
      maxLife: 80 + Math.random() * 40,
      size: 9 + Math.random() * 4,
    });
  }
  return particles;
}

function spawnMonsterDefendParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const shieldChars = ["[", "|", "]", "#", "="];
  for (let i = 0; i < 18; i++) {
    const row = i / 18;
    particles.push({
      x: w * 0.3 + Math.random() * 10,
      y: h * 0.05 + row * h * 0.9,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.15,
      char: shieldChars[Math.floor(Math.random() * shieldChars.length)],
      color: `rgba(${80 + Math.random() * 40}, ${160 + Math.random() * 60}, 255, 1)`,
      alpha: 0,
      life: 0,
      maxLife: 80 + Math.random() * 40,
      size: 9 + Math.random() * 4,
    });
  }
  return particles;
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
  for (let i = 0; i < 16; i++) {
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
      maxLife: 30 + Math.random() * 20,
      size: 8 + Math.random() * 6,
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

function spawnHitParticles(w: number, h: number): EffectParticle[] {
  const particles: EffectParticle[] = [];
  const chars = ["·", "•", "∘", ".", "×"];
  const cx = w * 0.4;
  const cy = h * 0.35;
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 50;
    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      char: chars[Math.floor(Math.random() * chars.length)],
      color: `rgba(${200 + Math.random() * 55}, ${30 + Math.random() * 40}, ${20 + Math.random() * 30}, 1)`,
      alpha: 0.9,
      life: 0,
      maxLife: 30 + Math.random() * 20,
      size: 5 + Math.random() * 4,
    });
  }
  return particles;
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
        // Persistent shield bar — respawn dead particles along the shield line
        const shieldX = effect.target === "player" ? w * 0.7 : w * 0.3;
        if (p.life > p.maxLife) {
          const shieldChars = ["[", "|", "]", "#", "="];
          p.x = shieldX + Math.random() * 10;
          p.y = h * 0.05 + Math.random() * h * 0.9;
          p.char = shieldChars[Math.floor(Math.random() * shieldChars.length)];
          p.life = 0;
          p.alpha = 0;
          p.vx = (Math.random() - 0.5) * 0.2;
          p.vy = (Math.random() - 0.5) * 0.15;
        }
        // Fade in, then hold at full
        p.alpha = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1;
        // Gentle shimmer
        p.x += Math.sin(p.life * 0.15) * 0.3;
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
  onAction,
  projectileCallbackRef,
}: BattleCombatProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeMonster, setShakeMonster] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [lungePlayer, setLungePlayer] = useState(false);
  const [monsterDying, setMonsterDying] = useState(false);
  const [hitAbsorbPlayer, setHitAbsorbPlayer] = useState(false);
  const [hitAbsorbMonster, setHitAbsorbMonster] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerOverlayRef = useRef<HTMLCanvasElement>(null);
  const monsterOverlayRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const effectsRef = useRef<SpriteEffect[]>([]);
  const forceFieldsRef = useRef<ForceField[]>([]);
  const glitchStateRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const crtScatterRef = useRef<EffectParticle[]>([]);
  const prevPlayerHpRef = useRef(playerHp);
  const prevPlayerShieldRef = useRef(playerShield);
  const prevMonsterHpRef = useRef(monsterHp);
  const prevMonsterShieldRef = useRef(monsterShield);

  /* Keep text data in a ref so the RAF loop never needs to restart */
  const textRef = useRef({ nextIntent, monsterShield, ambientText, battleLog });
  textRef.current = { nextIntent, monsterShield, ambientText, battleLog };

  const hpRatio = monsterMaxHp > 0 ? monsterHp / monsterMaxHp : 1;
  const monsterColor =
    hpRatio > 0.75
      ? "text-[rgba(200,200,200,0.85)]"
      : hpRatio > 0.5
        ? "text-[rgba(220,160,140,0.85)]"
        : hpRatio > 0.25
          ? "text-[rgba(255,100,80,0.9)]"
          : "text-[rgba(200,30,30,0.95)]";

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
          particles = spawnHitParticles(w, h);
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
        x: PAD,
        y: H / 2,
        radius: 140,
        strength: 1.2,
        startTime: performance.now(),
        duration: 999999,
      };
      forceFieldsRef.current.push(ff);
      shieldForceFieldRef.current = ff;
    }
    if (playerShield === 0 && prevPlayerShieldRef.current > 0) {
      // Shield broke — shatter burst + clear
      const shatterChars = ["#", "□", "◇", "|", "=", "[", "]", "×"];
      for (let si = 0; si < 24; si++) {
        const angle = Math.random() * Math.PI * 2;
        crtScatterRef.current.push({
          x: PAD + (Math.random() - 0.5) * 30,
          y: H / 2 + (Math.random() - 0.5) * 100,
          vx: Math.cos(angle) * (2 + Math.random() * 3.5),
          vy: Math.sin(angle) * (2 + Math.random() * 3.5),
          char: shatterChars[Math.floor(Math.random() * shatterChars.length)],
          color: `rgba(${60 + Math.random() * 100}, ${120 + Math.random() * 100}, 255, 1)`,
          alpha: 1,
          life: 0,
          maxLife: 30 + Math.random() * 25,
          size: 9 + Math.random() * 7,
        });
      }
      setGlitchActive(true);
      window.setTimeout(() => setGlitchActive(false), 300);

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
  }, [playerShield, triggerEffect]);

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
        x: W - PAD,
        y: H / 2,
        radius: 140,
        strength: -1.2,
        startTime: performance.now(),
        duration: 999999,
      };
      forceFieldsRef.current.push(ff);
      monsterShieldForceFieldRef.current = ff;
    }
    if (monsterShield === 0 && prevMonsterShieldRef.current > 0) {
      // Shield broke — shatter burst + clear
      const shatterChars = ["#", "□", "◇", "|", "=", "[", "]", "×"];
      for (let si = 0; si < 24; si++) {
        const angle = Math.random() * Math.PI * 2;
        crtScatterRef.current.push({
          x: W - PAD + (Math.random() - 0.5) * 30,
          y: H / 2 + (Math.random() - 0.5) * 100,
          vx: Math.cos(angle) * (2 + Math.random() * 3.5),
          vy: Math.sin(angle) * (2 + Math.random() * 3.5),
          char: shatterChars[Math.floor(Math.random() * shatterChars.length)],
          color: `rgba(${60 + Math.random() * 100}, ${120 + Math.random() * 100}, 255, 1)`,
          alpha: 1,
          life: 0,
          maxLife: 30 + Math.random() * 25,
          size: 9 + Math.random() * 7,
        });
      }
      setGlitchActive(true);
      window.setTimeout(() => setGlitchActive(false), 300);

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
  }, [monsterShield]);

  // ── Detect monster death (guard: only fire once, delayed for projectile+hit) ──
  const monsterDeathFiredRef = useRef(false);
  const monsterDeathTimerRef = useRef<number>(0);
  useEffect(() => {
    if (monsterHp <= 0 && prevMonsterHpRef.current > 0 && !monsterDeathFiredRef.current) {
      monsterDeathFiredRef.current = true;
      // Wait for projectile travel (1200ms) + hit effect (600ms) before death anim
      monsterDeathTimerRef.current = window.setTimeout(() => {
        setMonsterDying(true);
      }, 1800);
    }
    prevMonsterHpRef.current = monsterHp;
    return () => {
      if (monsterDeathTimerRef.current) {
        window.clearTimeout(monsterDeathTimerRef.current);
      }
    };
  }, [monsterHp]);

  // ── Monster charge/shield during PLAYER's turn (shows intent before player acts) ──
  useEffect(() => {
    if (turn !== "player" || monsterHp <= 0) return;

    const isDefend = nextIntent.kind === "defend";
    const duration = 30000; // very long — we kill it when player acts (turn changes)
    const ffStrength = isDefend ? 1.5 : -1.5; // defend: repel, attack: attract

    // Black hole / nova force field — much stronger displacement
    forceFieldsRef.current.push({
      x: W - PAD,
      y: H / 2,
      radius: 220,
      strength: ffStrength * 3, // 3x stronger for dramatic text displacement
      startTime: performance.now(),
      duration,
    });

    // Cleanup when player acts (turn changes away from "player")
    return () => {
      effectsRef.current = effectsRef.current.filter(
        (e) => e.type !== "charge" && e.type !== "shieldCharge",
      );
      forceFieldsRef.current = forceFieldsRef.current.filter(
        (ff) => Math.abs(ff.strength) < 2, // remove the strong charge fields (4.5)
      );
    };
  }, [turn, monsterHp, nextIntent.kind, triggerEffect]);

  // ── Projectile callback ──
  useEffect(() => {
    projectileCallbackRef.current = (word: string, fromPlayer: boolean, opts?: { blocked?: boolean }) => {
      if (!word) return;
      const canvas = canvasRef.current;
      const cw = canvas?.width ?? W;
      const ch = canvas?.height ?? H;

      projectilesRef.current.push({
        chars: word.split(""),
        x: fromPlayer ? -40 : cw + 40,
        y: ch / 2 + (Math.random() - 0.5) * 80,
        vx: fromPlayer ? 5 + Math.random() * 2 : -5 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        alive: true,
        fromPlayer,
        blocked: opts?.blocked,
        offsets: word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
      });

      if (fromPlayer) {
        // Lunge animation starts immediately
        if (word === "STRIKE") {
          setLungePlayer(true);
          window.setTimeout(() => setLungePlayer(false), 700);
        }

        // Slash/spell effect — delayed to sync with projectile arrival
        window.setTimeout(() => {
          if (opts?.blocked) return;
          if (word === "STRIKE") {
            triggerEffect("slash", "monster", 1000);
          } else {
            const spell = SPELLS.find(
              (s) => s.name.toUpperCase() === word,
            );
            triggerEffect("spell", "monster", 1400, spell?.element);
          }
        }, 1000);

        // Hit effect after impact
        window.setTimeout(() => {
          if (opts?.blocked) {
            // Monster shield blocks — no hit effect
          } else {
            setShakeMonster(true);
            window.setTimeout(() => setShakeMonster(false), 600);
            triggerEffect("hit", "monster", 600);
            setHitAbsorbMonster(true);
            window.setTimeout(() => setHitAbsorbMonster(false), 500);
          }
        }, 1200);
      } else {
        // Monster projectile hitting player
        window.setTimeout(() => {
          if (opts?.blocked) {
            // Shield blocks — dissolve projectile with scatter particles
            triggerEffect("defend", "player", 600);
          } else {
            setShakePlayer(true);
            window.setTimeout(() => setShakePlayer(false), 600);
            triggerEffect("hit", "player", 600);
            setHitAbsorbPlayer(true);
            window.setTimeout(() => setHitAbsorbPlayer(false), 500);
          }
        }, 1200);
      }
    };
    return () => {
      projectileCallbackRef.current = null;
    };
  }, [projectileCallbackRef, triggerEffect]);

  // ── Canvas loop — pretext dynamic layout + projectiles + effects ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      const {
        nextIntent: intent,
        monsterShield: mShield,
        ambientText: ambient,
        battleLog: log,
      } = textRef.current;
      const projectiles = projectilesRef.current;
      const forceFields = forceFieldsRef.current;
      const now = performance.now();

      // Prune expired force fields
      forceFieldsRef.current = forceFields.filter(
        (ff) => now - ff.startTime < ff.duration,
      );

      ctx.font = CRT_FONT;
      ctx.textBaseline = "top";

      let y = 12;

      // 1. Monster intent (orange, highest priority)
      y = renderTextBlockPhysics(
        ctx,
        `> ${intent.label}`,
        "rgba(255, 170, 60, 0.85)",
        y,
        projectiles,
        forceFields,
      );
      y += 4;

      if (mShield > 0) {
        y = renderTextBlockPhysics(
          ctx,
          `  [Shield: ${mShield}]`,
          "rgba(100, 180, 255, 0.6)",
          y,
          projectiles,
          forceFields,
        );
      }

      // 2. Ambient text (dim, medium priority)
      y = renderTextBlockPhysics(
        ctx,
        ambient,
        "rgba(180, 180, 180, 0.5)",
        y,
        projectiles,
        forceFields,
      );
      y += 4;

      // Separator
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(PAD, y, W - PAD * 2, 1);
      y += 8;

      // 3. Battle log (scrolls up)
      const maxLogLines = Math.floor((H - y - 10) / LINE_H);
      const visibleLog = log.slice(-maxLogLines);

      for (const entry of visibleLog) {
        ctx.font = CRT_FONT;
        y = renderTextBlockPhysics(
          ctx,
          entry.text,
          classToCanvasColor(entry.color),
          y,
          projectiles,
          forceFields,
        );
      }

      // ── Projectiles ──
      let anyCrossing = false;
      const PLAYER_SHIELD_X = PAD; // player shield collision zone (CRT edge)
      const MONSTER_SHIELD_X = W - PAD; // monster shield collision zone (CRT edge)

      for (const p of projectiles) {
        if (!p.alive) continue;
        p.x += p.vx;
        p.y += p.vy;

        // Blocked enemy projectile — dissolve at player shield zone
        if (!p.fromPlayer && p.blocked && p.x < PLAYER_SHIELD_X) {
          p.alive = false;
          const scatterChars = ["*", "·", "◦", "○", "□"];
          for (let si = 0; si < 12; si++) {
            const angle = Math.random() * Math.PI * 2;
            crtScatterRef.current.push({
              x: p.x,
              y: p.y,
              vx: Math.cos(angle) * (1.5 + Math.random() * 2),
              vy: Math.sin(angle) * (1.5 + Math.random() * 2),
              char: scatterChars[Math.floor(Math.random() * scatterChars.length)],
              color: `rgba(${80 + Math.random() * 40}, ${160 + Math.random() * 60}, 255, 1)`,
              alpha: 1,
              life: 0,
              maxLife: 20 + Math.random() * 15,
              size: 8 + Math.random() * 5,
            });
          }
          continue;
        }

        // Blocked player projectile — dissolve at monster shield zone
        if (p.fromPlayer && p.blocked && p.x > MONSTER_SHIELD_X) {
          p.alive = false;
          const scatterChars = ["*", "·", "◦", "○", "□"];
          for (let si = 0; si < 12; si++) {
            const angle = Math.random() * Math.PI * 2;
            crtScatterRef.current.push({
              x: p.x,
              y: p.y,
              vx: Math.cos(angle) * (1.5 + Math.random() * 2),
              vy: Math.sin(angle) * (1.5 + Math.random() * 2),
              char: scatterChars[Math.floor(Math.random() * scatterChars.length)],
              color: `rgba(${80 + Math.random() * 40}, ${160 + Math.random() * 60}, 255, 1)`,
              alpha: 1,
              life: 0,
              maxLife: 20 + Math.random() * 15,
              size: 8 + Math.random() * 5,
            });
          }
          continue;
        }

        p.offsets.forEach((o) => {
          o.dx += (Math.random() - 0.5) * 0.4;
          o.dy += (Math.random() - 0.5) * 0.4;
          o.rot += (Math.random() - 0.5) * 0.03;
        });

        if (p.x > 0 && p.x < W) anyCrossing = true;

        ctx.save();
        ctx.font = "bold 18px 'Courier New', monospace";
        ctx.fillStyle = p.fromPlayer
          ? "rgba(100, 220, 255, 0.9)"
          : "rgba(255, 80, 60, 0.9)";
        ctx.shadowColor = p.fromPlayer
          ? "rgba(100, 220, 255, 0.4)"
          : "rgba(255, 80, 60, 0.4)";
        ctx.shadowBlur = 16;

        for (let i = 0; i < p.chars.length; i += 1) {
          const o = p.offsets[i];
          ctx.save();
          ctx.translate(p.x + i * 14 + o.dx, p.y + o.dy);
          ctx.rotate(o.rot);
          ctx.fillText(p.chars[i], 0, 0);
          ctx.restore();
        }
        ctx.restore();

        if (
          (p.fromPlayer && p.x > W + 20) ||
          (!p.fromPlayer && p.x < -20) ||
          p.x < -200 ||
          p.x > W + 200
        ) {
          p.alive = false;
        }
      }

      if (glitchStateRef.current !== anyCrossing) {
        glitchStateRef.current = anyCrossing;
        setGlitchActive(anyCrossing);
      }

      projectilesRef.current = projectiles.filter((p) => p.alive);

      // ── CRT scatter particles (shield block dissolve) ──
      const scatter = crtScatterRef.current;
      for (let si = scatter.length - 1; si >= 0; si--) {
        const sp = scatter[si];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.95;
        sp.vy *= 0.95;
        sp.life += 1;
        if (sp.life > sp.maxLife) {
          scatter.splice(si, 1);
          continue;
        }
        const ratio = sp.life / sp.maxLife;
        const fade = ratio > 0.5 ? 1 - (ratio - 0.5) / 0.5 : 1;
        ctx.save();
        ctx.globalAlpha = fade * sp.alpha;
        ctx.font = `bold ${sp.size}px 'Courier New', monospace`;
        ctx.fillStyle = sp.color;
        ctx.shadowColor = sp.color;
        ctx.shadowBlur = 6;
        ctx.fillText(sp.char, sp.x, sp.y);
        ctx.restore();
      }

      // ── Sprite overlay effects ──
      const effects = effectsRef.current;
      const playerOverlay = playerOverlayRef.current;
      const monsterOverlay = monsterOverlayRef.current;

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

          // ── Black hole / Nova charge orb on monster overlay ──
          for (const ff of forceFieldsRef.current) {
            const ffElapsed = now - ff.startTime;
            if (ffElapsed < 0 || ffElapsed > ff.duration) continue;
            if (Math.abs(ff.strength) < 2) continue;
            const isAttack = ff.strength < 0;
            const ffProgress = Math.min(ffElapsed / 400, 1);
            const pulse = 1 + Math.sin(ffElapsed * 0.004) * 0.08;
            const orbX = monsterOverlay.width * 0.12;
            const orbY = monsterOverlay.height * 0.45;
            const baseRadius = 25 * pulse * ffProgress;

            mCtx.save();
            const color = isAttack ? [255, 255, 255] : [80, 160, 255];
            for (let layer = 3; layer >= 0; layer--) {
              const r = baseRadius + layer * 10;
              const a = (0.05 + (3 - layer) * 0.07) * ffProgress;
              const grad = mCtx.createRadialGradient(orbX, orbY, 0, orbX, orbY, r);
              grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${a})`);
              grad.addColorStop(0.5, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${a * 0.5})`);
              grad.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
              mCtx.fillStyle = grad;
              mCtx.beginPath();
              mCtx.arc(orbX, orbY, r, 0, Math.PI * 2);
              mCtx.fill();
            }
            const coreGrad = mCtx.createRadialGradient(orbX, orbY, 0, orbX, orbY, baseRadius);
            if (isAttack) {
              coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * ffProgress})`);
              coreGrad.addColorStop(0.6, `rgba(200, 200, 200, ${0.5 * ffProgress})`);
              coreGrad.addColorStop(1, `rgba(150, 150, 150, ${0.1 * ffProgress})`);
            } else {
              coreGrad.addColorStop(0, `rgba(120, 200, 255, ${0.85 * ffProgress})`);
              coreGrad.addColorStop(0.6, `rgba(60, 140, 255, ${0.45 * ffProgress})`);
              coreGrad.addColorStop(1, `rgba(40, 80, 200, ${0.1 * ffProgress})`);
            }
            mCtx.fillStyle = coreGrad;
            mCtx.beginPath();
            mCtx.arc(orbX, orbY, baseRadius, 0, Math.PI * 2);
            mCtx.fill();
            mCtx.restore();
          }
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

  // Auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleLog]);

  // ── Keyboard navigation ──
  useEffect(() => {
    if (turn !== "player") return;

    const handler = (e: KeyboardEvent) => {
      if (showPrompt) {
        if (e.key === "Escape") {
          setShowPrompt(false);
          setPromptInput("");
        }
        return;
      }
      if (e.key === "ArrowUp" || e.key === "w") {
        setSelectedIndex((v) => (v <= 0 ? 2 : v - 1));
      } else if (e.key === "ArrowDown" || e.key === "s") {
        setSelectedIndex((v) => (v >= 2 ? 0 : v + 1));
      } else if (e.key === "Enter") {
        executeChoice(selectedIndex);
      } else if (e.key === "1") {
        executeChoice(0);
      } else if (e.key === "2") {
        executeChoice(1);
      } else if (e.key === "3") {
        executeChoice(2);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [turn, showPrompt, selectedIndex]);

  const executeChoice = useCallback(
    (index: number) => {
      if (index === 0) {
        onAction({ type: "attack" });
      } else if (index === 1) {
        onAction({ type: "defend" });
      } else {
        setShowPrompt(true);
      }
    },
    [onAction],
  );

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
        onAction({ type: "spell", spell, mode });
      } else {
        const lower = raw.toLowerCase();
        if (
          lower.includes("heal") ||
          lower.includes("breath") ||
          lower.includes("rest") ||
          lower.includes("호흡") ||
          lower.includes("회복")
        ) {
          onAction({ type: "heal" });
        } else {
          onAction({ type: "attack" });
        }
      }

      setPromptInput("");
      setShowPrompt(false);
    },
    [turn, promptInput, onAction],
  );

  // Reset prompt on monster turn
  useEffect(() => {
    if (turn === "monster") {
      setShowPrompt(false);
      setPromptInput("");
    }
  }, [turn]);

  const CHOICES = [
    { key: "1", label: "Attack" },
    { key: "2", label: "Defend" },
    { key: "3", label: ">_" },
  ];

  return (
    <div className="flex w-full max-w-[1200px] flex-col items-center justify-center gap-6 px-4 animate-fade-in-quick lg:flex-row lg:gap-8">
      {/* Player ASCII */}
      <div
        className={`flex shrink-0 items-end transition-transform duration-100 ${
          shakePlayer ? "animate-sprite-shake" : ""
        } ${lungePlayer ? "animate-player-lunge" : ""}`}
      >
        <div className="relative">
          <pre
            className={`m-0 whitespace-pre text-[6px] leading-[7px] select-none sm:text-[7px] sm:leading-[8px] ${
              hitAbsorbPlayer ? "animate-hit-absorb" : ""
            } ${
              shakePlayer
                ? "text-[rgba(255,80,80,0.9)]"
                : "text-[rgba(200,200,200,0.85)]"
            }`}
          >
            {playerAscii.join("\n")}
          </pre>
          <canvas
            ref={playerOverlayRef}
            width={300}
            height={300}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        </div>
      </div>

      {/* Center panel */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
        {/* HP + Mana — right above CRT */}
        <div className="flex items-center gap-4">
          <HeartHP current={playerHp} max={playerMaxHp} shield={playerShield} />
          <ManaFlask current={playerMana} max={playerMaxMana} />
        </div>

        {/* CRT container — all text lives here */}
        <div
          className={`relative overflow-hidden rounded-xl shadow-[inset_0_0_40px_rgba(0,0,0,0.5),0_0_30px_rgba(0,0,0,0.6)] ${
            glitchActive ? "animate-crt-glitch" : ""
          }`}
        >
          <canvas
            ref={canvasRef}
            className="block h-auto w-[min(92vw,480px)] max-w-full"
          />
          <CrtOverlay glitchActive={glitchActive} />
        </div>

        {/* Terminal-style choices (OUTSIDE CRT, below) */}
        {turn === "player" && !showPrompt && (
          <div className="w-full max-w-[480px] font-crt text-[0.9rem]">
            {CHOICES.map((c, i) => (
              <div
                key={c.key}
                className={`cursor-pointer px-3 py-1 tracking-[0.06em] transition-colors duration-100 ${
                  selectedIndex === i
                    ? "text-ember [text-shadow:0_0_6px_rgba(255,170,0,0.4)]"
                    : "text-ash/50 hover:text-ash/80"
                }`}
                onClick={() => executeChoice(i)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {selectedIndex === i ? "> " : "  "}
                [{c.key}] {c.label}
              </div>
            ))}
          </div>
        )}

        {/* Direct input prompt */}
        {turn === "player" && showPrompt && (
          <div className="w-full max-w-[480px]">
            <form
              onSubmit={handlePromptSubmit}
              className="flex items-center gap-2"
            >
              <span className="font-bold text-ember">{">"}</span>
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="cast a spell, heal, or act..."
                autoFocus
                className="min-w-0 flex-1 border-0 border-b border-ember/30 bg-transparent text-[1rem] text-ember outline-none placeholder:text-white/25 focus:border-ember sm:text-[1.1rem]"
              />
              <button
                type="button"
                onClick={() => setShowPrompt(false)}
                className="cursor-pointer border-0 bg-transparent text-[0.8rem] text-white/40 hover:text-white/70"
              >
                [ESC]
              </button>
            </form>
            <p className="mt-1 text-[0.6rem] text-white/20">
              Spell names, "defend:Stone", "heal", or anything you can think of.
              MP: {playerMana}
            </p>
          </div>
        )}

        {/* Monster turn */}
        {turn === "monster" && (
          <p className="m-0 text-center text-[0.95rem] tracking-[0.1em] text-[rgba(255,100,80,0.5)] animate-wait-blink">
            {monsterName} acts...
          </p>
        )}

        <div ref={logEndRef} />
      </div>

      {/* Monster ASCII */}
      <div
        className={`flex shrink-0 items-end transition-transform duration-100 ${
          shakeMonster ? "animate-sprite-shake" : ""
        } ${monsterDying ? "animate-monster-sink" : ""}`}
      >
        <div className="relative">
          <pre
            className={`m-0 whitespace-pre text-[6px] leading-[7px] select-none sm:text-[7px] sm:leading-[8px] transition-colors duration-500 ${
              hitAbsorbMonster ? "animate-hit-absorb" : ""
            } ${
              shakeMonster ? "text-[rgba(255,80,80,0.9)]" : monsterColor
            }`}
          >
            {monsterAscii.join("\n")}
          </pre>
          <canvas
            ref={monsterOverlayRef}
            width={300}
            height={300}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}
