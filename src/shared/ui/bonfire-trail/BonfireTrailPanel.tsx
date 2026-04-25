import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAsciiAsset } from "@/shared/lib/ascii";

export interface BonfireTrailStep {
  id: string;
  label: string;
  state: "cleared" | "current" | "upcoming";
}

interface BonfireTrailPanelProps {
  hint: string;
  steps: BonfireTrailStep[];
  title: string;
}

interface Point {
  x: number;
  y: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface DragSession {
  pointerId: number;
  source: "button" | "panel";
  startClientX: number;
  startClientY: number;
  startPosition: Point;
  moved: boolean;
}

const PANEL_MARGIN = 14;
const CLOSED_BUTTON_GLYPH_WIDTH = 4.6;
const CLOSED_BUTTON_LINE_HEIGHT = 5.2;
const OPEN_BUTTON_GLYPH_WIDTH = 3.9;
const OPEN_BUTTON_LINE_HEIGHT = 4.25;
const PANEL_FRAME_GLYPH_WIDTH = 6.8;
const PANEL_POPUP_WIDTH = 348;
const DEFAULT_OPEN_MAP_LINES = [
  "      .------.      ",
  "   .-'  /\\   '-.   ",
  " .'    /  \\    '.  ",
  "/_____/____\\_____\\",
  "\\     \\  //     //",
  " '.    \\//    .'  ",
  "   '-.______. -'   ",
] as const;
const DEFAULT_CLOSED_MAP_LINES = [
  "   .----.   ",
  " .'/ /\\ '. ",
  " |/_/__\\_| ",
  "  '------'  ",
] as const;
const ROUTE_CONNECTOR_LINES = ["  |||  ", "  |||  "] as const;
const QUESTION_NODE_LINES = ["  .-.  ", " ( ? ) ", "  '-'  "] as const;
const BONFIRE_NODE_LINES = ["   .(   ", "  /%/\\  ", " (%(%)) ", ".-'..`-. ", "`-'.'`-'  "] as const;

let persistedMapPosition: Point | null = null;
let persistedMapOpen = false;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * 현재 뷰포트 크기를 읽어 지도 배치 계산에 쓴다.
 */
function getViewportSize(): ViewportSize {
  if (typeof window === "undefined") {
    return { width: 1280, height: 720 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * 아스키 라인 배열의 실제 차지 크기를 픽셀 근사값으로 계산한다.
 */
function measureAscii(lines: readonly string[], glyphWidth: number, lineHeight: number) {
  const widestLine = lines.reduce((maximum, line) => Math.max(maximum, line.length), 0);
  return {
    height: Math.max(42, lines.length * lineHeight),
    width: Math.max(72, widestLine * glyphWidth),
  };
}

/**
 * 닫힌 미니맵 아이콘의 시작 좌표를 뷰포트 우상단 쪽에 배치한다.
 */
function getDefaultPosition(viewport: ViewportSize, buttonWidth: number, buttonHeight: number): Point {
  return {
    x: Math.max(PANEL_MARGIN, viewport.width - buttonWidth - 26),
    y: Math.max(PANEL_MARGIN, Math.min(88, viewport.height - buttonHeight - PANEL_MARGIN)),
  };
}

/**
 * 드래그 좌표가 화면 밖으로 나가지 않게 닫힌 아이콘 위치를 고정한다.
 */
function clampButtonPosition(
  position: Point,
  viewport: ViewportSize,
  buttonWidth: number,
  buttonHeight: number,
): Point {
  return {
    x: clamp(position.x, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.width - buttonWidth - PANEL_MARGIN)),
    y: clamp(position.y, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.height - buttonHeight - PANEL_MARGIN)),
  };
}

/**
 * 팝업 지도 패널이 버튼 주변에서 화면 안에 머무를 좌표를 계산한다.
 */
function getPopupPosition(
  buttonPosition: Point,
  buttonWidth: number,
  viewport: ViewportSize,
  popupWidth: number,
): Point {
  const preferredLeft = buttonPosition.x + buttonWidth + 16;
  const fallbackLeft = buttonPosition.x - popupWidth - 16;
  const left = preferredLeft + popupWidth <= viewport.width - PANEL_MARGIN
    ? preferredLeft
    : fallbackLeft >= PANEL_MARGIN
      ? fallbackLeft
      : clamp(buttonPosition.x, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.width - popupWidth - PANEL_MARGIN));

  return {
    x: left,
    y: clamp(buttonPosition.y - 10, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.height - 560)),
  };
}

