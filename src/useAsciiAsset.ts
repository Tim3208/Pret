import { useEffect, useState } from "react";

function trimAscii(lines: string[]): string[] {
  if (lines.length === 0) return [];

  let top = 0;
  while (top < lines.length && lines[top].trim() === "") top += 1;

  let bottom = lines.length - 1;
  while (bottom >= top && lines[bottom].trim() === "") bottom -= 1;

  const croppedRows = lines.slice(top, bottom + 1);
  if (croppedRows.length === 0) return [];

  let left = Number.POSITIVE_INFINITY;
  let right = -1;

  for (const line of croppedRows) {
    const firstChar = line.search(/\S/);
    if (firstChar === -1) continue;
    left = Math.min(left, firstChar);

    let lastChar = line.length - 1;
    while (lastChar >= 0 && line[lastChar] === " ") lastChar -= 1;
    right = Math.max(right, lastChar);
  }

  if (!Number.isFinite(left) || right < left) {
    return croppedRows;
  }

  return croppedRows.map((line) => line.slice(left, right + 1));
}

function parseAsciiAsset(raw: string): string[] {
  // The authored ASCII files sometimes contain Korean guide labels used while aligning sprites.
  // Strip those lines so the runtime renderer only sees drawable glyph rows.
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !/[가-힣]/.test(line));

  return trimAscii(lines);
}

export function useAsciiAsset(path: string) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load ASCII asset: ${response.status}`);
        }

        const raw = await response.text();
        if (!cancelled) {
          setLines(parseAsciiAsset(raw));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLines(["[ascii load error]"]);
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { lines, loading };
}