import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CombatAnimationRequest } from "@/entities/combat";
import {
  buildSlashSamples,
  type ProjectileSceneAnchors,
  SCENE_H,
  SCENE_W,
  type SceneAnchors,
  sampleMonsterImpactPoint,
  sampleRandomOffscreenPoint,
} from "../lib/core";
import {
  getHitWaveScale,
  getMonsterImpactSettleDelay,
  spawnImpactBurst,
} from "../lib/visuals";
import type {
  ConsolePulse,
  EffectParticle,
  Point,
  Projectile,
  SlashWave,
  SpriteEffect,
} from "./battleStageScene.types";

type CrtNoiseLevel = "off" | "soft" | "strong";

interface UseBattleStageCombatFeedbackParams {
  monsterImpactBandTriggerRef: MutableRefObject<
    ((impactPoint: Point, damage: number, critical: boolean) => void) | null
  >;
  monsterMaxHp: number;
  playerMaxHp: number;
  projectileCallbackRef: MutableRefObject<((request: CombatAnimationRequest) => void) | null>;
  projectileSceneAnchors: ProjectileSceneAnchors;
  sceneAnchors: SceneAnchors;
  sceneScatterRef: MutableRefObject<EffectParticle[]>;
  triggerEffect: (
    type: SpriteEffect["type"],
    target: "player" | "monster",
    duration: number,
    element?: string,
  ) => void;
}

/**
 * 전투 중 발생하는 공격 피드백과 투사체/베기 callback 등록을 관리한다.
 * `BattleStage`에서 일회성 흔들림, CRT 반응, hit-wave, impact 분기를 제거해
 * 화면 컴포넌트가 DOM 배치와 훅 조합에 집중하도록 만든다.
 */
