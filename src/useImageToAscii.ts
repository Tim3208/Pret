import { useEffect, useState } from "react";

/**
 * 밝기를 아스키 문자 밀도로 바꿀 때 사용할 문자 램프다.
 */
const ASCII_RAMP = " .:-=+*#%@";

/**
 * 이미지를 불러와 밝은 픽셀을 ASCII 문자 배열로 변환하는 훅이다.
 * 필요할 경우 좌우 반전과 밝기 임계값 조정을 함께 수행한다.
 *
 * @param src 불러올 이미지 경로
 * @param cols 변환 결과의 목표 열 수
 * @param options 반전 여부와 밝기 임계값 옵션
 */
export function useImageToAscii(
  src: string,
  cols: number = 50,
  options?: { flip?: boolean; brightnessThreshold?: number }
) {
  /**
   * 최종적으로 변환된 ASCII 줄 목록이다.
   */
  const [lines, setLines] = useState<string[]>([]);
  /**
   * 이미지 로딩 및 변환이 진행 중인지 여부다.
   */
  const [loading, setLoading] = useState(true);

  /**
   * 좌우 반전 적용 여부다.
   */
  const flip = options?.flip ?? true;
  /**
   * 문자를 찍을 최소 밝기 기준값이다.
   */
  const threshold = options?.brightnessThreshold ?? 30;

  useEffect(() => {
    /**
     * 변환 대상 이미지 객체다.
     */
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      /**
       * 이미지를 샘플링할 오프스크린 캔버스다.
       */
      const canvas = document.createElement("canvas");
      /**
       * 오프스크린 캔버스의 2D 컨텍스트다.
       */
      const ctx = canvas.getContext("2d")!;

      /**
       * 고정폭 글자의 가로세로 비율을 보정하기 위한 상수다.
       */
      const charAspect = 0.55;
      /**
       * 원본 이미지의 세로/가로 비율이다.
       */
      const aspect = img.height / img.width;
      /**
       * 최종 ASCII 결과의 행 수다.
       */
      const rows = Math.round(cols * aspect * charAspect);

      canvas.width = cols;
      canvas.height = rows;

      if (flip) {
        ctx.translate(cols, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(img, 0, 0, cols, rows);
      /**
       * 샘플링된 이미지의 픽셀 데이터다.
       */
      const imgData = ctx.getImageData(0, 0, cols, rows);
      /**
       * 픽셀 RGBA 버퍼다.
       */
      const data = imgData.data;

      /**
       * 변환 중 누적할 ASCII 줄 목록이다.
       */
      const result: string[] = [];
      for (let y = 0; y < rows; y += 1) {
        let line = "";
        for (let x = 0; x < cols; x += 1) {
          const i = (y * cols + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          /**
           * 사람이 느끼는 밝기를 기준으로 계산한 휘도값이다.
           */
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          if (brightness < threshold || a < 50) {
            line += " ";
          } else {
            const idx = Math.floor((brightness / 255) * (ASCII_RAMP.length - 1));
            line += ASCII_RAMP[Math.min(idx, ASCII_RAMP.length - 1)];
          }
        }
        result.push(line);
      }

      /**
       * 비어 있는 상단 줄을 잘라내기 위한 시작 인덱스다.
       */
      let start = 0;
      while (start < result.length && result[start].trim() === "") start += 1;
      /**
       * 비어 있는 하단 줄을 잘라내기 위한 끝 인덱스다.
       */
      let end = result.length - 1;
      while (end > start && result[end].trim() === "") end -= 1;

      setLines(result.slice(start, end + 1));
      setLoading(false);
    };

    img.onerror = () => {
      setLines(["[image load error]"]);
      setLoading(false);
    };

    img.src = src;
  }, [src, cols, flip, threshold]);

  return { lines, loading };
}
