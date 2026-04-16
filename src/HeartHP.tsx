import { useEffect, useRef, useState } from "react";
import ResourceChargeBurst from "./ResourceChargeBurst";

/**
 * 하트 HP 컴포넌트가 받는 현재/최대 체력 값이다.
 */
interface HeartHPProps {
  current: number;
  max: number;
  shield?: number;
  label: string;
  shieldLabel: string;
}

/**
 * 하트 외곽선과 내부 영역을 정의하는 ASCII 마스크다.
 */
const HEART_MASK = [
  " .#. .#. ",
  ".#####.#.",
  ".#######.",
  ".#######.",
  " .#####. ",
  "  .###.  ",
  "   .#.   ",
  "    .    ",
];

/**
 * 하트 마스크의 총 행 수다.
 */
const ROWS = HEART_MASK.length;
/**
 * 하트 마스크의 총 열 수다.
 */
const COLS = HEART_MASK[0].length;
/**
 * 수면 경계에서 사용할 문자 목록이다.
 */
const WATER_SURFACE = ["~", "≈"];
/**
 * 하트 내부를 채우는 물결 밀도 문자 목록이다.
 */
const WATER_BODY = ["█", "▓", "▒", "░"];
/**
 * 비어 있는 공간을 표현할 문자 목록이다.
 */
const EMPTY_CHARS = [".", " "];
/**
 * 하트 애니메이션 갱신 간격이다.
 */
const FRAME_INTERVAL = 1000 / 24;

/**
 * 체력 비율을 물결치는 ASCII 하트로 표현하는 컴포넌트다.
 *
 * @param props 현재 체력과 최대 체력
 */
export default function HeartHP({
  current,
  max,
  shield = 0,
  label,
  shieldLabel,
}: HeartHPProps) {
  /**
   * 마우스 hover 여부를 저장한다.
   */
  const [hovered, setHovered] = useState(false);
  /**
   * 물결 애니메이션 진행 시간을 저장한다.
   */
  const [time, setTime] = useState(0);
  /**
   * requestAnimationFrame ID를 저장한다.
   */
  const rafRef = useRef<number>(0);
  /**
   * 이전 프레임 타임스탬프를 저장한다.
   */
  const lastFrameRef = useRef(0);

  useEffect(() => {
    /**
     * 일정 간격으로 시간값을 증가시켜 파도 애니메이션을 만든다.
     *
     * @param now 현재 프레임 타임스탬프
     */
    const tick = (now: number) => {
      if (now - lastFrameRef.current >= FRAME_INTERVAL) {
        lastFrameRef.current = now;
        setTime((value) => value + 0.08);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  /**
   * 현재 체력을 0~1 범위의 비율로 정규화한 값이다.
   */
  const fillRatio = Math.max(0, Math.min(1, current / max));
  /**
   * 최종적으로 렌더링할 ASCII 하트 줄 목록이다.
   */
  const lines: string[] = [];

  for (let row = 0; row < ROWS; row += 1) {
    let line = "";

    for (let column = 0; column < COLS; column += 1) {
      const cell = HEART_MASK[row][column];

      if (cell !== "#" && cell !== ".") {
        line += " ";
        continue;
      }

      if (cell === ".") {
        line += ".";
        continue;
      }

      const rowRatio = row / (ROWS - 1);
      const waterLine = 1 - fillRatio;
      const wave =
        Math.sin(column * 0.7 + time * 1.3) * 0.06 +
        Math.sin(column * 1.2 + time * 0.8 + 1.5) * 0.03;
      const adjustedWaterLine = waterLine + wave;

      if (rowRatio < adjustedWaterLine) {
        const emptyIndex = Math.floor(
          (Math.sin(column * 0.5 + row * 0.3 + time * 0.4) * 0.5 + 0.5) *
            EMPTY_CHARS.length
        );
        line += EMPTY_CHARS[Math.min(emptyIndex, EMPTY_CHARS.length - 1)];
      } else if (rowRatio < adjustedWaterLine + 0.08) {
        const surfaceIndex = Math.floor(
          (Math.sin(column * 0.9 + time * 2) * 0.5 + 0.5) * WATER_SURFACE.length
        );
        line += WATER_SURFACE[Math.min(surfaceIndex, WATER_SURFACE.length - 1)];
      } else {
        const depth = (rowRatio - adjustedWaterLine) / (1 - adjustedWaterLine);
        const bodyIndex = Math.min(
          Math.floor(depth * WATER_BODY.length),
          WATER_BODY.length - 1
        );
        const shimmer = Math.sin(column * 1.1 + row * 0.7 + time * 1.5) > 0.7;
        line += shimmer && bodyIndex < WATER_BODY.length - 1
          ? WATER_BODY[bodyIndex + 1]
          : WATER_BODY[bodyIndex];
      }
    }

    lines.push(line);
  }

  const shieldActive = shield > 0;

  // Build bracket overlay lines when shield is active
  const bracketLines: string[] = [];
  if (shieldActive) {
    // Surround heart with [ ] brackets that pulse via CSS
    const bracketMask = [
      "[ .#. .#. ]",
      "[.#####.#.]",
      "[.#######.]",
      "[.#######.]",
      "[ .#####. ]",
      "[  .###.  ]",
      "[   .#.   ]",
      "[    .    ]",
    ];
    for (let row = 0; row < bracketMask.length; row += 1) {
      let line = "";
      for (let col = 0; col < bracketMask[row].length; col += 1) {
        const ch = bracketMask[row][col];
        if (ch === "[" || ch === "]") {
          line += ch;
        } else {
          line += " ";
        }
      }
      bracketLines.push(line);
    }
  }

  return (
    <div
      className="relative inline-flex cursor-default flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ResourceChargeBurst triggerValue={current} width={82} height={88} particleCount={28} tone="health" />
      <pre className={`m-0 whitespace-pre text-[9px] leading-[1.1] text-heart select-none [text-shadow:0_0_4px_rgba(200,40,50,0.3)] ${shieldActive ? "[text-shadow:0_0_6px_rgba(60,140,255,0.4)]" : ""}`}>
        {lines.join("\n")}
      </pre>
      {shieldActive && (
        <pre className="pointer-events-none absolute inset-0 m-0 whitespace-pre text-[9px] leading-[1.1] text-[rgba(60,160,255,0.8)] select-none animate-shield-pulse [text-shadow:0_0_8px_rgba(60,140,255,0.5)]">
          {bracketLines.join("\n")}
        </pre>
      )}
      <span
        className={`pointer-events-none absolute left-1/2 top-[calc(100%+0.45rem)] -translate-x-1/2 whitespace-nowrap text-[0.62rem] uppercase tracking-[0.08em] text-[rgba(200,60,60,0.82)] transition-opacity duration-300 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
      >
        {label} {current}/{max}{shield > 0 ? ` +${shield} ${shieldLabel}` : ""}
      </span>
    </div>
  );
}
