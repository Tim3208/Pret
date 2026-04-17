import { useEffect, useRef, useState } from "react";

interface LexiconBookProps {
  open: boolean;
}

export const LEXICON_BOOK_WIDTH = 208;
export const LEXICON_BOOK_HEIGHT = 130;

const BOOK_TEMPLATE = [
  "                   _________________________",
  "              _.-'__#####################__`-._",
  "          _.-'_.-'##|#####################|##`-._`-._",
  "       .-'_.-'####|##|====@@@@@@@========|##|####`-._`-.",
  "     .'_.-'######|##|===@@+***+@@=======|##|######`-._`.",
  "    /_.-'########|##|==@@**+++**@@======|##|########`-._\\",
  "   /#############|##|==@@*++*++*@@======|##|======########\\",
  "  |##############|##|==@@**+++**@@======|##|======########|>",
  "  |#####|o|######|##|===@@+***+@@=======|##|======##|o|####|/",
  "  |#####|o|######|##|====@@@@@@@========|##|======##|o|####|",
  "  |#####|o|######|##|___________________|##|======##|o|####|",
  "  |##############|##|===================|##|======##########|",
  "   \\##############\\_____________________/======###########/",
  "    `-._###########==============================########_.-'",
  "        `-._#######==========================_.-'",
  "            `--.._______________________..--'",
];

const SHADOW_LINES = BOOK_TEMPLATE.map((line) => line.replace(/\S/g, (character) => character));
const LEATHER_CHARS = ["#", "%", "&"];
const PAGE_CHARS = ["=", ":", "-"];
const PAGE_GLOW_CHARS = ["=", "=", ":"];
const MARKER_CHARS = new Set(["#", "=", "@", "*", "+", "o", "|"]);

const FRAME_INTERVAL = 1000 / 18;

function buildLayerLines(
  matcher: (character: string) => boolean,
  mapper: (character: string, row: number, column: number) => string,
): string[] {
  return BOOK_TEMPLATE.map((line, row) => {
    let nextLine = "";
    for (let column = 0; column < line.length; column += 1) {
      const character = line[column];
      if (!matcher(character)) {
        nextLine += " ";
        continue;
      }

      nextLine += mapper(character, row, column);
    }
    return nextLine;
  });
}

function buildLeatherLines(time: number): string[] {
  return buildLayerLines(
    (character) => character === "#",
    (_character, row, column) => {
      const shimmer = Math.sin(row * 0.88 + column * 0.41 + time * 0.76) * 0.5 + 0.5;
      const index = Math.min(LEATHER_CHARS.length - 1, Math.floor(shimmer * LEATHER_CHARS.length));
      return LEATHER_CHARS[index];
    },
  );
}

function buildPageLines(time: number, open: boolean): string[] {
  const source = open ? PAGE_GLOW_CHARS : PAGE_CHARS;
  return buildLayerLines(
    (character) => character === "=",
    (_character, row, column) => {
      const wave = Math.sin(row * 0.52 + column * 0.28 + time * (open ? 1.12 : 0.84)) * 0.5 + 0.5;
      const index = Math.min(source.length - 1, Math.floor(wave * source.length));
      return source[index];
    },
  );
}

function buildOutlineLines(): string[] {
  return buildLayerLines(
    (character) => character !== " " && !MARKER_CHARS.has(character),
    (character) => character,
  );
}

function buildStrapLines(): string[] {
  return buildLayerLines(
    (character) => character === "|",
    () => "|",
  );
}

function buildStudLines(): string[] {
  return buildLayerLines(
    (character) => character === "o",
    () => "o",
  );
}

function buildMetalLines(time: number): string[] {
  return buildLayerLines(
    (character) => character === "@" || character === "*" || character === "+",
    (character, row, column) => {
      if (character === "@") {
        return Math.sin(row * 0.64 + column * 0.27 + time * 1.24) > 0.32 ? "@" : "O";
      }
      if (character === "+") {
        return Math.sin(row * 0.44 + column * 0.51 + time * 1.1) > 0.18 ? "+" : "*";
      }
      return "*";
    },
  );
}

