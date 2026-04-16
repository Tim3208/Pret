import { useEffect, useRef, useState } from "react";

const DEFAULT_ASCII_RAMP =
  " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const DITHER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * 값을 지정한 구간으로 제한한다.
 */
function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 흑점과 백점을 기준으로 밝기 범위를 다시 매핑한다.
 */
function remapLevels(value: number, blackPoint: number, whitePoint: number): number {
  if (whitePoint <= blackPoint) return clamp(value);
  return clamp((value - blackPoint) / (whitePoint - blackPoint));
}

/**
 * 대비와 노출 값을 적용해 휘도를 보정한다.
 */
function toneMap(luminance: number, contrast: number, exposure: number): number {
  const contrasted = (luminance - 0.5) * contrast + 0.5;
  return clamp(contrasted * exposure);
}

/**
 * ASCII 결과의 바깥 여백을 잘라 실제 스프라이트 영역만 남긴다.
 */
function trimAscii(lines: string[]): string[] {
  if (lines.length === 0) return lines;

  let top = 0;
  while (top < lines.length && lines[top].trim() === "") top += 1;

  let bottom = lines.length - 1;
  while (bottom > top && lines[bottom].trim() === "") bottom -= 1;

  const croppedRows = lines.slice(top, bottom + 1);
  if (croppedRows.length === 0) return [];

  let left = croppedRows[0].length;
  let right = 0;

  for (const line of croppedRows) {
    const firstChar = line.search(/\S/);
    if (firstChar === -1) continue;
    left = Math.min(left, firstChar);

    let lastChar = line.length - 1;
    while (lastChar >= 0 && line[lastChar] === " ") lastChar -= 1;
    right = Math.max(right, lastChar);
  }

  if (left > right) return croppedRows;
  return croppedRows.map((line) => line.slice(left, right + 1));
}

/**
 * 주변 픽셀과의 평균 차이를 구해 로컬 대비를 샘플링한다.
 */
function sampleDifference(
  values: number[],
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const center = values[y * width + x];
  let sum = 0;
  let count = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      sum += Math.abs(center - values[ny * width + nx]);
      count += 1;
    }
  }

  return count === 0 ? 0 : sum / count;
}

/**
 * 이미지 한 프레임을 ASCII 문자열 배열로 변환한다.
 */
function frameToAscii(
  img: HTMLImageElement,
  srcX: number,
  srcW: number,
  cols: number,
  options: {
    flip: boolean;
    threshold: number;
    contrast: number;
    exposure: number;
    alphaThreshold: number;
    blackPoint: number;
    whitePoint: number;
    ramp: string;
  },
): string[] {
  const {
    flip,
    threshold,
    contrast,
    exposure,
    alphaThreshold,
    blackPoint,
    whitePoint,
    ramp,
  } = options;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const charAspect = 0.55;
  const aspect = img.height / srcW;
  const rows = Math.max(1, Math.round(cols * aspect * charAspect));

  canvas.width = cols;
  canvas.height = rows;
  ctx.clearRect(0, 0, cols, rows);
  ctx.imageSmoothingEnabled = true;

  if (flip) {
    ctx.translate(cols, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(img, srcX, 0, srcW, img.height, 0, 0, cols, rows);

  const imgData = ctx.getImageData(0, 0, cols, rows);
  const data = imgData.data;
  const luminanceMap: number[] = new Array(cols * rows);
  const alphaMap: number[] = new Array(cols * rows);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const i = (y * cols + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      luminanceMap[y * cols + x] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      alphaMap[y * cols + x] = a / 255;
    }
  }

  const thresholdNorm = threshold / 255;
  const alphaCutoff = alphaThreshold / 255;
  const result: string[] = [];

  for (let y = 0; y < rows; y += 1) {
    let line = "";

    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x;
      const alpha = alphaMap[index];
      if (alpha <= alphaCutoff) {
        line += " ";
        continue;
      }

      const luminance = remapLevels(
        toneMap(luminanceMap[index], contrast, exposure),
        blackPoint,
        whitePoint,
      );
      const localContrast = clamp(sampleDifference(luminanceMap, cols, rows, x, y) * 2.35);
      const alphaEdge = clamp(sampleDifference(alphaMap, cols, rows, x, y) * 3.2);
      const dither = (DITHER_4X4[y % 4][x % 4] - 7.5) / 52;

      let density =
        luminance * (0.62 + alpha * 0.62) +
        localContrast * 0.22 +
        alphaEdge * 0.2 +
        dither;
      density = clamp(density);

      const visibilityGate = thresholdNorm * (0.72 + (1 - alpha) * 0.24);
      if (density < visibilityGate && alphaEdge < 0.18 && localContrast < 0.18) {
        line += " ";
        continue;
      }

      const rampIndex = Math.max(1, Math.round(density * (ramp.length - 1)));
      line += ramp[Math.min(rampIndex, ramp.length - 1)];
    }

    result.push(line);
  }

  return trimAscii(result);
}

/**
 * 이미지를 ASCII 라인 배열로 변환해 반환하는 훅이다.
 *
 * @param src 이미지 경로
 * @param cols ASCII 열 수
 * @param options 변환 옵션
 * @returns 변환된 라인 배열과 로딩 상태
 */
export function useImageToAscii(
  src: string,
  cols: number = 50,
  options?: {
    flip?: boolean;
    brightnessThreshold?: number;
    contrast?: number;
    exposure?: number;
    alphaThreshold?: number;
    blackPoint?: number;
    whitePoint?: number;
    ramp?: string;
    spriteSheet?: { frameCount: number; interval: number };
  },
) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const framesRef = useRef<string[][]>([]);

  const flip = options?.flip ?? true;
  const threshold = options?.brightnessThreshold ?? 30;
  const contrast = options?.contrast ?? 1.2;
  const exposure = options?.exposure ?? 1.04;
  const alphaThreshold = options?.alphaThreshold ?? 20;
  const blackPoint = options?.blackPoint ?? 0.08;
  const whitePoint = options?.whitePoint ?? 0.92;
  const ramp = options?.ramp ?? DEFAULT_ASCII_RAMP;
  const frameCount = options?.spriteSheet?.frameCount ?? 1;
  const frameInterval = options?.spriteSheet?.interval ?? 0;

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    framesRef.current = [];

    img.onload = () => {
      if (cancelled) {
        return;
      }

      const singleFrameWidth = img.width / frameCount;
      const allFrames: string[][] = [];

      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        allFrames.push(
          frameToAscii(img, frameIndex * singleFrameWidth, singleFrameWidth, cols, {
            flip,
            threshold,
            contrast,
            exposure,
            alphaThreshold,
            blackPoint,
            whitePoint,
            ramp,
          }),
        );
      }

      framesRef.current = allFrames;
      setLines(allFrames[0] ?? []);
      setLoading(false);
    };

    img.onerror = () => {
      if (cancelled) {
        return;
      }

      setLines(["[image load error]"]);
      setLoading(false);
    };

    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [
    src,
    cols,
    flip,
    threshold,
    contrast,
    exposure,
    alphaThreshold,
    blackPoint,
    whitePoint,
    ramp,
    frameCount,
  ]);

  useEffect(() => {
    if (frameCount <= 1 || frameInterval <= 0 || loading) return;

    let current = 0;
    const id = window.setInterval(() => {
      current = (current + 1) % frameCount;
      if (framesRef.current[current]) {
        setLines(framesRef.current[current]);
      }
    }, frameInterval);

    return () => window.clearInterval(id);
  }, [frameCount, frameInterval, loading]);

  return { lines, loading };
}
