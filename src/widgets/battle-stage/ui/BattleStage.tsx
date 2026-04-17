import {
  type MutableRefObject,
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
  H,
  SCENE_H,
  SCENE_W,
  W,
  buildSlashSamples,
  clamp01,
  getProjectileSceneAnchors,
  type MonsterAsciiCanvasMetrics,
  getSceneAnchors,
  sampleMonsterImpactPoint,
  sampleRandomOffscreenPoint,
} from "../lib/core";
import {
  buildHitWaveTextStyle,
  buildMonsterAsciiGlyphs,
  getHitWaveScale,
  getMonsterImpactBandDuration,
  getMonsterImpactSettleDelay,
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
import type {
  ConsolePulse,
  EffectParticle,
  ForceField,
  MonsterAsciiImpactState,
  Point,
  Projectile,
  SlashWave,
  SpriteEffect,
} from "../model/battleStageScene.types";
import { useBattleStageCanvasLoop } from "../model/useBattleStageCanvasLoop";
import { usePlayerAsciiPresentation } from "../model/usePlayerAsciiPresentation";

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
type CrtNoiseLevel = "off" | "soft" | "strong";

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
  const [monsterImpactCanvasActive, setMonsterImpactCanvasActive] = useState(false);
  const battleFrameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneFxCanvasRef = useRef<HTMLCanvasElement>(null);
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
  const monsterAsciiMetricsRef = useRef<MonsterAsciiCanvasMetrics | null>(null);
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
    potionHoverDisplacement,
    potionHovered,
    potionHoveringPlayer,
  } = usePotionUseInteraction({
    battleFrameRef,
    onConsumeSuccess: handlePotionConsumeEffect,
    onPotionUse,
    playerAsciiPreRef,
    playerAsciiText,
    playerHp,
    playerMaxHp,
    potionAvailable,
  });
  const equippedItemList = useMemo(() => getEquippedItems(equippedItems), [equippedItems]);
  const {
    playerAsciiCanvasActive,
    playerAsciiCanvasRef,
    playerAsciiClassName,
    playerAsciiMarkup,
    playerAsciiMetricsRef,
    playerAsciiRenderRef,
    playerAsciiStyle,
    playerPotionDisplacementRef,
  } = usePlayerAsciiPresentation({
    playerAscii,
    playerAsciiPreRef,
    playerAsciiText,
    equippedItems: equippedItemList,
    hitAbsorbPlayer,
    playerHitWaveProgress,
    playerHitWaveScale,
    potionHoverDisplacement,
    shakePlayer,
  });
  const monsterAsciiText = monsterAscii.join("\n");
  const monsterAsciiGlyphs = useMemo(() => buildMonsterAsciiGlyphs(monsterAscii), [monsterAscii]);
  const monsterAsciiStyle = buildHitWaveTextStyle(
    monsterTone,
    "rgba(176, 8, 20, 0.99)",
    "0 0 1px rgba(255,255,255,0.18), 0 0 8px rgba(255,255,255,0.04)",
    "0 0 16px rgba(128, 0, 12, 0.58)",
    monsterHitWaveProgress,
    monsterHitWaveScale,
    shakeMonster,
  );
  const monsterAsciiClassName = `m-0 whitespace-pre text-[6.1px] leading-[6.4px] select-none sm:text-[6.9px] sm:leading-[7.2px] lg:text-[8px] lg:leading-[8.3px] ${
    hitAbsorbMonster ? "animate-hit-absorb" : ""
  }`;
  const monsterAsciiRenderRef = useRef({ glyphs: monsterAsciiGlyphs, tone: monsterTone });

  useEffect(() => {
    monsterAsciiRenderRef.current = { glyphs: monsterAsciiGlyphs, tone: monsterTone };
  }, [monsterAsciiGlyphs, monsterTone]);

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

  useBattleStageCanvasLoop({
    canvasRef,
    consolePulsesRef,
    effectsRef,
    forceFieldsRef,
    intentSparksRef,
    lastIntentSparkFrameRef,
    monsterAsciiCanvasRef,
    monsterAsciiMetricsRef,
    monsterAsciiRenderRef,
    monsterImpactRef,
    monsterIntentOverlayRef,
    monsterOverlayRef,
    playerAsciiCanvasRef,
    playerAsciiMetricsRef,
    playerAsciiRenderRef,
    playerPotionDisplacementRef,
    playerOverlayRef,
    projectilesRef,
    rafRef,
    sceneFxCanvasRef,
    sceneScatterRef,
    slashesRef,
    textRef,
  });

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
