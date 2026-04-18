import {
  type LayoutLine,
  type LineStats,
  type PrepareOptions,
  type PreparedTextWithSegments,
  layoutNextLineRange,
  materializeLineRange,
  measureLineStats,
  prepareWithSegments,
} from "@chenglou/pretext";

export const VOCA_CRT_FONT_SIZE = 12;
export const VOCA_CRT_LINE_HEIGHT = 18;
export const VOCA_CRT_FONT = `500 ${VOCA_CRT_FONT_SIZE}px "Courier New", monospace`;

const preparedCache = new Map<string, PreparedTextWithSegments>();

/**
 * Pretext 준비 결과를 캐시에 보관해 같은 문장을 반복 측정하지 않도록 한다.
 *
 * @param text 줄바꿈 계산 대상 문자열
 * @param font Pretext 측정에 사용할 캔버스 폰트 문자열
 * @param options 공백/단어 분리 옵션
 * @returns 재사용 가능한 Pretext 준비 결과
 */
function getPreparedText(text: string, font: string, options?: PrepareOptions): PreparedTextWithSegments {
  const key = `${font}::${options?.whiteSpace ?? "normal"}::${options?.wordBreak ?? "normal"}::${text}`;
  const cached = preparedCache.get(key);
  if (cached) {
    return cached;
  }

  const prepared = prepareWithSegments(text, font, options);
  preparedCache.set(key, prepared);
  if (preparedCache.size > 220) {
    const firstKey = preparedCache.keys().next().value;
    if (firstKey) {
      preparedCache.delete(firstKey);
    }
  }

  return prepared;
}

/**
 * CRT 스타일 패널에 맞는 줄바꿈 결과를 한 줄씩 materialize 해서 반환한다.
 *
 * @param text 줄 계산 대상 문자열
 * @param maxWidth 허용할 최대 폭(px)
 * @param maxLines 최대 줄 수 제한
 * @param options Pretext 준비 옵션
 * @param font 사용할 캔버스 폰트 문자열
 * @returns 실제 렌더링 가능한 줄 목록
 */
export function layoutCrtLines(
  text: string,
  maxWidth: number,
  maxLines: number = Number.MAX_SAFE_INTEGER,
  options?: PrepareOptions,
  font: string = VOCA_CRT_FONT,
): LayoutLine[] {
  if (!text.trim()) {
    return [];
  }

  try {
    const prepared = getPreparedText(text, font, options);
    const lines: LayoutLine[] = [];
    let cursor = { segmentIndex: 0, graphemeIndex: 0 };

    while (lines.length < maxLines) {
      const range = layoutNextLineRange(prepared, cursor, maxWidth);
      if (range === null) {
        break;
      }

      lines.push(materializeLineRange(prepared, range));
      if (
        range.end.segmentIndex === cursor.segmentIndex &&
        range.end.graphemeIndex === cursor.graphemeIndex
      ) {
        break;
      }

      cursor = range.end;
    }

    return lines;
  } catch {
    return text
      .split("\n")
      .slice(0, maxLines)
      .map((line) => ({
        text: line,
        width: maxWidth,
        start: { segmentIndex: 0, graphemeIndex: 0 },
        end: { segmentIndex: 0, graphemeIndex: 0 },
      }));
  }
}

/**
 * CRT 패널 텍스트의 줄 수와 최대 줄 폭을 Pretext로 계산한다.
 *
 * @param text 줄 계산 대상 문자열
 * @param maxWidth 허용할 최대 폭(px)
 * @param options Pretext 준비 옵션
 * @param font 사용할 캔버스 폰트 문자열
 * @returns 줄 수와 최대 줄 폭
 */
export function measureCrtTextStats(
  text: string,
  maxWidth: number,
  options?: PrepareOptions,
  font: string = VOCA_CRT_FONT,
): LineStats {
  if (!text.trim()) {
    return { lineCount: 0, maxLineWidth: 0 };
  }

  try {
    return measureLineStats(getPreparedText(text, font, options), maxWidth);
  } catch {
    return { lineCount: text.split("\n").length, maxLineWidth: maxWidth };
  }
}

/**
 * 픽셀 폭을 터미널 스타일의 대략적인 문자 칸 수로 환산한다.
 *
 * @param pixelWidth 실제 렌더링 영역 폭(px)
 * @returns ASCII 프레임 생성에 쓸 칸 수
 */
export function estimateCrtColumns(pixelWidth: number): number {
  return Math.max(12, Math.floor(pixelWidth / 6.45));
}