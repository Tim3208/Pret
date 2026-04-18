import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VOCA_LEXICON_TEXT } from "@/content/text/app/voca";
import {
  LEXICON_CATEGORIES,
  LEXICON_PAGE_SIZE,
  getLexiconEntriesForCategory,
  getLexiconEntryPresentation,
  type LexiconCategory,
} from "@/content/glossary/voca/lexicon";
import type { Language } from "@/entities/locale";
import LexiconBook, { LEXICON_BOOK_HEIGHT, LEXICON_BOOK_WIDTH } from "./LexiconBook";
import {
  VOCA_CRT_LINE_HEIGHT,
  estimateCrtColumns,
  layoutCrtLines,
} from "../lib/crtText";

interface Point {
  x: number;
  y: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type PanelAnchor = "right" | "left" | "above" | "below";

interface PanelPlacement extends Point {
  anchor: PanelAnchor;
}

interface DragSession {
  pointerId: number;
  source: "book" | "panel";
  startClientX: number;
  startClientY: number;
  startPosition: Point;
  moved: boolean;
}

interface VocaLexiconProps {
  language: Language;
  decipher: number;
  learnedEntryIds: readonly string[];
}

const PANEL_MARGIN = 16;
const PANEL_SIDE_GAP = 18;
const PANEL_VERTICAL_GAP = 18;
const PANEL_TOP_BIAS = 10;
const PANEL_CONTENT_PADDING = 18;
const CATEGORY_RAIL_WIDTH = 86;
const CATEGORY_RAIL_GAP = 12;
const VOCA_PANEL_WRAPPER_OPACITY = 0.78;
const VOCA_PANEL_TEXT = "rgba(208,194,176,0.78)";
const VOCA_PANEL_TEXT_STRONG = "rgba(228,218,202,0.92)";
const ASCII_ROW_HEIGHT = VOCA_CRT_LINE_HEIGHT;
const ASCII_INLINE_GAP = 8;
const ASCII_SECTION_GAP = 12;
const PANEL_HEADER_CLEARANCE = 34;
const PANEL_VERTICAL_PADDING = 32;
const PAGE_NAV_HEIGHT = ASCII_ROW_HEIGHT;
const DETAIL_FRAME_CHROME_HEIGHT = ASCII_ROW_HEIGHT * 2 + ASCII_INLINE_GAP * 2;
const RAIL_TOP_OFFSET = 2;
const PANEL_FRAME_ROW_HEIGHT = 16;

const PANEL_MOTION_BY_ANCHOR: Record<
  PanelAnchor,
  {
    enterX: string;
    enterY: string;
    enterTilt: string;
    bounceX: string;
    bounceTilt: string;
  }
> = {
  right: {
    enterX: "30px",
    enterY: "-10px",
    enterTilt: "14deg",
    bounceX: "-5px",
    bounceTilt: "4deg",
  },
  left: {
    enterX: "-30px",
    enterY: "-10px",
    enterTilt: "-14deg",
    bounceX: "5px",
    bounceTilt: "-4deg",
  },
  above: {
    enterX: "0px",
    enterY: "-24px",
    enterTilt: "0deg",
    bounceX: "0px",
    bounceTilt: "0deg",
  },
  below: {
    enterX: "0px",
    enterY: "24px",
    enterTilt: "0deg",
    bounceX: "0px",
    bounceTilt: "0deg",
  },
};

const INITIAL_PAGE_BY_CATEGORY: Record<LexiconCategory, number> = {
  verb: 0,
  connector: 0,
  contrast: 0,
  "broken-script": 0,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function getViewportSize(): ViewportSize {
  if (typeof window === "undefined") {
    return { width: 1280, height: 720 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function makeSectionRule(label: string, width: number): string {
  const lineWidth = Math.max(label.length + 6, width);
  const repeat = Math.max(4, lineWidth - label.length - 3);
  return `┌ ${label} ${"─".repeat(repeat)}┐`;
}

function makeSectionFooter(width: number): string {
  return `└${"─".repeat(Math.max(10, width))}┘`;
}

/**
 * ASCII 프레임에 들어갈 텍스트를 폭에 맞게 자르고 남는 칸은 공백으로 채운다.
 *
 * @param text 정리할 원본 텍스트
 * @param width 맞출 목표 폭
 * @returns 고정 폭 ASCII 셀 문자열
 */
function fitAsciiContent(text: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (text.length <= width) {
    return text.padEnd(width, " ");
  }

  if (width <= 3) {
    return text.slice(0, width);
  }

  return `${text.slice(0, width - 3)}...`;
}

/**
 * ASCII 박스 상단 라인을 만든다.
 *
 * @param label 상단 라벨
 * @param innerWidth 박스 내부 폭
 * @returns ASCII 박스 상단 라인
 */
function makeAsciiBoxTopLine(label: string, innerWidth: number): string {
  const safeWidth = Math.max(12, innerWidth);
  const safeLabel = fitAsciiContent(label, Math.max(1, safeWidth - 2)).trimEnd();
  const topFill = Math.max(1, safeWidth - safeLabel.length - 1);
  return `┌${safeLabel} ${"─".repeat(topFill)}┐`;
}

/**
 * ASCII 박스 하단 라인을 만든다.
 *
 * @param innerWidth 박스 내부 폭
 * @returns ASCII 박스 하단 라인
 */
function makeAsciiBoxBottomLine(innerWidth: number): string {
  return `└${"─".repeat(Math.max(12, innerWidth))}┘`;
}

/**
 * ASCII 박스 본문 라인들을 좌우 테두리와 함께 만든다.
 *
 * @param innerWidth 박스 내부 폭
 * @param lines 본문 줄 목록
 * @param minimumLines 최소 본문 줄 수
 * @returns 좌우 테두리가 포함된 본문 라인 목록
 */
function makeAsciiBoxBodyLines(innerWidth: number, lines: string[], minimumLines: number = 0): string[] {
  const safeWidth = Math.max(12, innerWidth);
  const normalizedLines = [...lines];

  while (normalizedLines.length < minimumLines) {
    normalizedLines.push("");
  }

  return normalizedLines.map((line) => `│${fitAsciiContent(line, safeWidth)}│`);
}

/**
 * CRT 패널 내부에 쓸 투박한 ASCII 박스를 만든다.
 *
 * @param label 상단 라벨
 * @param innerWidth 박스 내부 폭
 * @param lines 본문 줄 목록
 * @param minimumLines 최소 본문 줄 수
 * @returns 박스 전체 라인 목록
 */
function makeAsciiBox(label: string, innerWidth: number, lines: string[], minimumLines: number = 0): string[] {
  return [
    makeAsciiBoxTopLine(label, innerWidth),
    ...makeAsciiBoxBodyLines(innerWidth, lines, minimumLines),
    makeAsciiBoxBottomLine(innerWidth),
  ];
}

/**
 * ASCII 박스가 실제로 차지하는 줄 수를 계산한다.
 *
 * @param contentLineCount 본문 줄 수
 * @param minimumLines 최소 본문 줄 수
 * @returns 상하단 테두리를 포함한 전체 줄 수
 */
function countAsciiBoxLines(contentLineCount: number, minimumLines: number = 0): number {
  return Math.max(contentLineCount, minimumLines) + 2;
}

/**
 * 패널 전체를 감싸는 낡은 장비형 ASCII 외곽 프레임을 만든다.
 *
 * @param width 프레임 내부 폭
 * @param height 프레임 줄 수
 * @param label 상단 장비 라벨
 * @returns 패널 전체 외곽 프레임 라인 목록
 */
function makeWeatheredPanelFrame(width: number, height: number, label: string): string[] {
  const safeWidth = Math.max(30, width);
  const safeHeight = Math.max(10, height);
  const safeLabel = fitAsciiContent(`[ ${label} ]`, Math.max(1, safeWidth - 4)).trimEnd();
  const labelGap = Math.max(2, safeWidth - safeLabel.length - 1);
  const lines = [
    ` .#${"=".repeat(safeWidth)}#.`,
    `/# ${safeLabel}${" ".repeat(labelGap)}#\\`,
  ];

  for (let row = 0; row < safeHeight - 4; row += 1) {
    const left = row % 7 === 0 ? "#" : row % 3 === 0 ? ":" : "|";
    const right = row % 6 === 0 ? "#" : row % 4 === 0 ? ":" : "|";
    lines.push(`${left}${" ".repeat(safeWidth + 2)}${right}`);
  }

  lines.push(`\\#${"=".repeat(safeWidth)}#/`);
  lines.push(` '${"~".repeat(safeWidth)}' `);
  return lines;
}

/**
 * 패널 하단에 아주 옅게 깔리는 마모 흔적용 ASCII 노이즈를 만든다.
 *
 * @param categoryId 현재 활성 카테고리
 * @param tick 애니메이션 틱
 * @param width 줄 폭
 * @param rows 줄 수
 * @returns 여러 줄 ASCII 노이즈 문자열
 */
function buildPageNoise(categoryId: LexiconCategory, tick: number, width: number, rows: number): string {
  const safeWidth = Math.max(12, width);
  const safeRows = Math.max(1, rows);
  const glyphBanks: Record<LexiconCategory, readonly string[]> = {
    verb: [".", ":", "'", "`"],
    connector: ["=", ":", ".", "`"],
    contrast: ["#", ":", ".", "'"],
    "broken-script": [";", ":", ".", "`"],
  };
  const glyphs = glyphBanks[categoryId] ?? [".", ":", "'", "`"];

  return Array.from({ length: safeRows }, (_, row) => {
    return Array.from({ length: safeWidth }, (_, column) => {
      const value = (tick * 5 + row * 11 + column * 7) % 41;
      if (value % 19 === 0) {
        return glyphs[(row + column + tick) % glyphs.length];
      }

      if (value % 23 === 0) {
        return row % 2 === 0 ? ":" : ".";
      }

      return " ";
    }).join("");
  }).join("\n");
}

/**
 * 좌표와 크기를 직사각형으로 묶어 충돌 계산에 쓴다.
 *
 * @param x 좌상단 x 좌표
 * @param y 좌상단 y 좌표
 * @param width 직사각형 너비
 * @param height 직사각형 높이
 * @returns 충돌 계산용 직사각형 데이터
 */
function createRect(x: number, y: number, width: number, height: number): Rect {
  return { left: x, top: y, width, height };
}

/**
 * 두 직사각형이 겹치는 면적을 계산한다.
 *
 * @param first 첫 번째 직사각형
 * @param second 두 번째 직사각형
 * @returns 겹치지 않으면 0, 겹치면 겹친 면적
 */
function getOverlapArea(first: Rect, second: Rect): number {
  const overlapWidth = Math.max(
    0,
    Math.min(first.left + first.width, second.left + second.width) - Math.max(first.left, second.left),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(first.top + first.height, second.top + second.height) - Math.max(first.top, second.top),
  );
  return overlapWidth * overlapHeight;
}

/**
 * 책은 항상 뷰포트 안에 남기고, 열린 창 배치는 별도 계산으로 처리한다.
 *
 * @param position 책의 목표 좌표
 * @param viewport 현재 뷰포트 크기
 * @returns 화면 안으로 보정된 책 좌표
 */
function clampBookPosition(position: Point, viewport: ViewportSize): Point {
  const maximumX = Math.max(PANEL_MARGIN, viewport.width - LEXICON_BOOK_WIDTH - PANEL_MARGIN);
  const maximumY = Math.max(PANEL_MARGIN, viewport.height - LEXICON_BOOK_HEIGHT - PANEL_MARGIN);

  return {
    x: clamp(position.x, PANEL_MARGIN, maximumX),
    y: clamp(position.y, PANEL_MARGIN, maximumY),
  };
}

/**
 * 책 주변 후보 위치를 순서대로 평가해 가장 자연스럽고 덜 겹치는 창 좌표를 고른다.
 *
 * @param bookPosition 책의 좌상단 좌표
 * @param viewport 현재 뷰포트 크기
 * @param panelWidth 창 너비
 * @param panelHeight 창 높이
 * @returns 패널 좌표와 기준 방향
 */
function resolvePanelPlacement(
  bookPosition: Point,
  viewport: ViewportSize,
  panelWidth: number,
  panelHeight: number,
): PanelPlacement {
  const bookRect = createRect(bookPosition.x, bookPosition.y, LEXICON_BOOK_WIDTH, LEXICON_BOOK_HEIGHT);
  const maximumX = Math.max(PANEL_MARGIN, viewport.width - panelWidth - PANEL_MARGIN);
  const maximumY = Math.max(PANEL_MARGIN, viewport.height - panelHeight - PANEL_MARGIN);
  const candidatePlacements: PanelPlacement[] = [
    {
      anchor: "right",
      x: bookRect.left + bookRect.width + PANEL_SIDE_GAP,
      y: bookRect.top - PANEL_TOP_BIAS,
    },
    {
      anchor: "left",
      x: bookRect.left - panelWidth - PANEL_SIDE_GAP,
      y: bookRect.top - PANEL_TOP_BIAS,
    },
    {
      anchor: "above",
      x: bookRect.left + bookRect.width / 2 - panelWidth / 2,
      y: bookRect.top - panelHeight - PANEL_VERTICAL_GAP,
    },
    {
      anchor: "below",
      x: bookRect.left + bookRect.width / 2 - panelWidth / 2,
      y: bookRect.top + bookRect.height + PANEL_VERTICAL_GAP,
    },
  ];

  const evaluatedPlacements = candidatePlacements.map((candidate) => {
    const x = clamp(candidate.x, PANEL_MARGIN, maximumX);
    const y = clamp(candidate.y, PANEL_MARGIN, maximumY);
    const panelRect = createRect(x, y, panelWidth, panelHeight);
    return {
      ...candidate,
      x,
      y,
      drift: Math.abs(candidate.x - x) + Math.abs(candidate.y - y),
      overlap: getOverlapArea(panelRect, bookRect),
    };
  });

  const nonOverlappingPlacement = evaluatedPlacements.find((placement) => placement.overlap === 0);
  if (nonOverlappingPlacement) {
    return nonOverlappingPlacement;
  }

  evaluatedPlacements.sort((left, right) => left.overlap - right.overlap || left.drift - right.drift);
  return evaluatedPlacements[0];
}

export default function VocaLexicon({ language, decipher, learnedEntryIds }: VocaLexiconProps) {
  const text = VOCA_LEXICON_TEXT[language];
  const [viewport, setViewport] = useState<ViewportSize>(() => getViewportSize());
  const [bookPosition, setBookPosition] = useState<Point>(() => {
    const size = getViewportSize();
    return {
      x: Math.round(size.width / 2 - LEXICON_BOOK_WIDTH / 2),
      y: 18,
    };
  });
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<LexiconCategory>("verb");
  const [pageByCategory, setPageByCategory] = useState<Record<LexiconCategory, number>>(INITIAL_PAGE_BY_CATEGORY);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const [noiseTick, setNoiseTick] = useState(0);
  const dragSessionRef = useRef<DragSession | null>(null);

  const panelWidth = Math.round(
    Math.min(
      Math.max(1, viewport.width - PANEL_MARGIN * 2),
      Math.max(280, Math.min(392, viewport.width * 0.34)),
    ),
  );
  const panelMaxHeight = Math.round(
    Math.min(
      Math.max(1, viewport.height - PANEL_MARGIN * 2),
      Math.min(632, viewport.height * 0.78),
    ),
  );

  const clampedBookPosition = useMemo(
    () => clampBookPosition(bookPosition, viewport),
    [bookPosition, viewport],
  );

  const activeEntries = useMemo(
    () => getLexiconEntriesForCategory(activeCategory, learnedEntryIds),
    [activeCategory, learnedEntryIds],
  );
  const pageCount = Math.max(1, Math.ceil(activeEntries.length / LEXICON_PAGE_SIZE));
  const currentPage = Math.min(pageByCategory[activeCategory], pageCount - 1);
  const visibleEntries = activeEntries.slice(
    currentPage * LEXICON_PAGE_SIZE,
    currentPage * LEXICON_PAGE_SIZE + LEXICON_PAGE_SIZE,
  );
  const selectedEntryId = visibleEntries.some((entry) => entry.id === hoveredEntryId)
    ? hoveredEntryId
    : visibleEntries[0]?.id ?? null;
  const selectedEntryIndex = Math.max(
    0,
    visibleEntries.findIndex((entry) => entry.id === selectedEntryId),
  );
  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedEntryId) ?? null;
  const hoveredPresentation = selectedEntry
    ? getLexiconEntryPresentation(selectedEntry, language, decipher, noiseTick)
    : null;
  const activeCategoryIndex = LEXICON_CATEGORIES.findIndex((category) => category.id === activeCategory);
  const mainColumnWidth = Math.max(
    180,
    panelWidth - PANEL_CONTENT_PADDING * 2 - CATEGORY_RAIL_WIDTH - CATEGORY_RAIL_GAP,
  );
  const contentColumns = useMemo(
    () => estimateCrtColumns(mainColumnWidth - 20),
    [mainColumnWidth],
  );
  const railColumns = useMemo(
    () => Math.max(12, estimateCrtColumns(CATEGORY_RAIL_WIDTH - 8)),
    [],
  );
  const listTextWidth = Math.max(150, mainColumnWidth - 20);
  const detailTextWidth = Math.max(150, mainColumnWidth - 20);
  const panelFrameColumns = useMemo(
    () => Math.max(contentColumns + railColumns + 8, estimateCrtColumns(panelWidth - PANEL_CONTENT_PADDING * 2 - 36)),
    [contentColumns, panelWidth, railColumns],
  );
  const entryReadouts = useMemo(() => {
    return visibleEntries.map((entry, index) => {
      const presentation = getLexiconEntryPresentation(entry, language, decipher, noiseTick);
      const titleLines = layoutCrtLines(presentation.term, listTextWidth, 2, { whiteSpace: "pre-wrap" }).map(
        (line) => line.text,
      );
      return {
        entry,
        presentation,
        slotLabel: `SLOT ${String(currentPage * LEXICON_PAGE_SIZE + index + 1).padStart(2, "0")}`,
        titleLines,
        boxLineCount: countAsciiBoxLines(titleLines.length, 3),
      };
    });
  }, [currentPage, decipher, language, listTextWidth, noiseTick, visibleEntries]);
  const entryListHeight = useMemo(() => {
    if (entryReadouts.length === 0) {
      return ASCII_ROW_HEIGHT;
    }

    return entryReadouts.reduce((sum, readout) => sum + readout.boxLineCount * ASCII_ROW_HEIGHT, 0)
      + Math.max(0, entryReadouts.length - 1) * ASCII_INLINE_GAP;
  }, [entryReadouts]);
  const categoryReadouts = useMemo(() => {
    return LEXICON_CATEGORIES.map((category, index) => {
      const titleLines = layoutCrtLines(category.primaryLabel[language].toUpperCase(), CATEGORY_RAIL_WIDTH - 18, 2, {
        whiteSpace: "pre-wrap",
      }).map((line) => line.text);

      return {
        category,
        index,
        titleLines,
        boxLineCount: countAsciiBoxLines(titleLines.length, 3),
      };
    });
  }, [language]);
  const categoryListHeight = useMemo(
    () =>
      categoryReadouts.reduce((sum, readout) => sum + readout.boxLineCount * ASCII_ROW_HEIGHT, 0)
      + Math.max(0, categoryReadouts.length - 1) * ASCII_INLINE_GAP,
    [categoryReadouts],
  );
  const railHeight = useMemo(
    () => RAIL_TOP_OFFSET + ASCII_ROW_HEIGHT + ASCII_INLINE_GAP + categoryListHeight + ASCII_INLINE_GAP + ASCII_ROW_HEIGHT,
    [categoryListHeight],
  );
  const detailBody = hoveredPresentation
    ? `[ ${text.nameLabel.toUpperCase()} ]\n${hoveredPresentation.term}\n\n[ ${text.exampleLabel.toUpperCase()} ]\n${hoveredPresentation.example}\n\n[ ${text.descriptionLabel.toUpperCase()} ]\n${hoveredPresentation.effect}`
    : text.placeholderDetail;
  const detailContentLines = useMemo(
    () => layoutCrtLines(detailBody, detailTextWidth, 48, { whiteSpace: "pre-wrap" }).map((line) => line.text),
    [detailBody, detailTextWidth],
  );
  const detailBodyLines = useMemo(
    () => (detailContentLines.length > 0 ? detailContentLines : ["_"]),
    [detailContentLines],
  );
  const listSectionHeight = useMemo(
    () => ASCII_ROW_HEIGHT + ASCII_INLINE_GAP + entryListHeight + ASCII_SECTION_GAP + PAGE_NAV_HEIGHT,
    [entryListHeight],
  );
  const leftStaticHeight = useMemo(
    () => listSectionHeight + ASCII_SECTION_GAP + DETAIL_FRAME_CHROME_HEIGHT,
    [listSectionHeight],
  );
  const desiredDetailBodyHeight = useMemo(
    () => detailBodyLines.length * ASCII_ROW_HEIGHT,
    [detailBodyLines.length],
  );
  const maxPanelContentHeight = useMemo(
    () => Math.max(ASCII_ROW_HEIGHT * 4, panelMaxHeight - PANEL_HEADER_CLEARANCE - PANEL_VERTICAL_PADDING),
    [panelMaxHeight],
  );
  const desiredContentHeight = useMemo(
    () => Math.max(railHeight, leftStaticHeight + desiredDetailBodyHeight),
    [desiredDetailBodyHeight, leftStaticHeight, railHeight],
  );
  const detailViewportHeight = useMemo(() => {
    if (desiredContentHeight <= maxPanelContentHeight) {
      return desiredDetailBodyHeight;
    }

    return Math.max(ASCII_ROW_HEIGHT, maxPanelContentHeight - leftStaticHeight);
  }, [desiredContentHeight, desiredDetailBodyHeight, leftStaticHeight, maxPanelContentHeight]);
  const detailHasOverflow = desiredDetailBodyHeight > detailViewportHeight;
  const detailFrameLabel = useMemo(
    () => text.detailLabel.toUpperCase(),
    [text.detailLabel],
  );
  const listRule = useMemo(
    () => makeSectionRule(`index ${String(currentPage + 1).padStart(2, "0")}`, contentColumns),
    [contentColumns, currentPage],
  );
  const detailRule = useMemo(
    () => makeAsciiBoxTopLine(detailFrameLabel, contentColumns),
    [contentColumns, detailFrameLabel],
  );
  const detailBodyFrameLines = useMemo(
    () => makeAsciiBoxBodyLines(contentColumns, detailBodyLines),
    [contentColumns, detailBodyLines],
  );
  const footerRule = useMemo(
    () => makeAsciiBoxBottomLine(contentColumns),
    [contentColumns],
  );
  const railRule = useMemo(() => makeSectionRule("bank", railColumns), [railColumns]);
  const railFooter = useMemo(() => makeSectionFooter(railColumns), [railColumns]);
  const panelHeight = useMemo(() => {
    const contentHeight = Math.min(maxPanelContentHeight, Math.max(railHeight, leftStaticHeight + detailViewportHeight));
    return Math.round(PANEL_HEADER_CLEARANCE + PANEL_VERTICAL_PADDING + contentHeight);
  }, [detailViewportHeight, leftStaticHeight, maxPanelContentHeight, railHeight]);
  const panelPlacement = useMemo(
    () => resolvePanelPlacement(clampedBookPosition, viewport, panelWidth, panelHeight),
    [clampedBookPosition, panelHeight, panelWidth, viewport],
  );
  const panelStyle = useMemo(() => {
    const motion = PANEL_MOTION_BY_ANCHOR[panelPlacement.anchor];
    const transformOrigin =
      panelPlacement.anchor === "right"
        ? "left top"
        : panelPlacement.anchor === "left"
          ? "right top"
          : panelPlacement.anchor === "above"
            ? "center bottom"
            : "center top";

    return {
      left: `${panelPlacement.x}px`,
      top: `${panelPlacement.y}px`,
      width: `${panelWidth}px`,
      height: `${panelHeight}px`,
      animation: "voca-panel-unfurl 280ms cubic-bezier(0.18, 0.82, 0.24, 1) 1",
      transformOrigin,
      "--voca-panel-enter-x": motion.enterX,
      "--voca-panel-enter-y": motion.enterY,
      "--voca-panel-enter-tilt": motion.enterTilt,
      "--voca-panel-bounce-x": motion.bounceX,
      "--voca-panel-bounce-tilt": motion.bounceTilt,
    } as CSSProperties & Record<string, string>;
  }, [panelHeight, panelPlacement.anchor, panelPlacement.x, panelPlacement.y, panelWidth]);
  const panelFrameRows = useMemo(
    () => Math.max(10, Math.ceil((panelHeight - 20) / PANEL_FRAME_ROW_HEIGHT)),
    [panelHeight],
  );
  const panelFrameLines = useMemo(
    () => makeWeatheredPanelFrame(panelFrameColumns, panelFrameRows, text.title.toUpperCase()),
    [panelFrameColumns, panelFrameRows, text.title],
  );
  const panelWear = useMemo(
    () => buildPageNoise(activeCategory, noiseTick, Math.max(18, panelFrameColumns - 10), 4),
    [activeCategory, noiseTick, panelFrameColumns],
  );
  const detailRevealKey = selectedEntry?.id ?? `placeholder:${activeCategory}:${currentPage}`;

  useEffect(() => {
    const handleResize = () => {
      setViewport(getViewportSize());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNoiseTick((value) => value + 1);
    }, 180);

    return () => window.clearInterval(timer);
  }, []);

  const changeCategory = useCallback(
    (direction: -1 | 1) => {
      const nextIndex = clamp(activeCategoryIndex + direction, 0, LEXICON_CATEGORIES.length - 1);
      const nextCategory = LEXICON_CATEGORIES[nextIndex];
      if (!nextCategory || nextCategory.id === activeCategory) {
        return;
      }

      setActiveCategory(nextCategory.id);
      setHoveredEntryId(null);
    },
    [activeCategory, activeCategoryIndex],
  );

  const changePage = useCallback(
    (direction: -1 | 1) => {
      setPageByCategory((current) => ({
        ...current,
        [activeCategory]: clamp(current[activeCategory] + direction, 0, pageCount - 1),
      }));
      setHoveredEntryId(null);
    },
    [activeCategory, pageCount],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = clamp(selectedEntryIndex - 1, 0, Math.max(0, visibleEntries.length - 1));
        const nextEntry = visibleEntries[nextIndex];
        if (nextEntry) {
          setHoveredEntryId(nextEntry.id);
        }
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex = clamp(selectedEntryIndex + 1, 0, Math.max(0, visibleEntries.length - 1));
        const nextEntry = visibleEntries[nextIndex];
        if (nextEntry) {
          setHoveredEntryId(nextEntry.id);
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (currentPage > 0) {
          changePage(-1);
        } else {
          changeCategory(-1);
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (currentPage < pageCount - 1) {
          changePage(1);
        } else {
          changeCategory(1);
        }
        return;
      }

      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        const nextCategory = LEXICON_CATEGORIES[Number(event.key) - 1];
        if (nextCategory) {
          setActiveCategory(nextCategory.id);
          setHoveredEntryId(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeCategory, changePage, currentPage, open, pageCount, selectedEntryIndex, visibleEntries]);

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      const session = dragSessionRef.current;
      if (!session) {
        return;
      }

      const deltaX = clientX - session.startClientX;
      const deltaY = clientY - session.startClientY;
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        session.moved = true;
      }

      setBookPosition(
        clampBookPosition(
          {
            x: session.startPosition.x + deltaX,
            y: session.startPosition.y + deltaY,
          },
          viewport,
        ),
      );
    },
    [viewport],
  );

  const beginDrag = useCallback(
    (source: "book" | "panel", event: ReactPointerEvent<HTMLElement>) => {
      dragSessionRef.current = {
        pointerId: event.pointerId,
        source,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPosition: clampedBookPosition,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [clampedBookPosition],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) {
        return;
      }

      updatePosition(event.clientX, event.clientY);
    },
    [updatePosition],
  );

  const handlePanelPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      beginDrag("panel", event);
    },
    [beginDrag],
  );

