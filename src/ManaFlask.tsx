import { useEffect, useRef, useState } from "react";
import ResourceChargeBurst from "./ResourceChargeBurst";

interface ManaFlaskProps {
  current: number;
  max: number;
}

// Cylindrical flask shape (8 rows tall)
const FLASK_MASK = [
  " .---. ",
  " |   | ",
  " |   | ",
  " |   | ",
  " |   | ",
  " |   | ",
  " |   | ",
  " '---' ",
];

const ROWS = FLASK_MASK.length;
const COLS = FLASK_MASK[0].length;
const FILL_CHAR_SURFACE = ["~", "≈"];
const FILL_CHAR_BODY = ["█", "▓", "▒", "░"];
const EMPTY_CHARS = [".", " "];
const FRAME_INTERVAL = 1000 / 24;

export default function ManaFlask({ current, max }: ManaFlaskProps) {
  const [hovered, setHovered] = useState(false);
  const [time, setTime] = useState(0);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const tick = (now: number) => {
      if (now - lastFrameRef.current >= FRAME_INTERVAL) {
        lastFrameRef.current = now;
        setTime((v) => v + 0.08);
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
    for (let col = 0; col < COLS; col += 1) {
      const cell = FLASK_MASK[row][col];

      // Border characters pass through
      if (cell === "." || cell === "-" || cell === "'" || cell === "|") {
        line += cell;
        continue;
      }

      // Space outside the flask
      if (cell === " " && (col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1)) {
        line += " ";
        continue;
      }

      // Interior cells (inside the |...|)
      if (row >= 1 && row <= ROWS - 2 && col >= 2 && col <= COLS - 3) {
        // Map row to fill level (row 1 = top interior, row ROWS-2 = bottom interior)
        const interiorRows = ROWS - 2; // rows 1..6
        const rowInInterior = row - 1; // 0-based from top
        const rowRatio = rowInInterior / (interiorRows - 1);
        const waterLine = 1 - fillRatio;
        const wave =
          Math.sin(col * 0.9 + time * 1.5) * 0.06 +
          Math.sin(col * 1.4 + time * 0.9 + 1.2) * 0.04;
        const adjusted = waterLine + wave;

        if (rowRatio < adjusted) {
          // Empty
          const ei = Math.floor(
            (Math.sin(col * 0.5 + row * 0.3 + time * 0.4) * 0.5 + 0.5) *
              EMPTY_CHARS.length,
          );
          line += EMPTY_CHARS[Math.min(ei, EMPTY_CHARS.length - 1)];
        } else if (rowRatio < adjusted + 0.1) {
          // Surface
          const si = Math.floor(
            (Math.sin(col * 1.1 + time * 2.2) * 0.5 + 0.5) *
              FILL_CHAR_SURFACE.length,
          );
          line += FILL_CHAR_SURFACE[Math.min(si, FILL_CHAR_SURFACE.length - 1)];
        } else {
          // Body
          const depth = (rowRatio - adjusted) / (1 - adjusted);
          const bi = Math.min(
            Math.floor(depth * FILL_CHAR_BODY.length),
            FILL_CHAR_BODY.length - 1,
          );
          const shimmer =
            Math.sin(col * 1.3 + row * 0.8 + time * 1.6) > 0.7;
          line +=
            shimmer && bi < FILL_CHAR_BODY.length - 1
              ? FILL_CHAR_BODY[bi + 1]
              : FILL_CHAR_BODY[bi];
        }
      } else {
        line += " ";
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
      <ResourceChargeBurst triggerValue={current} width={74} height={88} particleCount={26} tone="mana" />
      <pre className="m-0 whitespace-pre text-[9px] leading-[1.1] text-[rgba(60,140,255,0.85)] select-none [text-shadow:0_0_4px_rgba(40,100,220,0.3)]">
        {lines.join("\n")}
      </pre>
      <span
        className={`pointer-events-none absolute left-1/2 top-[calc(100%+0.45rem)] -translate-x-1/2 whitespace-nowrap text-[0.62rem] uppercase tracking-[0.08em] text-[rgba(60,140,255,0.82)] transition-opacity duration-300 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
      >
        mp {current}/{max}
      </span>
    </div>
  );
}
