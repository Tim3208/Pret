import { useMemo } from "react";
import { useAsciiAsset } from "@/shared/lib/ascii";

interface LexiconBookProps {
  open: boolean;
}

export const LEXICON_BOOK_WIDTH = 208;
export const LEXICON_BOOK_HEIGHT = 130;

const OPEN_BOOK_ASSET_FILE = "assets/book_ascii.md";
const CLOSED_BOOK_ASSET_FILE = "assets/book_closed_ascii.md";
const PAGE_LINE_HEIGHT = 0.92;
const CHARACTER_WIDTH_RATIO = 0.56;
const OPEN_PAGE_CHARACTERS = new Set(["=", ":", "-", "."]);
const CLOSED_HIGHLIGHT_CHARACTERS = new Set(["=", ":", "-", "."]);

/**
 * ASCII 라인 중 조건에 맞는 글자만 남겨 레이어 마스크를 만든다.
 *
 * @param lines 원본 ASCII 라인 목록
 * @param matcher 남길 글자를 판별하는 함수
 * @returns 선택된 글자만 남긴 ASCII 라인 목록
 */
function buildMaskedLines(lines: string[], matcher: (character: string) => boolean): string[] {
  return lines.map((line) => {
    let nextLine = "";
    for (let column = 0; column < line.length; column += 1) {
      const character = line[column];
      nextLine += matcher(character) ? character : " ";
    }
    return nextLine;
  });
}

/**
 * 여러 ASCII 자산을 함께 렌더링할 수 있도록 최대 행과 열 수를 계산한다.
 *
 * @param groups 비교할 ASCII 라인 묶음
 * @returns 공통 박스 계산에 사용할 최대 행과 열 수
 */
function getLargestAsciiMetrics(groups: string[][]): { columns: number; rows: number } {
  return groups.reduce(
    (largest, lines) => ({
      columns: Math.max(largest.columns, ...lines.map((line) => line.length), 1),
      rows: Math.max(largest.rows, lines.length, 1),
    }),
    { columns: 1, rows: 1 },
  );
}

/**
 * 현재 책 박스 안에 ASCII 자산이 안정적으로 들어오도록 글자 크기를 계산한다.
 *
 * @param columns 렌더링 대상의 최대 열 수
 * @param rows 렌더링 대상의 최대 행 수
 * @returns pre 태그에 적용할 글자 크기(px)
 */
function resolveAsciiFontSize(columns: number, rows: number): number {
  const innerWidth = LEXICON_BOOK_WIDTH - 18;
  const innerHeight = LEXICON_BOOK_HEIGHT - 18;
  const widthLimited = innerWidth / Math.max(1, columns * CHARACTER_WIDTH_RATIO);
  const heightLimited = innerHeight / Math.max(1, rows * PAGE_LINE_HEIGHT);
  return Math.max(3.8, Math.min(widthLimited, heightLimited));
}

export default function LexiconBook({ open }: LexiconBookProps) {
  const assetBase = import.meta.env.BASE_URL;
  const { lines: openLines } = useAsciiAsset(`${assetBase}${OPEN_BOOK_ASSET_FILE}`);
  const { lines: closedLines } = useAsciiAsset(`${assetBase}${CLOSED_BOOK_ASSET_FILE}`);
  const hasOpenAscii = openLines.length > 0;
  const hasClosedAscii = closedLines.length > 0;

  const bookMetrics = useMemo(
    () => getLargestAsciiMetrics([openLines, closedLines]),
    [closedLines, openLines],
  );
  const asciiFontSize = useMemo(
    () => resolveAsciiFontSize(bookMetrics.columns, bookMetrics.rows),
    [bookMetrics.columns, bookMetrics.rows],
  );

  const openPaperLines = useMemo(
    () => buildMaskedLines(openLines, (character) => OPEN_PAGE_CHARACTERS.has(character)),
    [openLines],
  );
  const openCoverLines = useMemo(
    () => buildMaskedLines(openLines, (character) => character !== " " && !OPEN_PAGE_CHARACTERS.has(character)),
    [openLines],
  );
  const closedBaseLines = useMemo(
    () => buildMaskedLines(closedLines, (character) => character !== " " && !CLOSED_HIGHLIGHT_CHARACTERS.has(character)),
    [closedLines],
  );
  const closedHighlightLines = useMemo(
    () => buildMaskedLines(closedLines, (character) => CLOSED_HIGHLIGHT_CHARACTERS.has(character)),
    [closedLines],
  );

  const sharedAsciiStyle = useMemo(
    () => ({
      fontSize: `${asciiFontSize}px`,
      lineHeight: PAGE_LINE_HEIGHT,
      letterSpacing: "-0.035em",
    }),
    [asciiFontSize],
  );

  return (
    <div
      className="relative inline-flex select-none items-start justify-center overflow-visible text-current"
      style={{ width: `${LEXICON_BOOK_WIDTH}px`, height: `${LEXICON_BOOK_HEIGHT}px` }}
    >
      {hasClosedAscii && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 transition-[opacity,transform,filter] duration-280"
          style={{
            transform: `translate3d(-50%, -50%, 0) scale(${open ? 0.985 : 1})`,
            opacity: open ? 0 : 1,
            filter: open
              ? "blur(1px) saturate(0.86)"
              : "drop-shadow(0 8px 16px rgba(0,0,0,0.28))",
          }}
        >
          <pre
            className="m-0 whitespace-pre text-current [text-shadow:0_0_5px_rgba(0,0,0,0.18)]"
            style={sharedAsciiStyle}
          >
            {closedBaseLines.join("\n")}
          </pre>
          <pre
            className="absolute inset-0 m-0 whitespace-pre text-current opacity-70"
            style={sharedAsciiStyle}
          >
            {closedHighlightLines.join("\n")}
          </pre>
        </div>
      )}

      {hasOpenAscii && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 transition-[clip-path,opacity,transform,filter] duration-320"
          style={{
            transformOrigin: "50% 54%",
            transform: open
              ? "translate3d(-50%, -50%, 0) scale(1)"
              : "translate3d(-50%, -50%, 0) scaleX(0.82) scaleY(0.97)",
            clipPath: open ? "inset(0 0 0 0)" : "inset(0 47% 0 47%)",
            opacity: open ? 1 : 0,
            filter: open
              ? "drop-shadow(0 10px 18px rgba(0,0,0,0.34))"
              : "blur(0.8px)",
          }}
        >
          <pre
            className="m-0 whitespace-pre text-current [text-shadow:0_0_5px_rgba(0,0,0,0.16)]"
            style={sharedAsciiStyle}
          >
            {openPaperLines.join("\n")}
          </pre>
          <pre
            className="absolute inset-0 m-0 whitespace-pre text-current opacity-82 [text-shadow:0_0_4px_rgba(0,0,0,0.14)]"
            style={sharedAsciiStyle}
          >
            {openCoverLines.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
