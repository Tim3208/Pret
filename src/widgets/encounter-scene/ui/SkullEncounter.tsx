import { useEffect, useRef } from "react";

/**
 * 밝기 값을 아스키 문자로 치환할 때 사용할 문자 램프다.
 */
const ASCII_RAMP = " .:-=+*#%@";
/**
 * 조우 애니메이션 전체 지속 시간이다.
 */
const DISPLAY_DURATION = 4000;
/**
 * WebP 프레임 샘플링 FPS다.
 */
const FPS = 12;
/**
 * ASCII 출력의 가로 문자 수다.
 */
const COLS = 120;
/**
 * ASCII 한 글자의 가로 픽셀 크기다.
 */
const CHAR_W = 8;
/**
 * ASCII 한 글자의 세로 픽셀 크기다.
 */
const CHAR_H = 12;
/**
 * 문자 비율 보정을 위한 아스키 글자 종횡비다.
 */
const CHAR_ASPECT = 0.55;
/**
 * 조우 연출 시작 시 줌 배율이다.
 */
const ZOOM_START = 2.0;
/**
 * 조우 연출 종료 직전 줌 배율이다.
 */
const ZOOM_END = 15.0;
/**
 * 줌의 중심이 되는 X 정규화 좌표다.
 */
const FOCUS_X = 0.5;
/**
 * 줌의 중심이 되는 Y 정규화 좌표다.
 */
const FOCUS_Y = 0.75;

/**
 * 해골 조우 연출이 종료되면 호출할 콜백이다.
 */
interface SkullEncounterProps {
  onComplete: () => void;
}

/**
 * animated WebP를 확대하며 ASCII로 보여 주는 조우 연출 컴포넌트다.
 *
 * @param props 종료 콜백
 */
export default function SkullEncounter({ onComplete }: SkullEncounterProps) {
  /**
   * ASCII 해골을 그릴 캔버스 요소를 참조한다.
   */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * 현재 렌더 루프의 requestAnimationFrame ID다.
   */
  const rafRef = useRef<number>(0);
  const combatAssetPath = `${import.meta.env.BASE_URL}assets/combat.webp`;

  useEffect(() => {
    let completed = false;
    let aborted = false;

    const start = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      const response = await fetch(combatAssetPath);
      const decoder = new ImageDecoder({
        data: response.body!,
        type: "image/webp",
      });

      await decoder.tracks.ready;
      if (aborted) return;

      const track = decoder.tracks.selectedTrack!;
      const frameCount = track.frameCount;
      const firstFrame = await decoder.decode({ frameIndex: 0 });
      const videoWidth = firstFrame.image.displayWidth;
      const videoHeight = firstFrame.image.displayHeight;
      firstFrame.image.close();

      const rows = Math.round(COLS * (videoHeight / videoWidth) * CHAR_ASPECT);
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = COLS;
      sampleCanvas.height = rows;
      const sampleContext = sampleCanvas.getContext("2d");
      if (!sampleContext) return;

      canvas.width = COLS * CHAR_W;
      canvas.height = rows * CHAR_H;

      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = videoWidth;
      frameCanvas.height = videoHeight;
      const frameContext = frameCanvas.getContext("2d");
      if (!frameContext) return;

      const frameInterval = 1000 / FPS;
      let lastFrame = 0;
      let frameIndex = 0;
      const startTime = performance.now();

      const render = async (now: number) => {
        if (completed || aborted) return;

        const elapsed = now - startTime;
        if (elapsed >= DISPLAY_DURATION) {
          completed = true;
          decoder.close();
          onComplete();
          return;
        }

        if (now - lastFrame >= frameInterval) {
          lastFrame = now;

          const progress = Math.min(elapsed / DISPLAY_DURATION, 1);
          const eased = progress * progress * progress;
          const zoom = ZOOM_START + (ZOOM_END - ZOOM_START) * eased;
          const cropWidth = videoWidth / zoom;
          const cropHeight = videoHeight / zoom;

          let cropX = FOCUS_X * videoWidth - cropWidth / 2;
          let cropY = FOCUS_Y * videoHeight - cropHeight / 2;
          cropX = Math.max(0, Math.min(cropX, videoWidth - cropWidth));
          cropY = Math.max(0, Math.min(cropY, videoHeight - cropHeight));

          try {
            const result = await decoder.decode({ frameIndex });
            if (aborted) {
              result.image.close();
              return;
            }

            frameContext.clearRect(0, 0, videoWidth, videoHeight);
            frameContext.drawImage(result.image, 0, 0);
            result.image.close();

            sampleContext.clearRect(0, 0, COLS, rows);
            sampleContext.drawImage(
              frameCanvas,
              cropX,
              cropY,
              cropWidth,
              cropHeight,
              0,
              0,
              COLS,
              rows
            );

            const imageData = sampleContext.getImageData(0, 0, COLS, rows);
            const data = imageData.data;
            const fadeProgress = progress > 0.85 ? (progress - 0.85) / 0.15 : 0;
            const globalAlpha = 1 - fadeProgress;

            context.fillStyle = "#0d0d0d";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.font = `${CHAR_H - 1}px 'Courier New', monospace`;
            context.textBaseline = "top";

            for (let y = 0; y < rows; y += 1) {
              for (let x = 0; x < COLS; x += 1) {
                const index = (y * COLS + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

                if (brightness < 20) continue;

                const rampIndex = Math.floor(
                  (brightness / 255) * (ASCII_RAMP.length - 1)
                );
                const character = ASCII_RAMP[Math.min(rampIndex, ASCII_RAMP.length - 1)];
                const value = Math.floor(140 + (brightness / 255) * 115);
                const alpha = (0.4 + (brightness / 255) * 0.6) * globalAlpha;

                context.fillStyle = `rgba(${value}, ${value}, ${value}, ${alpha})`;
                context.fillText(character, x * CHAR_W, y * CHAR_H);
              }
            }
          } catch {
            return;
          }

          frameIndex = (frameIndex + 1) % frameCount;
        }

        rafRef.current = requestAnimationFrame(render);
      };

      rafRef.current = requestAnimationFrame(render);
    };

    void start();

    return () => {
      aborted = true;
      completed = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [combatAssetPath, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-void animate-[fade-in-text_0.5s_ease-out]">
      <canvas ref={canvasRef} className="max-h-screen max-w-screen" />
    </div>
  );
}
