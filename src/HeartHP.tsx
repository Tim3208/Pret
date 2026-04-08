import { useEffect, useRef, useState } from "react";

interface HeartHPProps {
  current: number;
  max: number;
}

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

const ROWS = HEART_MASK.length;
const COLS = HEART_MASK[0].length;
const WATER_SURFACE = ["~", "-"];
const WATER_BODY = ["=", "+", "*", "#"];
const EMPTY_CHARS = [".", " "];
const FRAME_INTERVAL = 1000 / 24;

export default function HeartHP({ current, max }: HeartHPProps) {
  const [hovered, setHovered] = useState(false);
  const [time, setTime] = useState(0);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
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

  const fillRatio = Math.max(0, Math.min(1, current / max));
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

  return (
    <div
      className="relative inline-flex cursor-default flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <pre className="m-0 whitespace-pre text-[9px] leading-[1.1] text-heart select-none [text-shadow:0_0_4px_rgba(200,40,50,0.3)]">
        {lines.join("\n")}
      </pre>
      <span
        className={`pointer-events-none absolute right-[-2.8rem] top-1/2 -translate-y-1/2 whitespace-nowrap text-[0.65rem] text-[rgba(200,60,60,0.8)] transition-opacity duration-300 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
      >
        {current}/{max}
      </span>
    </div>
  );
}
