import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type ProjectileSceneAnchors,
  SCENE_H,
  SCENE_W,
  type SceneAnchors,
} from "../lib/core";
import {
  spawnChargeParticles,
  spawnDefendParticles,
  spawnHealParticles,
  spawnHitParticles,
  spawnImpactBurst,
  spawnMonsterDefendParticles,
  spawnShieldChargeParticles,
  spawnSlashParticles,
  spawnSpellParticles,
} from "../lib/visuals";
import type {
  EffectParticle,
  ForceField,
  SpriteEffect,
} from "./battleStageScene.types";

interface UseBattleStageEffectsParams {
  monsterHp: number;
  monsterOverlayRef: RefObject<HTMLCanvasElement | null>;
  monsterShield: number;
  playerHp: number;
  playerOverlayRef: RefObject<HTMLCanvasElement | null>;
  playerShield: number;
  projectileSceneAnchors: ProjectileSceneAnchors;
  sceneAnchors: SceneAnchors;
  sceneScatterRef: MutableRefObject<EffectParticle[]>;
}

/**
 * 전투 스테이지의 보조 이펙트 상태를 관리한다.
 * 힐 감지, 실드 지속 연출, 몬스터 사망 지연, 스프라이트 이펙트 등록을 한곳으로 모아
 * 화면 컴포넌트가 조합과 이벤트 연결에 더 집중하도록 돕는다.
 */
export function useBattleStageEffects({
  monsterHp,
  monsterOverlayRef,
  monsterShield,
  playerHp,
  playerOverlayRef,
  playerShield,
  projectileSceneAnchors,
  sceneAnchors,
  sceneScatterRef,
}: UseBattleStageEffectsParams) {
  const [monsterDying, setMonsterDying] = useState(false);
  const effectsRef = useRef<SpriteEffect[]>([]);
  const forceFieldsRef = useRef<ForceField[]>([]);
  const prevPlayerHpRef = useRef(playerHp);
  const prevPlayerShieldRef = useRef(playerShield);
  const prevMonsterHpRef = useRef(monsterHp);
  const prevMonsterShieldRef = useRef(monsterShield);
  const shieldForceFieldRef = useRef<ForceField | null>(null);
  const monsterShieldForceFieldRef = useRef<ForceField | null>(null);
  const monsterDeathFiredRef = useRef(false);
  const monsterDeathTimerRef = useRef<number>(0);

  /**
   * 대상 오버레이 캔버스에 단발성 또는 지속형 이펙트를 등록한다.
   */
  const triggerEffect = useCallback(
    (
      type: SpriteEffect["type"],
      target: "player" | "monster",
      duration: number,
      element?: string,
    ) => {
      const overlayRef = target === "player" ? playerOverlayRef : monsterOverlayRef;
      const canvas = overlayRef.current;
      const width = canvas?.width ?? 200;
      const height = canvas?.height ?? 200;

      let particles: EffectParticle[];
      let persistent = false;
      switch (type) {
        case "heal":
          particles = spawnHealParticles(width, height);
          break;
        case "slash":
          particles = spawnSlashParticles(width, height);
          break;
        case "defend":
          particles = spawnDefendParticles(width, height);
          break;
        case "spell":
          particles = spawnSpellParticles(width, height, element);
          break;
        case "charge":
          particles = spawnChargeParticles(width, height);
          persistent = true;
          break;
        case "shieldCharge":
          particles = spawnShieldChargeParticles(width, height);
          persistent = true;
          break;
        case "hit":
          particles = spawnHitParticles(width, height, element);
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
    [monsterOverlayRef, playerOverlayRef],
  );

  useEffect(() => {
    if (playerHp > prevPlayerHpRef.current) {
      triggerEffect("heal", "player", 2400);
    }
    prevPlayerHpRef.current = playerHp;
  }, [playerHp, triggerEffect]);

  useEffect(() => {
    if (playerShield > 0 && prevPlayerShieldRef.current === 0) {
      const canvas = playerOverlayRef.current;
      const width = canvas?.width ?? 200;
      const height = canvas?.height ?? 200;
      effectsRef.current.push({
        type: "defend",
        target: "player",
        startTime: performance.now(),
        duration: 999999,
        particles: spawnDefendParticles(width, height),
        persistent: true,
      });
      const forceField: ForceField = {
        x: sceneAnchors.playerShield.center.x,
        y: sceneAnchors.playerShield.center.y,
        radius: 120,
        strength: 1.2,
        startTime: performance.now(),
        duration: 999999,
      };
      forceFieldsRef.current.push(forceField);
      shieldForceFieldRef.current = forceField;
    }

    if (playerShield === 0 && prevPlayerShieldRef.current > 0) {
      spawnImpactBurst(
        sceneScatterRef.current,
        { x: SCENE_W * 0.35, y: SCENE_H * 0.49 },
        "shieldBreak",
      );

      effectsRef.current = effectsRef.current.filter(
        effect => !(effect.type === "defend" && effect.target === "player"),
      );
      if (shieldForceFieldRef.current) {
        forceFieldsRef.current = forceFieldsRef.current.filter(
          forceField => forceField !== shieldForceFieldRef.current,
        );
        shieldForceFieldRef.current = null;
      }
    }

    prevPlayerShieldRef.current = playerShield;
  }, [
    playerOverlayRef,
    playerShield,
    sceneAnchors.playerShield.center.x,
    sceneAnchors.playerShield.center.y,
    sceneScatterRef,
  ]);

  useEffect(() => {
    if (monsterShield > 0 && prevMonsterShieldRef.current === 0) {
      const canvas = monsterOverlayRef.current;
      const width = canvas?.width ?? 200;
      const height = canvas?.height ?? 200;
      effectsRef.current.push({
        type: "defend",
        target: "monster",
        startTime: performance.now(),
        duration: 999999,
        particles: spawnMonsterDefendParticles(width, height),
        persistent: true,
      });
      const forceField: ForceField = {
        x: sceneAnchors.monsterShield.center.x,
        y: sceneAnchors.monsterShield.center.y,
        radius: 120,
        strength: -1.2,
        startTime: performance.now(),
        duration: 999999,
      };
      forceFieldsRef.current.push(forceField);
      monsterShieldForceFieldRef.current = forceField;
    }

    if (monsterShield === 0 && prevMonsterShieldRef.current > 0) {
      spawnImpactBurst(
        sceneScatterRef.current,
        projectileSceneAnchors.monsterShield,
        "shieldBreak",
      );

      effectsRef.current = effectsRef.current.filter(
        effect => !(effect.type === "defend" && effect.target === "monster"),
      );
      if (monsterShieldForceFieldRef.current) {
        forceFieldsRef.current = forceFieldsRef.current.filter(
          forceField => forceField !== monsterShieldForceFieldRef.current,
        );
        monsterShieldForceFieldRef.current = null;
      }
    }

    prevMonsterShieldRef.current = monsterShield;
  }, [
    monsterOverlayRef,
    monsterShield,
    projectileSceneAnchors.monsterShield,
    sceneAnchors.monsterShield.center.x,
    sceneAnchors.monsterShield.center.y,
    sceneScatterRef,
  ]);

  useEffect(() => {
    if (monsterHp <= 0 && prevMonsterHpRef.current > 0 && !monsterDeathFiredRef.current) {
      monsterDeathFiredRef.current = true;
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

  useEffect(() => {
    return () => {
      if (monsterDeathTimerRef.current) {
        window.clearTimeout(monsterDeathTimerRef.current);
      }
    };
  }, []);

  return {
    effectsRef,
    forceFieldsRef,
    monsterDying,
    triggerEffect,
  };
}