export default function LexiconBook({ open }: LexiconBookProps) {
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

  const leatherLines = buildLeatherLines(time);
  const pageLines = buildPageLines(time, open);
  const outlineLines = buildOutlineLines();
  const strapLines = buildStrapLines();
  const studLines = buildStudLines();
  const metalLines = buildMetalLines(time);

  return (
    <div
      className="relative inline-flex select-none items-start justify-center"
      style={{ width: `${LEXICON_BOOK_WIDTH}px`, height: `${LEXICON_BOOK_HEIGHT}px` }}
    >
      <pre className="pointer-events-none absolute left-[7px] top-[7px] m-0 whitespace-pre text-[5.6px] leading-[0.94] text-black/46">
        {SHADOW_LINES.join("\n")}
      </pre>
      <pre
        className={`pointer-events-none absolute left-[3px] top-[3px] m-0 whitespace-pre text-[5.6px] leading-[0.94] transition-[transform,color,filter] duration-300 ${
          open ? "text-[rgba(238,214,146,0.82)]" : "text-[rgba(222,198,124,0.74)]"
        }`}
        style={{
          transform: open ? "translate3d(7px, 2px, 0) scale(1.01)" : "translate3d(0, 0, 0) scale(1)",
          filter: open ? "drop-shadow(0 0 9px rgba(255,210,128,0.18))" : "none",
        }}
      >
        {pageLines.join("\n")}
      </pre>
      <div
        className="pointer-events-none absolute inset-0 transition-[transform,filter] duration-300"
        style={{
          transformOrigin: "84% 54%",
          transform: open ? "translate3d(-12px, -7px, 0) rotate(-11deg) scale(1.03)" : "translate3d(0, 0, 0) rotate(0deg) scale(1)",
          filter: open
            ? "drop-shadow(0 10px 20px rgba(0,0,0,0.42)) drop-shadow(0 0 10px rgba(255,198,112,0.08))"
            : "drop-shadow(0 8px 14px rgba(0,0,0,0.3))",
        }}
      >
        <pre className="absolute inset-0 m-0 whitespace-pre text-[5.6px] leading-[0.94] text-[rgba(92,52,28,0.96)] [text-shadow:0_0_5px_rgba(42,18,8,0.24)]">
          {leatherLines.join("\n")}
        </pre>
        <pre className="absolute inset-0 m-0 whitespace-pre text-[5.6px] leading-[0.94] text-[rgba(154,96,58,0.92)] opacity-70">
          {strapLines.join("\n")}
        </pre>
        <pre className="absolute inset-0 m-0 whitespace-pre text-[5.6px] leading-[0.94] text-[rgba(218,176,84,0.94)] [text-shadow:0_0_6px_rgba(255,214,132,0.2)]">
          {metalLines.join("\n")}
        </pre>
        <pre className="absolute inset-0 m-0 whitespace-pre text-[5.6px] leading-[0.94] text-[rgba(214,180,108,0.98)] [text-shadow:0_0_4px_rgba(255,216,146,0.16)]">
          {studLines.join("\n")}
        </pre>
        <pre className="absolute inset-0 m-0 whitespace-pre text-[5.6px] leading-[0.94] text-[rgba(226,220,212,0.94)] [text-shadow:0_0_4px_rgba(255,255,255,0.12)]">
          {outlineLines.join("\n")}
        </pre>
      </div>
      <span
        className={`pointer-events-none absolute left-[19%] top-[60%] -translate-x-1/2 -translate-y-1/2 -rotate-90 font-crt text-[0.42rem] tracking-[0.18em] transition-colors duration-150 ${
          open ? "text-[rgba(255,232,188,0.94)]" : "text-[rgba(232,214,182,0.86)]"
        }`}
      >
        VOCA
      </span>
    </div>
  );
}