import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type MonsterAsciiCanvasMetrics,
  type ProjectileSceneAnchors,
  SCENE_H,
  SCENE_W,
  clamp01,
} from "../lib/core";
import {
  buildHitWaveTextStyle,
  buildMonsterAsciiGlyphs,
  getMonsterImpactBandDuration,
} from "../lib/visuals";
import type {
  MonsterAsciiImpactState,
  MonsterAsciiRenderState,
  Point,
} from "./battleStageScene.types";

interface UseMonsterAsciiPresentationParams {
  /** 몬스터 ASCII 원본 라인 */
  monsterAscii: string[];
  /** 몬스터 최대 체력 */
  monsterMaxHp: number;
  /** 현재 몬스터 체력 */
  monsterHp: number;
  /** 몬스터 hit absorb 애니메이션 여부 */
  hitAbsorbMonster: boolean;
  /** 몬스터 hit wave 진행도 */
  monsterHitWaveProgress: number | null;
  /** 몬스터 hit wave 스케일 */
  monsterHitWaveScale: number;
  /** 투사체/방패 기준 장면 앵커 */
  projectileSceneAnchors: ProjectileSceneAnchors;
  /** 장면 FX 캔버스 ref */
  sceneFxCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** 몬스터 흔들림 애니메이션 여부 */
  shakeMonster: boolean;
}

/**
 * 몬스터 ASCII 스프라이트의 tone, metric, impact canvas 상태를 관리한다.
 * 전투 장면 전체 오케스트레이션은 상위 위젯에 남기고, 몬스터 스프라이트 전용 보조 로직만 분리한다.
 *
 * @param params 몬스터 ASCII 표현 계산에 필요한 상태
 */
export function useMonsterAsciiPresentation({
  monsterAscii,
  monsterMaxHp,
  monsterHp,
  hitAbsorbMonster,
  monsterHitWaveProgress,
  monsterHitWaveScale,
  projectileSceneAnchors,
  sceneFxCanvasRef,
  shakeMonster,
}: UseMonsterAsciiPresentationParams) {
  const [monsterImpactCanvasActive, setMonsterImpactCanvasActive] = useState(false);
  const monsterAsciiCanvasRef = useRef<HTMLCanvasElement>(null);
  const monsterAsciiPreRef = useRef<HTMLPreElement>(null);
  const monsterAsciiMetricsRef = useRef<MonsterAsciiCanvasMetrics | null>(null);
  const monsterImpactRef = useRef<MonsterAsciiImpactState | null>(null);
  const monsterImpactVisualTimeoutRef = useRef<number | null>(null);
  const monsterAsciiText = useMemo(() => monsterAscii.join("\n"), [monsterAscii]);
  const monsterAsciiGlyphs = useMemo(
    () => buildMonsterAsciiGlyphs(monsterAscii),
    [monsterAscii],
  );
  const monsterTone = useMemo(() => {
    const hpRatio = monsterMaxHp > 0 ? monsterHp / monsterMaxHp : 1;
    if (hpRatio > 0.75) {
      return "rgba(224, 224, 224, 0.9)";
    }
    if (hpRatio > 0.5) {
      return "rgba(198, 198, 198, 0.86)";
    }
    if (hpRatio > 0.25) {
      return "rgba(168, 168, 168, 0.84)";
    }
    return "rgba(146, 146, 146, 0.88)";
  }, [monsterHp, monsterMaxHp]);
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
  const monsterAsciiRenderRef = useRef<MonsterAsciiRenderState>({
    glyphs: monsterAsciiGlyphs,
    tone: monsterTone,
  });

  useEffect(() => {
    monsterAsciiRenderRef.current = {
      glyphs: monsterAsciiGlyphs,
      tone: monsterTone,
    };
  }, [monsterAsciiGlyphs, monsterTone]);

  const syncMonsterAsciiCanvasMetrics = useCallback(() => {
    const canvas = monsterAsciiCanvasRef.current;
    const pre = monsterAsciiPreRef.current;
    if (!canvas || !pre) {
      return;
    }

    const rect = pre.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }

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
    if (!ctx) {
      return;
    }

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

  useEffect(() => {
    return () => {
      if (monsterImpactVisualTimeoutRef.current) {
        window.clearTimeout(monsterImpactVisualTimeoutRef.current);
      }
    };
  }, []);

  const triggerMonsterImpactBand = useCallback(
    (impactPoint: Point, damage: number, critical = false) => {
      const duration = getMonsterImpactBandDuration(critical);
      const normalizedDamage = clamp01(damage / Math.max(1, monsterMaxHp));
      const strength = Math.min(
        2.2,
        1.26 + normalizedDamage * 1.62 + (critical ? 0.38 : 0),
      );
      const radiusRatio = Math.min(
        0.34,
        0.19 + normalizedDamage * 0.12 + (critical ? 0.05 : 0),
      );
      const sceneRect = sceneFxCanvasRef.current?.getBoundingClientRect();
      const spriteRect = monsterAsciiPreRef.current?.getBoundingClientRect();
      const hasValidRects =
        !!sceneRect &&
        !!spriteRect &&
        sceneRect.width > 0 &&
        sceneRect.height > 0 &&
        spriteRect.width > 0 &&
        spriteRect.height > 0;
      const centerRatio = hasValidRects
        ? clamp01(
            ((sceneRect.top + (impactPoint.y / SCENE_H) * sceneRect.height) -
              spriteRect.top) /
              spriteRect.height,
          )
        : clamp01((impactPoint.y - SCENE_H * 0.045) / (SCENE_H * 0.72));
      const columnRatio = hasValidRects
        ? clamp01(
            ((sceneRect.left + (impactPoint.x / SCENE_W) * sceneRect.width) -
              spriteRect.left) /
              spriteRect.width,
          )
        : clamp01(
            (impactPoint.x -
              (projectileSceneAnchors.monsterShield.x -
                (projectileSceneAnchors.monsterCore.x -
                  projectileSceneAnchors.monsterShield.x) *
                  0.58)) /
              Math.max(
                1,
                (projectileSceneAnchors.monsterCore.x -
                  projectileSceneAnchors.monsterShield.x) *
                  2.5,
              ),
          );
      const direction: -1 | 1 =
        impactPoint.x <= projectileSceneAnchors.monsterCore.x ? 1 : -1;

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
    },
    [
      monsterMaxHp,
      projectileSceneAnchors.monsterCore.x,
      projectileSceneAnchors.monsterShield.x,
      sceneFxCanvasRef,
    ],
  );

  return {
    monsterAsciiCanvasActive: monsterImpactCanvasActive,
    monsterAsciiCanvasRef,
    monsterAsciiClassName,
    monsterAsciiMetricsRef,
    monsterAsciiPreRef,
    monsterAsciiRenderRef,
    monsterAsciiStyle,
    monsterAsciiText,
    monsterImpactRef,
    triggerMonsterImpactBand,
  };
}
