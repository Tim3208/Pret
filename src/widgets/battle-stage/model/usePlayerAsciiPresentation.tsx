import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { EquipmentDefinition } from "@/entities/equipment";
import {
  type LiveAsciiDisplacementState,
  type MonsterAsciiCanvasMetrics,
} from "../lib/core";
import type { PlayerAsciiRenderState } from "./battleStageScene.types";
import { buildHitWaveTextStyle, buildMonsterAsciiGlyphs } from "../lib/visuals";

interface UsePlayerAsciiPresentationParams {
  /** 플레이어 ASCII 원본 라인 */
  playerAscii: string[];
  /** 플레이어 ASCII DOM ref */
  playerAsciiPreRef: RefObject<HTMLPreElement | null>;
  /** 플레이어 ASCII 전체 본문 */
  playerAsciiText: string;
  /** 현재 장착 중인 장비 목록 */
  equippedItems: EquipmentDefinition[];
  /** 히트 흡수 애니메이션 여부 */
  hitAbsorbPlayer: boolean;
  /** 플레이어 hit wave 진행도 */
  playerHitWaveProgress: number | null;
  /** 플레이어 hit wave 스케일 */
  playerHitWaveScale: number;
  /** 플레이어 흔들림 애니메이션 여부 */
  shakePlayer: boolean;
  /** 포션 hover 중 발생하는 실시간 ASCII 왜곡 정보 */
  potionHoverDisplacement: LiveAsciiDisplacementState | null;
}

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

/**
 * 플레이어 ASCII 스프라이트의 색상 조합, canvas metric 동기화, 렌더 참조값을 관리한다.
 * 전투 장면 전체 상태와 RAF 루프는 상위 위젯에 남기고, 플레이어 스프라이트 전용 보조 로직만 분리한다.
 *
 * @param params 플레이어 ASCII 표현 계산에 필요한 상태
 */
export function usePlayerAsciiPresentation({
  playerAscii,
  playerAsciiPreRef,
  playerAsciiText,
  equippedItems,
  hitAbsorbPlayer,
  playerHitWaveProgress,
  playerHitWaveScale,
  shakePlayer,
  potionHoverDisplacement,
}: UsePlayerAsciiPresentationParams) {
  const playerAsciiCanvasRef = useRef<HTMLCanvasElement>(null);
  const playerAsciiMetricsRef = useRef<MonsterAsciiCanvasMetrics | null>(null);
  const playerPotionDisplacementRef = useRef<LiveAsciiDisplacementState | null>(null);
  const playerGlyphColorMap = useMemo(
    () => buildEquipmentGlyphColorMap(playerAscii, equippedItems),
    [equippedItems, playerAscii],
  );
  const playerAsciiGlyphs = useMemo(() => buildMonsterAsciiGlyphs(playerAscii), [playerAscii]);
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
  const playerAsciiClassName = `m-0 whitespace-pre text-[8.8px] leading-[9px] select-none sm:text-[10px] sm:leading-[10.2px] lg:text-[11.8px] lg:leading-[12px] ${
    hitAbsorbPlayer ? "animate-hit-absorb" : ""
  }`;
  const playerAsciiRenderRef = useRef<PlayerAsciiRenderState>({
    glyphs: playerAsciiGlyphs,
    glyphColors: playerGlyphColorMap,
  });

  useEffect(() => {
    playerPotionDisplacementRef.current = potionHoverDisplacement;
  }, [potionHoverDisplacement]);

  useEffect(() => {
    playerAsciiRenderRef.current = {
      glyphs: playerAsciiGlyphs,
      glyphColors: playerGlyphColorMap,
    };
  }, [playerAsciiGlyphs, playerGlyphColorMap]);

  const syncPlayerAsciiCanvasMetrics = useCallback(() => {
    const canvas = playerAsciiCanvasRef.current;
    const pre = playerAsciiPreRef.current;
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
    const fontSize = parseFloat(styles.fontSize) || 12;
    const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.05;
    const font = `${styles.fontWeight} ${fontSize}px ${styles.fontFamily}`;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

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
  }, [playerAsciiPreRef]);

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
  }, [playerAsciiPreRef, playerAsciiText, syncPlayerAsciiCanvasMetrics]);

  return {
    playerAsciiCanvasActive: potionHoverDisplacement !== null,
    playerAsciiCanvasRef,
    playerAsciiClassName,
    playerAsciiMarkup,
    playerAsciiMetricsRef,
    playerAsciiRenderRef,
    playerAsciiStyle,
    playerPotionDisplacementRef,
  };
}
