import {
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  PotionUseButton,
  usePotionUseInteraction,
} from "@/features/potion-use";
import CrtOverlay from "@/shared/ui/crt-overlay";
import BattleLogPanel from "@/widgets/battle-log";
import { ResourcePanel } from "@/widgets/resource-panel";
import BattleEquipmentOverlay from "./BattleEquipmentOverlay";
import BattleMonsterPanel from "./BattleMonsterPanel";
import {
  BASE_FONT_SIZE,
  DISPLACE_RADIUS,
  H,
  LINE_H,
  PLAYER_ASCII_CANVAS_TONE,
  SCENE_H,
  SCENE_W,
  SLASH_THICKNESS,
  W,
  buildSlashSamples,
  clamp01,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  getProjectileSceneAnchors,
  getSceneAnchors,
  lerp,
  mapScenePointToConsolePoint,
  sampleMonsterImpactPoint,
  sampleQuadraticPoint,
  sampleQuadraticTangent,
  sampleRandomOffscreenPoint,
} from "../lib/core";
import {
  CRT_FONT,
  buildHitWaveTextStyle,
  buildMonsterAsciiGlyphs,
  classToCanvasColor,
  drawAsciiConsoleFrame,
  drawAsciiConsoleRule,
  getHitWaveScale,
  getMonsterImpactBandDuration,
  getMonsterImpactSettleDelay,
  getProjectileTone,
  getProjectileVisual,
  makeFont,
  renderConsolePulse,
  renderIntentSparks,
  renderLiveAsciiDisplacementCanvas,
  renderMonsterAsciiImpactCanvas,
  renderOverlayEffects,
  renderTextBlockPhysics,
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

function buildEquipmentGlyphColorMap(
  playerAscii: string[],
  equippedItems: EquipmentDefinition[],
): Map<string, string> {
  const glyphColorMap = new Map<string, string>();

  for (const item of equippedItems) {
    for (const range of item.tintRanges) {
      const line = playerAscii[range.row];
      if (!line) {
        continue;
      }

      const startColumn = Math.max(0, range.startColumn);
      const endColumn = Math.min(range.endColumn, line.length - 1);
      for (let column = startColumn; column <= endColumn; column += 1) {
        if (line[column] !== " ") {
          glyphColorMap.set(`${range.row}:${column}`, item.fragmentTone);
        }
      }
    }
  }

  return glyphColorMap;
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
  const handlePotionHoverVisualChange = useCallback(({
    hovering,
    displacement,
  }: {
    hovering: boolean;
    displacement: LiveAsciiDisplacementState | null;
  }) => {
    playerPotionDisplacementRef.current = displacement;
    setPlayerAsciiCanvasActive((current) => (current === hovering ? current : hovering));
  }, []);
  const handlePotionConsumeEffect = useCallback((framePoint: Point) => {
    const frameRect = battleFrameRef.current?.getBoundingClientRect();
    if (frameRect && frameRect.width > 0 && frameRect.height > 0) {
      spawnPotionShatterBurst(sceneScatterRef.current, {
        x: (framePoint.x / frameRect.width) * SCENE_W,
        y: (framePoint.y / frameRect.height) * SCENE_H,
      });
      return;
    }

    spawnPotionShatterBurst(sceneScatterRef.current, projectileSceneAnchors.playerCore);
  }, [projectileSceneAnchors.playerCore]);

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
  const {
    activePotionPosition,
    handlePotionHoverEnd,
    handlePotionHoverStart,
    handlePotionPointerCancel,
    handlePotionPointerDown,
    handlePotionPointerMove,
    handlePotionPointerUp,
    potionDragging,
    potionHovered,
    potionHoveringPlayer,
  } = usePotionUseInteraction({
    battleFrameRef,
    onConsumeSuccess: handlePotionConsumeEffect,
    onHoverVisualChange: handlePotionHoverVisualChange,
    onPotionUse,
    playerAsciiPreRef,
    playerAsciiText,
    playerHp,
    playerMaxHp,
    potionAvailable,
  });
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
        const nextColor = playerGlyphColorMap.get(`${row}:${column}`) ?? null;
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
            onHoverEnd={handlePotionHoverEnd}
            onHoverStart={handlePotionHoverStart}
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