/**
 * 긴 설명 문장을 아스키 박스 폭에 맞게 줄바꿈한다.
 */
function wrapAsciiText(text: string, width: number): string[] {
  const glyphs = Array.from(text.trim());
  if (glyphs.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const glyph of glyphs) {
    if (glyph === "\n") {
      lines.push(current.trimEnd());
      current = "";
      continue;
    }

    if ((current + glyph).length > width) {
      lines.push(current.trimEnd());
      current = glyph;
      continue;
    }

    current += glyph;
  }

  lines.push(current.trimEnd());
  return lines.filter((line, index) => line.length > 0 || index === 0);
}

/**
 * ASCII 프레임 안에 들어갈 문자열을 폭에 맞춰 고정 폭으로 맞춘다.
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
 */
function makeAsciiBoxTopLine(label: string, innerWidth: number): string {
  const safeWidth = Math.max(12, innerWidth);
  const safeLabel = fitAsciiContent(label, Math.max(1, safeWidth - 2)).trimEnd();
  const topFill = Math.max(1, safeWidth - safeLabel.length - 1);
  return `┌${safeLabel} ${"─".repeat(topFill)}┐`;
}

/**
 * ASCII 박스 하단 라인을 만든다.
 */
function makeAsciiBoxBottomLine(innerWidth: number): string {
  return `└${"─".repeat(Math.max(12, innerWidth))}┘`;
}

/**
 * ASCII 박스 본문 라인들을 좌우 테두리와 함께 만든다.
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
 * 아스키 본문을 넣을 간단한 내부 박스를 만든다.
 */
function makeAsciiBox(label: string, innerWidth: number, lines: string[], minimumLines: number = 0): string[] {
  return [
    makeAsciiBoxTopLine(label, innerWidth),
    ...makeAsciiBoxBodyLines(innerWidth, lines, minimumLines),
    makeAsciiBoxBottomLine(innerWidth),
  ];
}

/**
 * VOCA처럼 바깥을 감싸는 낡은 ASCII 프레임을 만든다.
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
 * 현재 단계에 맞는 노드 아스키를 반환한다. 전투/이벤트는 모두 ?로 통일한다.
 */
function getNodeLines(step: BonfireTrailStep): string[] {
  return step.id === "bonfire" ? [...BONFIRE_NODE_LINES] : [...QUESTION_NODE_LINES];
}

