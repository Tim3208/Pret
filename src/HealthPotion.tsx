import { useEffect, useRef, useState } from "react";

const POTION_MASK = [
  "    .-.    ",
  "   /###\\   ",
  "   |###|   ",
  "   |###|   ",
  "  /#####\\  ",
  " /#######\\ ",
  "|#########|",
  "|#########|",
  "|#########|",
  " \\#######/ ",
  "  \\#####/  ",
  "   '---'   ",
];

const ROWS = POTION_MASK.length;
const COLS = POTION_MASK[0].length;
const FILL_CHAR_SURFACE = ["~", "≈"];
const FILL_CHAR_BODY = ["█", "▓", "▒", "░"];
const EMPTY_CHARS = [".", " "];
const FRAME_INTERVAL = 1000 / 24;
// Keep the neck clear so the liquid reads as sitting in the round bottle body.
const LIQUID_START_ROW = 4;

export default function HealthPotion() {
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

  const fillRatio = 0.82;
  const frameLines: string[] = [];
  const emptyLines: string[] = [];
  const fillLines: string[] = [];

  for (let row = 0; row < ROWS; row += 1) {
    let frameLine = "";
    let emptyLine = "";
    let fillLine = "";

    for (let col = 0; col < COLS; col += 1) {
      const cell = POTION_MASK[row][col];

      if (
        cell === "." ||
        cell === "-" ||
        cell === "'" ||
        cell === "|" ||
        cell === "/" ||
        cell === "\\"
      ) {
        frameLine += cell;
        emptyLine += " ";
        fillLine += " ";
        continue;
      }

      frameLine += " ";

      if (cell === "#") {
        if (row < LIQUID_START_ROW) {
          const emptyIndex = Math.floor(
            (Math.sin(col * 0.42 + row * 0.25 + time * 0.32) * 0.5 + 0.5) * EMPTY_CHARS.length,
          );
          emptyLine += EMPTY_CHARS[Math.min(emptyIndex, EMPTY_CHARS.length - 1)];
          fillLine += " ";
        } else {
          const liquidRows = ROWS - LIQUID_START_ROW - 1;
          const rowInLiquid = row - LIQUID_START_ROW;
          const rowRatio = rowInLiquid / Math.max(1, liquidRows);
          const liquidLine = 1 - fillRatio;
          const wave =
            Math.sin(col * 0.82 + time * 1.34) * 0.05 +
            Math.sin(col * 1.18 + time * 0.86 + 1.1) * 0.035;
          const adjustedLine = liquidLine + wave;

          if (rowRatio < adjustedLine) {
            const emptyIndex = Math.floor(
              (Math.sin(col * 0.48 + row * 0.3 + time * 0.36) * 0.5 + 0.5) * EMPTY_CHARS.length,
            );
            emptyLine += EMPTY_CHARS[Math.min(emptyIndex, EMPTY_CHARS.length - 1)];
            fillLine += " ";
          } else if (rowRatio < adjustedLine + 0.1) {
            const surfaceIndex = Math.floor(
              (Math.sin(col * 1.05 + time * 1.92) * 0.5 + 0.5) * FILL_CHAR_SURFACE.length,
            );
            emptyLine += " ";
            fillLine += FILL_CHAR_SURFACE[Math.min(surfaceIndex, FILL_CHAR_SURFACE.length - 1)];
          } else {
            const depth = (rowRatio - adjustedLine) / Math.max(0.0001, 1 - adjustedLine);
            const bodyIndex = Math.min(
              Math.floor(depth * FILL_CHAR_BODY.length),
              FILL_CHAR_BODY.length - 1,
            );
            const shimmer = Math.sin(col * 1.2 + row * 0.76 + time * 1.55) > 0.72;
            emptyLine += " ";
            fillLine += shimmer && bodyIndex < FILL_CHAR_BODY.length - 1
              ? FILL_CHAR_BODY[bodyIndex + 1]
              : FILL_CHAR_BODY[bodyIndex];
          }
        }
      } else {
        emptyLine += " ";
        fillLine += " ";
      }
    }

    frameLines.push(frameLine);
    emptyLines.push(emptyLine);
    fillLines.push(fillLine);
  }

  return (
    <div className="relative inline-flex select-none items-start justify-center">
      <pre className="m-0 whitespace-pre text-[8px] leading-[0.95] text-[rgba(236,240,246,0.9)] [text-shadow:0_0_5px_rgba(255,255,255,0.18)]">
        {frameLines.join("\n")}
      </pre>
      <pre className="pointer-events-none absolute inset-0 m-0 whitespace-pre text-[8px] leading-[0.95] text-[rgba(228,232,240,0.16)]">
        {emptyLines.join("\n")}
      </pre>
      <pre className="pointer-events-none absolute inset-0 m-0 whitespace-pre text-[8px] leading-[0.95] text-[rgba(228,52,62,0.96)] [text-shadow:0_0_8px_rgba(192,24,44,0.34)]">
        {fillLines.join("\n")}
      </pre>
    </div>
  );
}