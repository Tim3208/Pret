import { useEffect, useRef, useState } from "react";

/**
 * 밝기를 아스키 문자 밀도로 바꿀 때 사용할 문자 램프다.
 */
const ASCII_RAMP = " .:-=+*#%@";

/**
 * 한 프레임 영역의 픽셀 데이터를 ASCII 줄 배열로 변환한다.
 */
function frameToAscii(
  img: HTMLImageElement,
  srcX: number,
  srcW: number,
  cols: number,
  flip: boolean,
  threshold: number,
): string[] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const charAspect = 0.55;
  const aspect = img.height / srcW;
  const rows = Math.round(cols * aspect * charAspect);

  canvas.width = cols;
  canvas.height = rows;

  if (flip) {
    ctx.translate(cols, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(img, srcX, 0, srcW, img.height, 0, 0, cols, rows);

  const imgData = ctx.getImageData(0, 0, cols, rows);
  const data = imgData.data;

  // Build alpha map for edge detection
  const alphaMap: number[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      alphaMap.push(data[(y * cols + x) * 4 + 3]);
    }
  }

  const result: string[] = [];
  for (let y = 0; y < rows; y += 1) {
    let line = "";
    for (let x = 0; x < cols; x += 1) {
      const i = (y * cols + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      if (a < 50) {
        line += " ";
        continue;
      }

      if (brightness < threshold && a >= 50) {
        line += " ";
        continue;
      }

      // For bright/white sprites: use alpha + edge detection for variety
      // Compute edge intensity from alpha differences with neighbors
      let edgeSum = 0;
      const centerAlpha = alphaMap[y * cols + x];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dy === 0 && dx === 0) continue;
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) {
            edgeSum += centerAlpha;
          } else {
            edgeSum += Math.abs(centerAlpha - alphaMap[ny * cols + nx]);
          }
        }
      }
      const edgeFactor = Math.min(edgeSum / (255 * 4), 1);

      // Blend brightness-based index with edge: edges get lighter chars, interior heavier
      const brightnessNorm = brightness / 255;
      const alphaNorm = a / 255;
      const density = alphaNorm * (1 - edgeFactor * 0.7) * brightnessNorm;
      const idx = Math.floor(density * (ASCII_RAMP.length - 1));
      line += ASCII_RAMP[Math.max(1, Math.min(idx, ASCII_RAMP.length - 1))];
    }
    result.push(line);
  }

  let start = 0;
  while (start < result.length && result[start].trim() === "") start += 1;
  let end = result.length - 1;
  while (end > start && result[end].trim() === "") end -= 1;

  return result.slice(start, end + 1);
}

/**
 * 이미지를 불러와 밝은 픽셀을 ASCII 문자 배열로 변환하는 훅이다.
 * 필요할 경우 좌우 반전과 밝기 임계값 조정을 함께 수행한다.
 * spriteSheet 옵션을 주면 가로로 나열된 프레임을 주기적으로 순환한다.
 *
 * @param src 불러올 이미지 경로
 * @param cols 변환 결과의 목표 열 수
 * @param options 반전 여부와 밝기 임계값 옵션
 */
export function useImageToAscii(
  src: string,
  cols: number = 50,
  options?: {
    flip?: boolean;
    brightnessThreshold?: number;
    spriteSheet?: { frameCount: number; interval: number };
  }
) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const framesRef = useRef<string[][]>([]);

  const flip = options?.flip ?? true;
  const threshold = options?.brightnessThreshold ?? 30;
  const frameCount = options?.spriteSheet?.frameCount ?? 1;
  const frameInterval = options?.spriteSheet?.interval ?? 0;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const singleFrameWidth = img.width / frameCount;
      const allFrames: string[][] = [];

      for (let f = 0; f < frameCount; f += 1) {
        allFrames.push(
          frameToAscii(img, f * singleFrameWidth, singleFrameWidth, cols, flip, threshold),
        );
      }

      framesRef.current = allFrames;
      setLines(allFrames[0]);
      setLoading(false);
    };

    img.onerror = () => {
      setLines(["[image load error]"]);
      setLoading(false);
    };

    img.src = src;
  }, [src, cols, flip, threshold, frameCount]);

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