export default function BonfireTrailPanel({
  hint,
  steps,
  title,
}: BonfireTrailPanelProps) {
  const assetBase = import.meta.env.BASE_URL;
  const viewport = useMemo(() => getViewportSize(), []);
  const [open, setOpen] = useState(persistedMapOpen);
  const { lines: openMapLines } = useAsciiAsset(`${assetBase}assets/map_ascii.md`);
  const { lines: closedMapLines } = useAsciiAsset(`${assetBase}assets/map_closed_ascii.md`);
  const resolvedOpenMapLines = useMemo(
    () => (openMapLines.length > 0 ? openMapLines : [...DEFAULT_OPEN_MAP_LINES]),
    [openMapLines],
  );
  const resolvedClosedMapLines = useMemo(
    () => (closedMapLines.length > 0 ? closedMapLines : [...DEFAULT_CLOSED_MAP_LINES]),
    [closedMapLines],
  );
  const activeButtonLines = useMemo(
    () => (open ? resolvedOpenMapLines : resolvedClosedMapLines),
    [open, resolvedClosedMapLines, resolvedOpenMapLines],
  );
  const activeButtonGlyphWidth = open ? OPEN_BUTTON_GLYPH_WIDTH : CLOSED_BUTTON_GLYPH_WIDTH;
  const activeButtonLineHeight = open ? OPEN_BUTTON_LINE_HEIGHT : CLOSED_BUTTON_LINE_HEIGHT;
  const buttonMetrics = useMemo(
    () => measureAscii(activeButtonLines, activeButtonGlyphWidth, activeButtonLineHeight),
    [activeButtonGlyphWidth, activeButtonLineHeight, activeButtonLines],
  );
  const [viewportSize, setViewportSize] = useState(viewport);
  const [buttonPosition, setButtonPosition] = useState<Point>(() =>
    persistedMapPosition ?? getDefaultPosition(viewport, buttonMetrics.width, buttonMetrics.height),
  );
  const dragSessionRef = useRef<DragSession | null>(null);
  const clampedButtonPosition = useMemo(
    () => clampButtonPosition(buttonPosition, viewportSize, buttonMetrics.width, buttonMetrics.height),
    [buttonMetrics.height, buttonMetrics.width, buttonPosition, viewportSize],
  );
  const popupWidth = Math.min(viewportSize.width - PANEL_MARGIN * 2, PANEL_POPUP_WIDTH);
  const popupPosition = useMemo(
    () => getPopupPosition(clampedButtonPosition, buttonMetrics.width, viewportSize, popupWidth),
    [buttonMetrics.width, clampedButtonPosition, popupWidth, viewportSize],
  );
  const currentStep = useMemo(
    () => steps.find((step) => step.state === "current") ?? steps[0] ?? null,
    [steps],
  );
  const currentStepIndex = useMemo(
    () => (currentStep ? Math.max(0, steps.findIndex((step) => step.id === currentStep.id)) : 0),
    [currentStep, steps],
  );
  const locationBoxLines = useMemo(() => {
    const caption = currentStep
      ? currentStep.id === "bonfire"
        ? currentStep.label
        : `${currentStep.label} (?)`
      : "?";

    return makeAsciiBox(
      " NOW ",
      24,
      [
        `HERE :: ${caption}`,
        `STEP :: ${Math.min(steps.length, currentStepIndex + 1)}/${Math.max(1, steps.length)}`,
      ],
      2,
    );
  }, [currentStep, currentStepIndex, steps.length]);
  const hintBoxLines = useMemo(
    () => makeAsciiBox(" FEEL ", 28, wrapAsciiText(hint, 28), 3),
    [hint],
  );
  const routeLineCount = useMemo(
    () => steps.reduce(
      (sum, step, index) => sum + getNodeLines(step).length + (index < steps.length - 1 ? ROUTE_CONNECTOR_LINES.length : 0),
      0,
    ),
    [steps],
  );
  const panelFrameColumns = useMemo(
    () => Math.max(46, Math.floor((popupWidth - 20) / PANEL_FRAME_GLYPH_WIDTH)),
    [popupWidth],
  );
  const panelFrameRows = useMemo(
    () => Math.max(26, routeLineCount + locationBoxLines.length + hintBoxLines.length + 10),
    [hintBoxLines.length, locationBoxLines.length, routeLineCount],
  );
  const panelFrameLines = useMemo(
    () => makeWeatheredPanelFrame(panelFrameColumns, panelFrameRows, "MAP"),
    [panelFrameColumns, panelFrameRows],
  );

  useEffect(() => {
    const handleResize = () => setViewportSize(getViewportSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    persistedMapPosition = clampedButtonPosition;
  }, [clampedButtonPosition]);

  useEffect(() => {
    persistedMapOpen = open;
  }, [open]);

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    const session = dragSessionRef.current;
    if (!session) {
      return;
    }

    const deltaX = clientX - session.startClientX;
    const deltaY = clientY - session.startClientY;
    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      session.moved = true;
    }

    setButtonPosition(
      clampButtonPosition(
        {
          x: session.startPosition.x + deltaX,
          y: session.startPosition.y + deltaY,
        },
        viewportSize,
        buttonMetrics.width,
        buttonMetrics.height,
      ),
    );
  }, [buttonMetrics.height, buttonMetrics.width, viewportSize]);

  const beginDrag = useCallback((source: "button" | "panel", event: ReactPointerEvent<HTMLElement>) => {
    dragSessionRef.current = {
      pointerId: event.pointerId,
      source,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: clampedButtonPosition,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [clampedButtonPosition]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    updatePosition(event.clientX, event.clientY);
  }, [updatePosition]);

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    updatePosition(event.clientX, event.clientY);
    const shouldToggle = session.source === "button" && !session.moved;
    dragSessionRef.current = null;
    if (shouldToggle) {
      setOpen((value) => !value);
    }
  }, [updatePosition]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[89] font-crt select-none">
      {open && (
        <div
          className="pointer-events-auto fixed overflow-visible"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.78)",
            color: "rgba(208,194,176,0.78)",
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            maxHeight: `calc(100vh - ${PANEL_MARGIN * 2}px)`,
            transform: "translate3d(0, 0, 0)",
            width: `${popupWidth}px`,
          }}
        >
          <div className="relative px-[18px] py-[16px]">
            <pre className="pointer-events-none absolute left-[8px] top-[8px] m-0 whitespace-pre text-[0.66rem] leading-[1.5] text-[rgba(176,157,132,0.7)]">
              {panelFrameLines.join("\n")}
            </pre>

            <div
              className="absolute left-[18px] right-[18px] top-[16px] z-20 h-[24px] cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => beginDrag("panel", event)}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />

            <div className="relative z-10 flex max-h-[calc(100vh-64px)] flex-col items-center gap-4 overflow-y-auto px-2 pb-1 pt-[32px]">
              <pre className="m-0 whitespace-pre text-[0.72rem] leading-[1.16] text-[rgba(214,204,188,0.74)]">
                {locationBoxLines.join("\n")}
              </pre>

              <div className="flex justify-center">
                <div className="flex flex-col items-center gap-2">
                  {steps.map((step, index) => {
                    const nodeColor = step.id === "bonfire"
                      ? step.state === "current"
                        ? "text-[rgba(255,176,108,0.96)]"
                        : step.state === "cleared"
                          ? "text-[rgba(198,132,92,0.46)]"
                          : "text-[rgba(238,160,112,0.74)]"
                      : step.state === "current"
                        ? "text-[rgba(232,214,186,0.94)]"
                        : step.state === "cleared"
                          ? "text-white/26"
                          : "text-white/56";

                    return (
                      <div key={step.id} className="flex flex-col items-center gap-1">
                        <pre
                          className={`m-0 whitespace-pre text-center text-[0.74rem] leading-[1.05] ${nodeColor}`}
                          style={{
                            filter: step.state === "current"
                              ? "drop-shadow(0 0 12px rgba(255,170,96,0.18))"
                              : undefined,
                          }}
                        >
                          {getNodeLines(step).join("\n")}
                        </pre>
                        {index < steps.length - 1 && (
                          <pre className="m-0 whitespace-pre text-center text-[0.66rem] leading-[0.92] text-white/22">
                            {ROUTE_CONNECTOR_LINES.join("\n")}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <pre className="m-0 whitespace-pre text-[0.68rem] leading-[1.18] text-[rgba(214,204,188,0.72)]">
                {hintBoxLines.join("\n")}
              </pre>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={title}
        className="pointer-events-auto fixed border-0 bg-transparent p-0"
        style={{
          left: `${clampedButtonPosition.x}px`,
          top: `${clampedButtonPosition.y}px`,
          width: `${buttonMetrics.width}px`,
          height: `${buttonMetrics.height}px`,
        }}
        onPointerDown={(event) => beginDrag("button", event)}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="relative flex h-full w-full items-start justify-center text-[rgba(214,204,188,0.72)]">
          <pre
            className="m-0 whitespace-pre text-center leading-none transition-[transform,filter] duration-200"
            style={{
              fontSize: `${activeButtonLineHeight}px`,
              transform: open ? "translate3d(0, 0, 0) scale(1.02)" : "translate3d(0, 0, 0) scale(1)",
              filter: open
                ? "drop-shadow(0 8px 18px rgba(0,0,0,0.34))"
                : "drop-shadow(0 6px 14px rgba(0,0,0,0.3))",
            }}
          >
            {activeButtonLines.join("\n")}
          </pre>
          <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.25rem)] -translate-x-1/2 whitespace-nowrap text-[0.5rem] uppercase tracking-[0.2em] text-[rgba(214,204,188,0.62)]">
            MAP
          </span>
        </div>
      </button>
    </div>
  );
}