import { useEffect, useRef } from "react";

const ASCII_RAMP = " .·:;=+*#%@";

interface SkullEncounterProps {
  onComplete: () => void;
}

// Duration (ms) to show the animated WebP before proceeding
const DISPLAY_DURATION = 4000;
const FPS = 12;
const COLS = 120;
const CHAR_W = 8;
const CHAR_H = 12;
const CHAR_ASPECT = 0.55;

// Zoom: starts at full view, ends zoomed 8× into the mouth area
const ZOOM_START = 2.0;
const ZOOM_END = 15.0;
// Mouth focus point (normalized 0–1) — center-x, ~65% down
const FOCUS_X = 0.5;
const FOCUS_Y = 0.75;

export default function SkullEncounter({ onComplete }: SkullEncounterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let completed = false;
    let aborted = false;

    async function start() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;

      // Fetch animated WebP and decode frames via ImageDecoder (WebCodecs)
      const response = await fetch("/assets/combat.webp");

      const decoder = new ImageDecoder({
        data: response.body!,
        type: "image/webp",
      });

      await decoder.tracks.ready;
      if (aborted) return;

      const track = decoder.tracks.selectedTrack!;
      const frameCount = track.frameCount;

      // Decode first frame to get dimensions
      const firstResult = await decoder.decode({ frameIndex: 0 });
      const vw = firstResult.image.displayWidth;
      const vh = firstResult.image.displayHeight;
      firstResult.image.close();

      // Compute fixed ROWS from full aspect ratio
      const fullAspect = vh / vw;
      const ROWS = Math.round(COLS * fullAspect * CHAR_ASPECT);

      // Offscreen sampling canvas
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = COLS;
      sampleCanvas.height = ROWS;
      const sampleCtx = sampleCanvas.getContext("2d")!;

      // Size display canvas
      canvas.width = COLS * CHAR_W;
      canvas.height = ROWS * CHAR_H;

      const frameInterval = 1000 / FPS;
      let lastFrame = 0;
      let frameIndex = 0;
      const startTime = performance.now();

      // Offscreen canvas for VideoFrame → 2D context bridge
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = vw;
      frameCanvas.height = vh;
      const frameCtx = frameCanvas.getContext("2d")!;

      async function render(now: number) {
        if (completed || aborted) return;

        const elapsed = now - startTime;

        // Auto-proceed after duration
        if (elapsed >= DISPLAY_DURATION) {
          completed = true;
          decoder.close();
          onComplete();
          return;
        }

        if (now - lastFrame >= frameInterval) {
          lastFrame = now;

          // Zoom progress: 0 → 1 with easeIn curve for accelerating dive
          const t = Math.min(elapsed / DISPLAY_DURATION, 1);
          const eased = t * t * t; // cubic ease-in — slow start, fast dive
          const zoom = ZOOM_START + (ZOOM_END - ZOOM_START) * eased;

          // Compute crop window centered on mouth, shrinking as zoom increases
          const cropW = vw / zoom;
          const cropH = vh / zoom;
          // Focus point in pixel coords, clamped so crop stays in bounds
          let cropX = FOCUS_X * vw - cropW / 2;
          let cropY = FOCUS_Y * vh - cropH / 2;
          cropX = Math.max(0, Math.min(cropX, vw - cropW));
          cropY = Math.max(0, Math.min(cropY, vh - cropH));

          try {
            const result = await decoder.decode({ frameIndex });
            if (aborted) {
              result.image.close();
              return;
            }

            // Draw decoded VideoFrame → offscreen canvas
            frameCtx.clearRect(0, 0, vw, vh);
            frameCtx.drawImage(result.image, 0, 0);
            result.image.close();

            // Sample zoomed crop
            sampleCtx.clearRect(0, 0, COLS, ROWS);
            sampleCtx.drawImage(
              frameCanvas,
              cropX, cropY, cropW, cropH,
              0, 0, COLS, ROWS,
            );
            const imgData = sampleCtx.getImageData(0, 0, COLS, ROWS);
            const data = imgData.data;

            // Fade to black at the very end (last 15%)
            const fadeT = t > 0.85 ? (t - 0.85) / 0.15 : 0;
            const globalAlphaMul = 1 - fadeT;

            // Draw grayscale ASCII
            ctx.fillStyle = "#0d0d0d";
            ctx.fillRect(0, 0, canvas!.width, canvas!.height);
            ctx.font = `${CHAR_H - 1}px 'Courier New', monospace`;
            ctx.textBaseline = "top";

            for (let y = 0; y < ROWS; y++) {
              for (let x = 0; x < COLS; x++) {
                const i = (y * COLS + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

                if (brightness < 20) continue;

                const idx = Math.floor(
                  (brightness / 255) * (ASCII_RAMP.length - 1),
                );
                const ch = ASCII_RAMP[Math.min(idx, ASCII_RAMP.length - 1)];

                // Grayscale with global fade
                const v = Math.floor(140 + (brightness / 255) * 115);
                const alpha = (0.4 + (brightness / 255) * 0.6) * globalAlphaMul;
                ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${alpha})`;
                ctx.fillText(ch, x * CHAR_W, y * CHAR_H);
              }
            }
          } catch {
            // frame decode error — skip
          }

          frameIndex = (frameIndex + 1) % frameCount;
        }

        rafRef.current = requestAnimationFrame(render);
      }

      rafRef.current = requestAnimationFrame(render);
    }

    start();

    return () => {
      aborted = true;
      completed = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete]);

  return (
    <div className="skull-encounter">
      <canvas ref={canvasRef} className="skull-canvas" />
    </div>
  );
}