export function useBattleStageCombatFeedback({
  monsterImpactBandTriggerRef,
  monsterMaxHp,
  playerMaxHp,
  projectileCallbackRef,
  projectileSceneAnchors,
  sceneAnchors,
  sceneScatterRef,
  triggerEffect,
}: UseBattleStageCombatFeedbackParams) {
  const [crtNoiseLevel, setCrtNoiseLevel] = useState<CrtNoiseLevel>("off");
  const [glitchActive, setGlitchActive] = useState(false);
  const [hitAbsorbMonster, setHitAbsorbMonster] = useState(false);
  const [hitAbsorbPlayer, setHitAbsorbPlayer] = useState(false);
  const [lungePlayer, setLungePlayer] = useState(false);
  const [monsterHitWaveProgress, setMonsterHitWaveProgress] = useState<number | null>(null);
  const [monsterHitWaveScale, setMonsterHitWaveScale] = useState(1.35);
  const [playerHitWaveProgress, setPlayerHitWaveProgress] = useState<number | null>(null);
  const [playerHitWaveScale, setPlayerHitWaveScale] = useState(1.35);
  const [shakeMonster, setShakeMonster] = useState(false);
  const [shakePlayer, setShakePlayer] = useState(false);
  const consolePulsesRef = useRef<ConsolePulse[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const slashesRef = useRef<SlashWave[]>([]);
  const scheduledTimeoutsRef = useRef(new Set<number>());
  const noiseResetRef = useRef<number | null>(null);
  const playerHitWaveFrameRef = useRef<number | null>(null);
  const monsterHitWaveFrameRef = useRef<number | null>(null);

  /**
   * 추후 정리가 가능하도록 timeout을 등록하고, 완료되면 추적 목록에서 제거한다.
   */
  const trackTimeout = useCallback((callback: () => void, delay: number) => {
    let timeoutId = 0;
    timeoutId = window.setTimeout(() => {
      scheduledTimeoutsRef.current.delete(timeoutId);
      callback();
    }, delay);
    scheduledTimeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  /**
   * 현재 추적 중인 timeout을 안전하게 취소한다.
   */
  const clearTrackedTimeout = useCallback((timeoutId: number | null) => {
    if (timeoutId == null) {
      return;
    }
    window.clearTimeout(timeoutId);
    scheduledTimeoutsRef.current.delete(timeoutId);
  }, []);

  /**
   * CRT 노이즈와 글리치 반응을 짧게 켰다가 지정 시간 후 복구한다.
   */
  const setCrtReaction = useCallback((noiseLevel: CrtNoiseLevel, duration: number) => {
    if (noiseResetRef.current) {
      clearTrackedTimeout(noiseResetRef.current);
      noiseResetRef.current = null;
    }

    setCrtNoiseLevel(noiseLevel);
    setGlitchActive(noiseLevel === "strong");

    if (noiseLevel === "off") {
      return;
    }

    noiseResetRef.current = trackTimeout(() => {
      setCrtNoiseLevel("off");
      setGlitchActive(false);
      noiseResetRef.current = null;
    }, duration);
  }, [clearTrackedTimeout, trackTimeout]);

  /**
   * 플레이어 또는 몬스터 스프라이트에 hit-wave 진행률과 스케일을 설정한다.
   */
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

  /**
   * 방어 성공 또는 실드 피격 시 공통 방어 연출을 적용한다.
   */
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
        setCrtReaction(
          outcome === "perfect" ? "off" : "soft",
          outcome === "perfect" ? 0 : 420,
        );
      }
    },
    [projectileSceneAnchors.monsterShield, sceneScatterRef, setCrtReaction, triggerEffect],
  );

  /**
   * 몬스터 피격 시 흔들림, glyph impact, 파티클, 후속 callback 지연 시간을 함께 계산한다.
   */
  const flashMonsterImpact = useCallback(
    (word: string, impactPoint: Point, element?: string, damage = 0, critical = false) => {
      const impactTone = critical ? "critical" : word === "STRIKE" ? "strike" : element;
      const settleDelay = getMonsterImpactSettleDelay(critical);

      setShakeMonster(true);
      trackTimeout(() => setShakeMonster(false), 600);
      startHitWave("monster", 620, damage, monsterMaxHp);
      monsterImpactBandTriggerRef.current?.(impactPoint, damage, critical);
      if (word === "STRIKE") {
        triggerEffect("slash", "monster", 1320);
      } else {
        triggerEffect("spell", "monster", 1640, element);
      }
      triggerEffect("hit", "monster", 920, impactTone);
      spawnImpactBurst(sceneScatterRef.current, impactPoint, "monsterHit", impactTone);
      setHitAbsorbMonster(true);
      trackTimeout(() => setHitAbsorbMonster(false), 620);
      return settleDelay;
    },
    [
      monsterImpactBandTriggerRef,
      monsterMaxHp,
      sceneScatterRef,
      startHitWave,
      trackTimeout,
      triggerEffect,
    ],
  );

  /**
   * 플레이어 피격 시 흔들림, CRT 반응, hit-wave를 함께 적용한다.
   */
  const flashPlayerImpact = useCallback((outcome: "partial" | "full" = "full", damage = 0) => {
    setShakePlayer(true);
    trackTimeout(() => setShakePlayer(false), 600);
    startHitWave("player", outcome === "full" ? 540 : 480, damage, playerMaxHp);
    triggerEffect("hit", "player", 600);
    setHitAbsorbPlayer(true);
    trackTimeout(() => setHitAbsorbPlayer(false), 500);
    consolePulsesRef.current.push({
      color: "red",
      startTime: performance.now(),
      duration: outcome === "full" ? 860 : 620,
      strength: outcome === "full" ? "strong" : "soft",
    });
    setCrtReaction(outcome === "full" ? "strong" : "soft", outcome === "full" ? 620 : 360);
  }, [playerMaxHp, setCrtReaction, startHitWave, trackTimeout, triggerEffect]);

  useEffect(() => {
    projectileCallbackRef.current = (request: CombatAnimationRequest) => {
      if (!request.word) {
        return;
      }

      if (request.fromPlayer) {
        if (request.word === "STRIKE") {
          setLungePlayer(true);
          trackTimeout(() => setLungePlayer(false), 700);
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
        const isChargedPlayerCast =
          request.charged &&
          request.targetSide === "enemy" &&
          !request.missed;
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
          : isChargedPlayerCast
            ? {
                x: projectileSceneAnchors.playerMuzzle.x - SCENE_W * 0.08,
                y: projectileSceneAnchors.playerMuzzle.y + SCENE_H * 0.05,
              }
          : undefined;
        const returnControl = isSelfReturn && returnTurn
          ? {
              x: returnTurn.x + SCENE_W * 0.04,
              y: returnTurn.y + SCENE_H * 0.05,
            }
          : isChargedPlayerCast && returnTurn
            ? {
                x: returnTurn.x - SCENE_W * 0.03,
                y: returnTurn.y - SCENE_H * 0.08,
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

        if (isChargedPlayerCast) {
          triggerEffect("charge", "player", Math.max(460, request.durationMs ?? 1120), request.element);
        }

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
          startTime: performance.now() + (request.delayMs ?? 0),
          duration: request.durationMs ?? (isSelfReturn ? 1180 : isChargedPlayerCast ? 1220 : 920),
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
                flashMonsterImpact(
                  request.word,
                  { x: impactX, y: impactY },
                  request.element,
                  request.impactDamage ?? 0,
                  request.critical,
                );
                request.onImpact?.();
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
    clearTrackedTimeout,
    flashMonsterImpact,
    flashPlayerImpact,
    flashShieldImpact,
    projectileCallbackRef,
    projectileSceneAnchors,
    sceneAnchors,
    sceneScatterRef,
    trackTimeout,
    triggerEffect,
  ]);

  useEffect(() => {
    const playerHitWaveFrame = playerHitWaveFrameRef;
    const monsterHitWaveFrame = monsterHitWaveFrameRef;
    const scheduledTimeouts = scheduledTimeoutsRef.current;

    return () => {
      if (noiseResetRef.current) {
        clearTrackedTimeout(noiseResetRef.current);
      }
      if (playerHitWaveFrame.current) {
        window.cancelAnimationFrame(playerHitWaveFrame.current);
      }
      if (monsterHitWaveFrame.current) {
        window.cancelAnimationFrame(monsterHitWaveFrame.current);
      }
      scheduledTimeouts.forEach(timeoutId => {
        window.clearTimeout(timeoutId);
      });
      scheduledTimeouts.clear();
    };
  }, [clearTrackedTimeout]);

  return {
    consolePulsesRef,
    crtNoiseLevel,
    glitchActive,
    hitAbsorbMonster,
    hitAbsorbPlayer,
    lungePlayer,
    monsterHitWaveProgress,
    monsterHitWaveScale,
    playerHitWaveProgress,
    playerHitWaveScale,
    projectilesRef,
    shakeMonster,
    shakePlayer,
    slashesRef,
  };
}
