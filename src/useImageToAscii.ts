import { useState, useEffect } from "react";

// ASCII density ramp: sparse → dense
const ASCII_RAMP = " .·:;=+*#%@";

/**
 * Load an image, flip it horizontally, and convert bright pixels to ASCII art.
 * Dark (background) pixels become spaces.
 */
export function useImageToAscii(
  src: string,
  cols: number = 50,
  options?: { flip?: boolean; brightnessThreshold?: number }
) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const flip = options?.flip ?? true;
  const threshold = options?.brightnessThreshold ?? 30;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // Monospace char aspect ratio compensation (~0.55 width:height)
      const charAspect = 0.55;
      const aspect = img.height / img.width;
      const rows = Math.round(cols * aspect * charAspect);

      canvas.width = cols;
      canvas.height = rows;

      // Flip horizontally if needed
      if (flip) {
        ctx.translate(cols, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(img, 0, 0, cols, rows);
      const imgData = ctx.getImageData(0, 0, cols, rows);
      const data = imgData.data;

      const result: string[] = [];
      for (let y = 0; y < rows; y++) {
        let line = "";
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Brightness (perceived luminance)
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          // Dark or transparent → space
          if (brightness < threshold || a < 50) {
            line += " ";
          } else {
            // Map brightness to ASCII ramp
            const idx = Math.floor(
              (brightness / 255) * (ASCII_RAMP.length - 1)
            );
            line += ASCII_RAMP[Math.min(idx, ASCII_RAMP.length - 1)];
          }
        }
        result.push(line);
      }

      // Trim empty leading/trailing rows
      let start = 0;
      while (start < result.length && result[start].trim() === "") start++;
      let end = result.length - 1;
      while (end > start && result[end].trim() === "") end--;

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
