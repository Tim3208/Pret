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

interface PretextRitualPanelProps {
  lines: string[];
  title: string;
}

const RITUAL_FONT = `500 12px "Courier New", monospace`;
const RITUAL_LINE_HEIGHT = 18;

/**
 * Pretext로 긴 문장을 패널 폭에 맞게 다시 줄바꿈한다.
 *
 * @param text 줄바꿈할 문장
 * @param maxWidth 문장이 들어갈 최대 픽셀 폭
 * @returns 렌더링할 줄 목록
 */
function layoutRitualText(text: string, maxWidth: number): LayoutLine[] {
  if (!text.trim()) {
    return [];
  }

  try {
    return layoutWithLines(
      prepareWithSegments(text, RITUAL_FONT, {
        whiteSpace: "normal",
        wordBreak: "normal",
      }),
      maxWidth,
      RITUAL_LINE_HEIGHT,
    ).lines;
  } catch {
    return text.split("\n").map((line) => ({
      end: { graphemeIndex: 0, segmentIndex: 0 },
      start: { graphemeIndex: 0, segmentIndex: 0 },
      text: line,
      width: maxWidth,
    }));
  }
}

/**
 * 모닥불 정비 결과를 Pretext 줄바꿈과 의식형 페이드 연출로 보여준다.
 */
export default function PretextRitualPanel({
  lines,
  title,
}: PretextRitualPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(420);
  const displayLines = useMemo(
    () => lines.flatMap((line) => layoutRitualText(line, Math.max(160, bodyWidth - 16))),
    [bodyWidth, lines],
  );

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

  return (
    <div className="relative overflow-hidden rounded-[8px] border border-ember/22 bg-[rgba(13,8,4,0.42)] px-4 py-3 shadow-[inset_0_0_24px_rgba(255,170,0,0.05)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ember/45 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-ember/28 to-transparent" />
      <p className="m-0 text-[0.68rem] uppercase tracking-[0.22em] text-ember/78">
        {title}
      </p>
      <div ref={bodyRef} className="mt-2 space-y-1">
        {displayLines.length > 0 ? (
          displayLines.map((line, index) => (
            <p
              key={`${line.text}-${index}`}
              className="m-0 opacity-0 text-[0.74rem] leading-[1.55] tracking-[0.08em] text-[rgba(236,218,190,0.82)] [text-shadow:0_0_8px_rgba(255,170,0,0.08)] [animation:fade-in-quick_180ms_ease-out_forwards]"
              style={{ animationDelay: `${index * 48}ms` }}
            >
              <span className="text-ember/45">{index === 0 ? ">" : ":"}</span>{" "}
              {line.text}
            </p>
          ))
        ) : (
          <p className="m-0 text-[0.74rem] leading-[1.55] tracking-[0.08em] text-white/32">
            ...
          </p>
        )}
      </div>
    </div>
  );
}
