import {
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
const PANEL_OFFSET_X = 28;
const PANEL_OFFSET_Y = 12;

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

function buildPageNoise(category: LexiconCategory, tick: number, columns: number, rows: number): string {
  const glyphs =
    category === "broken-script"
      ? ["#", "=", "/", "\\", ":", ";", "?", "%", "*"]
      : [".", ":", ";", "-", "_", "=", "+"];

  return Array.from({ length: rows }, (_, row) => {
    return Array.from({ length: columns }, (_, column) => {
      if ((row + column + tick) % 11 === 0) {
        return glyphs[(row * 3 + column * 5 + tick) % glyphs.length];
      }
      if ((row * 7 + column * 2 + tick) % 23 === 0) {
        return glyphs[(row + column + tick * 2) % glyphs.length];
      }
      return " ";
    }).join("");
  }).join("\n");
}

function makeSectionRule(label: string, width: number): string {
  const lineWidth = Math.max(label.length + 6, width);
  const repeat = Math.max(4, lineWidth - label.length - 3);
  return `┌ ${label} ${"─".repeat(repeat)}┐`;
}

function makeSectionFooter(width: number): string {
  return `└${"─".repeat(Math.max(10, width))}┘`;
}

function clampBookPosition(
  position: Point,
  open: boolean,
  viewport: ViewportSize,
  panelWidth: number,
  panelHeight: number,
): Point {
  const closedX = clamp(position.x, PANEL_MARGIN, viewport.width - LEXICON_BOOK_WIDTH - PANEL_MARGIN);
  const closedY = clamp(position.y, PANEL_MARGIN, viewport.height - LEXICON_BOOK_HEIGHT - PANEL_MARGIN);

  if (!open) {
    return { x: closedX, y: closedY };
  }

  const minimumX = PANEL_MARGIN + panelWidth - LEXICON_BOOK_WIDTH + PANEL_OFFSET_X;
  const maximumX = viewport.width - LEXICON_BOOK_WIDTH - PANEL_MARGIN;
  const minimumY = PANEL_MARGIN;
  const maximumY = viewport.height - panelHeight - PANEL_OFFSET_Y - PANEL_MARGIN;

  return {
    x: clamp(position.x, minimumX, Math.max(minimumX, maximumX)),
    y: clamp(position.y, minimumY, Math.max(minimumY, maximumY)),
  };
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
      Math.max(280, viewport.width - PANEL_MARGIN * 2 - 18),
      Math.max(320, Math.min(392, viewport.width * 0.34)),
    ),
  );
  const panelHeight = Math.round(
    Math.min(
      Math.max(380, viewport.height - PANEL_MARGIN * 2 - 18),
      Math.max(460, Math.min(632, viewport.height * 0.78)),
    ),
  );

  const clampedBookPosition = useMemo(
    () => clampBookPosition(bookPosition, open, viewport, panelWidth, panelHeight),
    [bookPosition, open, panelHeight, panelWidth, viewport],
  );

  const panelPosition = useMemo(() => {
    const x = clamp(
      clampedBookPosition.x - panelWidth + LEXICON_BOOK_WIDTH - PANEL_OFFSET_X,
      PANEL_MARGIN,
      viewport.width - panelWidth - PANEL_MARGIN,
    );
    const y = clamp(
      clampedBookPosition.y + PANEL_OFFSET_Y,
      PANEL_MARGIN,
      viewport.height - panelHeight - PANEL_MARGIN,
    );
    return { x, y };
  }, [clampedBookPosition.x, clampedBookPosition.y, panelHeight, panelWidth, viewport.height, viewport.width]);

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
  const hoveredEntry = visibleEntries.find((entry) => entry.id === hoveredEntryId) ?? null;
  const hoveredPresentation = hoveredEntry
    ? getLexiconEntryPresentation(hoveredEntry, language, decipher, noiseTick)
    : null;
  const pageNoise = useMemo(
    () => buildPageNoise(activeCategory, noiseTick, 34, 13),
    [activeCategory, noiseTick],
  );
  const headerRule = useMemo(
    () =>
      makeSectionRule(
        `${text.pageLabel} ${String(currentPage + 1).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`,
        28,
      ),
    [currentPage, pageCount, text.pageLabel],
  );
  const detailRule = useMemo(() => makeSectionRule(text.detailLabel, 28), [text.detailLabel]);
  const footerRule = useMemo(() => makeSectionFooter(34), []);

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
          open,
          viewport,
          panelWidth,
          panelHeight,
        ),
      );
    },
    [open, panelHeight, panelWidth, viewport],
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

  const changePage = useCallback(
    (direction: -1 | 1) => {
      setPageByCategory((current) => ({
        ...current,
        [activeCategory]: clamp(current[activeCategory] + direction, 0, pageCount - 1),
      }));
    },
    [activeCategory, pageCount],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] font-crt select-none">
      {open && (
        <div
          className="pointer-events-auto fixed origin-top-right border border-[rgba(178,198,182,0.22)] bg-[linear-gradient(180deg,rgba(5,8,6,0.97),rgba(2,4,3,0.98))] shadow-[0_0_26px_rgba(0,0,0,0.46),inset_0_0_24px_rgba(0,0,0,0.52)]"
          style={{
            left: `${panelPosition.x}px`,
            top: `${panelPosition.y}px`,
            width: `${panelWidth}px`,
            height: `${panelHeight}px`,
            animation: "voca-panel-unfurl 320ms cubic-bezier(0.16, 0.84, 0.2, 1) 1",
          }}
        >
          <div
            className="cursor-grab border-b border-[rgba(188,198,188,0.16)] px-4 py-3 active:cursor-grabbing"
            onPointerDown={handlePanelPointerDown}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.86rem] tracking-[0.24em] text-[rgba(214,226,216,0.9)]">{text.title}</p>
                <p className="mt-1 text-[0.56rem] uppercase tracking-[0.14em] text-white/34">
                  {text.decipherLabel} {String(decipher).padStart(2, "0")} :: {text.memoryLabel}
                </p>
              </div>
              <button
                type="button"
                className="cursor-pointer border border-white/10 px-2 py-1 text-[0.62rem] tracking-[0.14em] text-white/58 transition-colors hover:border-[rgba(255,190,132,0.34)] hover:text-[rgba(255,224,188,0.9)]"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setOpen(false)}
              >
                [X] {text.closeLabel}
              </button>
            </div>
          </div>

          <div className="relative h-[calc(100%-74px)] overflow-hidden px-4 py-4">
            <pre className="pointer-events-none absolute left-4 top-4 m-0 whitespace-pre text-[0.54rem] leading-[1.25] text-white/9">
              {pageNoise}
            </pre>

            <div className="relative z-10 flex h-full flex-col pr-[56px]">
              <pre className="m-0 whitespace-pre text-[0.58rem] leading-[1.3] text-white/30">{headerRule}</pre>

              <div className="mt-2 flex-1 border border-[rgba(168,176,172,0.12)] bg-black/18 px-3 py-3">
                <div className="flex h-full flex-col gap-3">
                  {visibleEntries.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-[0.72rem] leading-[1.6] text-white/30">
                      {text.emptyLabel}
                    </div>
                  ) : (
                    visibleEntries.map((entry) => {
                      const presentation = getLexiconEntryPresentation(entry, language, decipher, noiseTick);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className="cursor-default border border-[rgba(164,176,168,0.12)] bg-black/24 px-3 py-3 text-left transition-[border-color,color,background] duration-120 hover:border-[rgba(196,214,206,0.28)] hover:bg-black/34"
                          onMouseEnter={() => setHoveredEntryId(entry.id)}
                          onMouseLeave={() => setHoveredEntryId((current) => (current === entry.id ? null : current))}
                          onFocus={() => setHoveredEntryId(entry.id)}
                          onBlur={() => setHoveredEntryId((current) => (current === entry.id ? null : current))}
                        >
                          <p className="text-[0.78rem] tracking-[0.16em] text-[rgba(232,238,234,0.94)]">
                            {"> "}
                            <span className={presentation.unstable ? "text-[rgba(255,198,152,0.9)]" : undefined}>
                              {presentation.term}
                            </span>
                          </p>
                          <p className="mt-2 text-[0.62rem] uppercase tracking-[0.14em] text-white/30">
                            {presentation.unstable ? text.unstableLabel : text.stableLabel}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[0.64rem] tracking-[0.16em] text-white/50">
                <button
                  type="button"
                  className={`cursor-pointer border px-3 py-1 transition-colors ${
                    currentPage <= 0
                      ? "border-white/8 text-white/18"
                      : "border-white/12 text-white/60 hover:border-[rgba(255,190,132,0.34)] hover:text-[rgba(255,228,192,0.9)]"
                  }`}
                  onClick={() => changePage(-1)}
                  disabled={currentPage <= 0}
                >
                  [ &lt; ]
                </button>
                <span>
                  {String(currentPage + 1).padStart(2, "0")} / {String(pageCount).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  className={`cursor-pointer border px-3 py-1 transition-colors ${
                    currentPage >= pageCount - 1
                      ? "border-white/8 text-white/18"
                      : "border-white/12 text-white/60 hover:border-[rgba(255,190,132,0.34)] hover:text-[rgba(255,228,192,0.9)]"
                  }`}
                  onClick={() => changePage(1)}
                  disabled={currentPage >= pageCount - 1}
                >
                  [ &gt; ]
                </button>
              </div>

              <div className="mt-3">
                <pre className="m-0 whitespace-pre text-[0.58rem] leading-[1.3] text-white/30">{detailRule}</pre>
                <div className="border-x border-[rgba(168,176,172,0.12)] bg-black/24 px-3 py-3">
                  {hoveredPresentation ? (
                    <>
                      <p className="text-[0.66rem] leading-[1.5] text-[rgba(230,234,232,0.9)]">
                        ex :: {hoveredPresentation.example}
                      </p>
                      <p className="mt-2 text-[0.66rem] leading-[1.55] text-white/60">
                        fx :: {hoveredPresentation.effect}
                      </p>
                    </>
                  ) : (
                    <p className="text-[0.66rem] leading-[1.55] text-white/34">{text.placeholderDetail}</p>
                  )}
                </div>
                <pre className="m-0 whitespace-pre text-[0.58rem] leading-[1.3] text-white/30">{footerRule}</pre>
              </div>
            </div>
          </div>

          <div className="absolute right-[-1px] top-[92px] z-20 flex flex-col gap-2">
            {LEXICON_CATEGORIES.map((category) => {
              const active = category.id === activeCategory;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`w-[68px] cursor-pointer border px-2 py-2 text-left transition-[transform,border-color,color,background] duration-120 ${
                    active
                      ? "translate-x-[6px] border-[rgba(208,220,210,0.3)] bg-[rgba(8,10,9,0.96)] text-[rgba(236,240,238,0.94)]"
                      : "border-[rgba(138,146,142,0.14)] bg-[rgba(5,7,6,0.92)] text-white/44 hover:border-[rgba(208,220,210,0.22)] hover:text-white/74"
                  }`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <span className="block text-[0.56rem] uppercase leading-[1.2] tracking-[0.1em]">
                    {category.primaryLabel[language]}
                  </span>
                  <span className="mt-1 block text-[0.52rem] leading-[1.25] text-white/44">
                    {category.secondaryLabel[language]}
                  </span>
                </button>
              );
            })}
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
        <div className="relative flex h-full w-full items-start justify-center">
          <div
            className="transition-[transform,filter] duration-200"
            style={{
              transformOrigin: "84% 54%",
              transform: open
                ? "translate3d(-6px, -2px, 0) rotate(-4deg) scale(1.02)"
                : "translate3d(0, 0, 0) rotate(0deg) scale(1)",
              filter: open
                ? "drop-shadow(0 10px 20px rgba(0,0,0,0.42))"
                : "drop-shadow(0 8px 16px rgba(0,0,0,0.28))",
              animation: open
                ? "voca-book-unseal 360ms cubic-bezier(0.16, 0.84, 0.2, 1) 1"
                : undefined,
            }}
          >
            <LexiconBook open={open} />
          </div>
          <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.15rem)] -translate-x-1/2 whitespace-nowrap text-[0.52rem] uppercase tracking-[0.22em] text-[rgba(212,220,214,0.7)]">
            {text.title}
          </span>
        </div>
      </button>
    </div>
  );
}
