import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type LayoutLine,
  layoutWithLines,
  prepareWithSegments,
} from "@chenglou/pretext";

interface BonfireTypewriterMessageProps {
  message: string;
}

const TYPEWRITER_FONT = `500 13px "Courier New", monospace`;
const TYPEWRITER_LINE_HEIGHT = 20;
const TYPEWRITER_INTERVAL_MS = 28;

/**
 * Pretext를 사용해 모닥불 알림 문장을 현재 폭에 맞게 나눈다.
 *
 * @param message 표시할 알림 문장
 * @param maxWidth 줄바꿈 기준 폭
 * @returns 화면에 표시할 줄 목록
 */
function layoutTypewriterLines(message: string, maxWidth: number): LayoutLine[] {
  if (!message.trim()) {
    return [];
  }

  try {
    return layoutWithLines(
      prepareWithSegments(message.replace(/\s*\n+\s*/g, "  /  "), TYPEWRITER_FONT, {
        whiteSpace: "normal",
        wordBreak: "normal",
      }),
      maxWidth,
      TYPEWRITER_LINE_HEIGHT,
    ).lines.slice(0, 3);
  } catch {
    return message
      .split("\n")
      .slice(0, 3)
      .map((line) => ({
        end: { graphemeIndex: 0, segmentIndex: 0 },
        start: { graphemeIndex: 0, segmentIndex: 0 },
        text: line,
        width: maxWidth,
      }));
  }
}

/**
 * 지정된 글자 수만큼 줄 목록을 잘라 typewriter 출력 상태를 만든다.
 *
 * @param lines 전체 줄 목록
 * @param visibleCount 현재까지 노출할 글자 수
 * @returns 줄별로 잘린 표시 문자열
 */
function sliceVisibleLines(lines: LayoutLine[], visibleCount: number): string[] {
  let remaining = visibleCount;

  return lines.map((line) => {
    const graphemes = Array.from(line.text);
    const visibleLine = graphemes.slice(0, Math.max(0, remaining)).join("");
    remaining -= graphemes.length;
    return visibleLine;
  });
}

/**
 * 현재 출력된 마지막 줄의 인덱스를 찾는다.
 *
 * @param lines 잘려 나온 표시 줄 목록
 * @returns 커서를 붙일 줄 인덱스
 */
function getLastVisibleLineIndex(lines: string[]): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].length > 0) {
      return index;
    }
  }

  return 0;
}

/**
 * 모닥불 아래에 행동 결과 알림을 타자기처럼 출력한다.
 */
export default function BonfireTypewriterMessage({
  message,
}: BonfireTypewriterMessageProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(520);
  const [visibleCount, setVisibleCount] = useState(0);
  const layoutLines = useMemo(
    () => layoutTypewriterLines(message, Math.max(180, bodyWidth - 12)),
    [bodyWidth, message],
  );
  const totalCount = useMemo(
    () => layoutLines.reduce((sum, line) => sum + Array.from(line.text).length, 0),
    [layoutLines],
  );
  const visibleLines = useMemo(
    () => sliceVisibleLines(layoutLines, visibleCount),
    [layoutLines, visibleCount],
  );
  const typingDone = message.trim().length === 0 || visibleCount >= totalCount;

  useEffect(() => {
    const element = bodyRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setBodyWidth(element.getBoundingClientRect().width);
    };
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!message.trim() || visibleCount >= totalCount) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(totalCount, current + 1));
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [message, totalCount, visibleCount]);

  return (
    <div
      ref={bodyRef}
      className="mx-auto flex min-h-[4.35rem] w-full max-w-[620px] items-center justify-center px-3 text-center font-crt"
      aria-live="polite"
    >
      {message.trim() ? (
        <div className="w-full">
          {visibleLines.map((line, index) => {
            const isCursorLine =
              !typingDone
                ? getLastVisibleLineIndex(visibleLines) === index
                : index === Math.max(0, visibleLines.length - 1);

            return (
              <p
                key={`${layoutLines[index]?.text ?? ""}-${index}`}
                className="m-0 min-h-[1.28rem] text-[0.8rem] leading-[1.55] tracking-[0.08em] text-[rgba(235,226,207,0.82)] [text-shadow:0_0_9px_rgba(255,170,0,0.12)] sm:text-[0.88rem]"
              >
                {line}
                {isCursorLine && (
                  <span className="ml-[2px] inline-block animate-cursor-blink text-ember">
                    _
                  </span>
                )}
              </p>
            );
          })}
        </div>
      ) : (
        <span className="text-[0.8rem] text-transparent">_</span>
      )}
    </div>
  );
}