  const handleBookPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      beginDrag("book", event);
    },
    [beginDrag],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      updatePosition(event.clientX, event.clientY);
      const shouldToggle = session.source === "book" && !session.moved;
      dragSessionRef.current = null;
      if (shouldToggle) {
        setOpen((value) => !value);
      }
    },
    [updatePosition],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] font-crt select-none">
      {open && (
        <div
          className="pointer-events-auto fixed overflow-visible"
          style={{
            ...panelStyle,
            backgroundColor: `rgba(0, 0, 0, ${VOCA_PANEL_WRAPPER_OPACITY})`,
            color: VOCA_PANEL_TEXT,
          }}
        >
          <div className="relative h-full px-[18px] py-[16px]">
            <pre className="pointer-events-none absolute left-[8px] top-[8px] m-0 whitespace-pre text-[0.66rem] leading-[1.5] text-[rgba(176,157,132,0.7)]">
              {panelFrameLines.join("\n")}
            </pre>
            <pre className="pointer-events-none absolute bottom-[14px] left-[22px] m-0 whitespace-pre text-[0.52rem] leading-[1.3] text-[rgba(188,170,145,0.09)]">
              {panelWear}
            </pre>

            <div
              className="absolute left-[18px] right-[60px] top-[16px] z-20 h-[26px] cursor-grab active:cursor-grabbing"
              onPointerDown={handlePanelPointerDown}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />

            <button
              type="button"
              aria-label={text.closeLabel}
              className="absolute right-[0px] top-[10px] z-20 cursor-pointer border-0 bg-transparent p-0 text-[1rem] leading-[1.45] tracking-[0.08em] transition-colors hover:text-[rgba(244,235,220,0.98)]"
              style={{ color: VOCA_PANEL_TEXT_STRONG }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setOpen(false)}
            >
              [X]
            </button>

            <div className="relative z-10 flex h-full min-h-0 flex-col pt-[34px]">
            <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_86px] gap-3 overflow-hidden">
              <div className="relative z-10 min-w-0">
                <div className="bg-transparent px-1 py-1">
                  <pre className="m-0 whitespace-pre text-[0.62rem] leading-[1.4] text-[rgba(186,170,150,0.56)]">{listRule}</pre>

                  <div className="mt-2 space-y-2">
                    {entryReadouts.length === 0 ? (
                      <pre className="m-0 whitespace-pre text-[0.7rem] leading-[1.5] text-[rgba(142,128,112,0.42)]">
                        {text.emptyLabel}
                      </pre>
                    ) : (
                      entryReadouts.map((readout, index) => {
                        const active = selectedEntryId === readout.entry.id;
                        const blockLines = makeAsciiBox(
                          `${active ? ">" : " "} ${readout.slotLabel}`,
                          contentColumns,
                          readout.titleLines,
                          3,
                        );
                        return (
                          <button
                            key={readout.entry.id}
                            type="button"
                            className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left transition-[opacity,transform,filter] duration-150 hover:brightness-110"
                            style={{
                              opacity: 0,
                              animation: `fade-in-quick 160ms ease-out ${80 + index * 56}ms forwards`,
                            }}
                            onMouseEnter={() => setHoveredEntryId(readout.entry.id)}
                            onMouseLeave={() => setHoveredEntryId((current) => (current === readout.entry.id ? null : current))}
                            onFocus={() => setHoveredEntryId(readout.entry.id)}
                            onBlur={() => setHoveredEntryId((current) => (current === readout.entry.id ? null : current))}
                          >
                            <pre
                              className={`m-0 whitespace-pre text-[0.78rem] leading-[1.36] ${active ? "text-[rgba(228,218,202,0.92)]" : "text-[rgba(186,170,150,0.62)]"}`}
                            >
                              {blockLines.join("\n")}
                            </pre>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-[0.64rem] leading-[1.35] text-[rgba(186,170,150,0.56)]">
                    <button
                      type="button"
                      className={`cursor-pointer border-0 bg-transparent px-0 py-0 transition-colors ${
                        currentPage <= 0 ? "text-[rgba(142,128,112,0.24)]" : "text-[rgba(228,218,202,0.92)] hover:text-[rgba(244,235,220,0.98)]"
                      }`}
                      onClick={() => changePage(-1)}
                      disabled={currentPage <= 0}
                    >
                      [PREV]
                    </button>
                    <span>{String(currentPage + 1).padStart(2, "0")} / {String(pageCount).padStart(2, "0")}</span>
                    <button
                      type="button"
                      className={`cursor-pointer border-0 bg-transparent px-0 py-0 transition-colors ${
                        currentPage >= pageCount - 1
                          ? "text-[rgba(142,128,112,0.24)]"
                          : "text-[rgba(228,218,202,0.92)] hover:text-[rgba(244,235,220,0.98)]"
                      }`}
                      onClick={() => changePage(1)}
                      disabled={currentPage >= pageCount - 1}
                    >
                      [NEXT]
                    </button>
                  </div>
                </div>

                <div className="mt-3 px-1 py-1">
                  <pre className="m-0 whitespace-pre text-[0.62rem] leading-[1.4] text-[rgba(186,170,150,0.56)]">{detailRule}</pre>
                  <div
                    key={detailRevealKey}
                    className="mt-2 overflow-x-hidden overflow-y-auto"
                    style={{
                      height: `${detailViewportHeight}px`,
                      scrollbarGutter: detailHasOverflow ? "stable" : undefined,
                    }}
                  >
                    {detailBodyFrameLines.map((line, index, bodyLines) => {
                      const cursor = !detailHasOverflow && index === bodyLines.length - 1 && noiseTick % 2 === 0 ? "_" : "";
                      return (
                        <div
                          key={`${detailRevealKey}:${index}`}
                          className="whitespace-pre text-[0.68rem] leading-[1.52] text-[rgba(228,218,202,0.92)]"
                          style={{
                            opacity: 0,
                            animation: `fade-in-quick 140ms ease-out ${index * 42}ms forwards`,
                          }}
                        >
                          {`${index === bodyLines.length - 1 ? `${line.slice(0, -1)}${cursor}│` : line}`}
                        </div>
                      );
                    })}
                  </div>
                  <pre className="mt-2 m-0 whitespace-pre text-[0.62rem] leading-[1.4] text-[rgba(142,128,112,0.42)]">{footerRule}</pre>
                </div>
              </div>

              <div className="relative z-10 min-w-0 pt-[2px]">
                <pre className="m-0 whitespace-pre text-[0.6rem] leading-[1.36] text-[rgba(186,170,150,0.52)]">{railRule}</pre>
                <div className="mt-2 flex flex-col gap-2">
                  {categoryReadouts.map((readout) => {
                    const active = readout.category.id === activeCategory;
                    const categoryLines = makeAsciiBox(
                      `${active ? ">" : " "} ${String(readout.index + 1).padStart(2, "0")}`,
                      railColumns,
                      readout.titleLines,
                      3,
                    );
                    return (
                      <button
                        key={readout.category.id}
                        type="button"
                        className="cursor-pointer border-0 bg-transparent p-0 text-left transition-[opacity,transform,filter] duration-150 hover:brightness-110"
                        style={{
                          opacity: 0,
                          animation: `fade-in-quick 160ms ease-out ${180 + readout.index * 52}ms forwards`,
                        }}
                        onClick={() => setActiveCategory(readout.category.id)}
                      >
                        <pre className={`m-0 whitespace-pre text-[0.58rem] leading-[1.34] ${active ? "text-[rgba(228,218,202,0.92)]" : "text-[rgba(186,170,150,0.56)]"}`}>
                          {categoryLines.join("\n")}
                        </pre>
                      </button>
                    );
                  })}
                </div>
                <pre className="mt-2 m-0 whitespace-pre text-[0.6rem] leading-[1.36] text-[rgba(142,128,112,0.42)]">{railFooter}</pre>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={text.title}
        className="pointer-events-auto fixed border-0 bg-transparent p-0"
        style={{
          left: `${clampedBookPosition.x}px`,
          top: `${clampedBookPosition.y}px`,
          width: `${LEXICON_BOOK_WIDTH}px`,
          height: `${LEXICON_BOOK_HEIGHT}px`,
        }}
        onPointerDown={handleBookPointerDown}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="relative flex h-full w-full items-start justify-center" style={{ color: VOCA_PANEL_TEXT }}>
          <div
            className="transition-[transform,filter] duration-200"
            style={{
              transformOrigin: "50% 54%",
              transform: open ? "translate3d(0, 0, 0) scale(1.01)" : "translate3d(0, 0, 0) scale(1)",
              filter: open
                ? "drop-shadow(0 10px 18px rgba(0,0,0,0.34))"
                : "drop-shadow(0 8px 16px rgba(0,0,0,0.28))",
              animation: open
                ? "voca-book-unseal 280ms cubic-bezier(0.2, 0.82, 0.24, 1) 1"
                : undefined,
            }}
          >
            <LexiconBook open={open} />
          </div>
          <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.15rem)] -translate-x-1/2 whitespace-nowrap text-[0.52rem] uppercase tracking-[0.22em] text-current">
            {text.title}
          </span>
        </div>
      </button>
    </div>
  );
}
