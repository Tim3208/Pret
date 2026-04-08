import { useState, useEffect, useRef } from "react";

interface HeartHPProps {
  current: number;
  max: number; // 24
}

// Heart shape mask (9 wide × 8 tall)  # = inside, · = border
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

// Characters for water surface / body (light → dense)
const WATER_SURFACE = ["~", "≈"];
const WATER_BODY = ["░", "▒", "▓", "█"];
const EMPTY_CHARS = ["·", " "];

const FRAME_INTERVAL = 1000 / 128; // 24fps

export default function HeartHP({ current, max }: HeartHPProps) {
  const [hovered, setHovered] = useState(false);
  const [, setTick] = useState(0);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    function tick(now: number) {
      if (now - lastFrameRef.current >= FRAME_INTERVAL) {
        lastFrameRef.current = now;
        timeRef.current += 0.08;
        setTick((f) => f + 1);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const fillRatio = Math.max(0, Math.min(1, current / max));
  const t = timeRef.current;

  // Build the ASCII grid
  const lines: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let line = "";
    for (let c = 0; c < COLS; c++) {
      const cell = HEART_MASK[r][c];
      if (cell !== "#" && cell !== ".") {
        line += " ";
        continue;
      }
      if (cell === ".") {
        line += "·";
        continue;
      }

      // Inside heart — determine if water or empty
      const rowRatio = r / (ROWS - 1); // 0 at top, 1 at bottom
      const waterLine = 1 - fillRatio; // 0 = full, 1 = empty

      // Wave offset at this column
      const wave =
        Math.sin(c * 0.7 + t * 1.3) * 0.06 +
        Math.sin(c * 1.2 + t * 0.8 + 1.5) * 0.03;
      const adjustedWaterLine = waterLine + wave;

      if (rowRatio < adjustedWaterLine) {
        // Above water — empty
        const ei = Math.floor(
          (Math.sin(c * 0.5 + r * 0.3 + t * 0.4) * 0.5 + 0.5) *
            EMPTY_CHARS.length
        );
        line += EMPTY_CHARS[Math.min(ei, EMPTY_CHARS.length - 1)];
      } else if (rowRatio < adjustedWaterLine + 0.08) {
        // Surface
        const si = Math.floor(
          (Math.sin(c * 0.9 + t * 2) * 0.5 + 0.5) * WATER_SURFACE.length
        );
        line += WATER_SURFACE[Math.min(si, WATER_SURFACE.length - 1)];
      } else {
        // Below surface — water body
        const depth = (rowRatio - adjustedWaterLine) / (1 - adjustedWaterLine);
        const bi = Math.min(
          Math.floor(depth * WATER_BODY.length),
          WATER_BODY.length - 1
        );
        const shimmer = Math.sin(c * 1.1 + r * 0.7 + t * 1.5) > 0.7;
        line +=
          shimmer && bi < WATER_BODY.length - 1
            ? WATER_BODY[bi + 1]
            : WATER_BODY[bi];
      }
    }
    lines.push(line);
  }

  return (
    <div
      className="heart-hp-ascii"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <pre className="heart-pre">{lines.join("\n")}</pre>
      <span className={`heart-hp-number ${hovered ? "visible" : ""}`}>
        {current}/{max}
      </span>
    </div>
  );
}
