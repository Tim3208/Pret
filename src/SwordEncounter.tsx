import { useEffect, useRef, useState } from "react";

// Two crossed swords ASCII art
const SWORD_LEFT = [
  "        /|",
  "       / |",
  "      /  |",
  "     /   |",
  "    /    |",
  "   /     |",
  "  /______|",
  "  \\      /",
  "   \\    / ",
  "    \\  /  ",
  "     \\/   ",
  "     ||   ",
  "     ||   ",
  "     /\\   ",
  "    /  \\  ",
];

const SWORD_RIGHT = [
  "  |\\      ",
  "  | \\     ",
  "  |  \\    ",
  "  |   \\   ",
  "  |    \\  ",
  "  |     \\ ",
  "  |______\\",
  "  \\      /",
  "   \\    / ",
  "    \\  /  ",
  "     \\/   ",
  "     ||   ",
  "     ||   ",
  "     /\\   ",
  "    /  \\  ",
];

const CROSSED = [
  "         /|    |\\         ",
  "        / |    | \\        ",
  "       /  |    |  \\       ",
  "      /   |    |   \\      ",
  "     / ___\\_/\\_/___  \\    ",
  "    /_/    \\ /     \\_  \\  ",
  "       \\   X   /         ",
  "        \\ / \\ /          ",
  "         X   X           ",
  "        / \\ / \\          ",
  "       /   X   \\         ",
  "      /   / \\   \\        ",
  "     /   /   \\   \\       ",
  "         |   |           ",
  "         |   |           ",
  "        _|   |_          ",
  "       |___|___|         ",
];

interface SwordEncounterProps {
  onComplete: () => void;
}

export default function SwordEncounter({ onComplete }: SwordEncounterProps) {
  const [phase, setPhase] = useState<"clash" | "sparks" | "idle">("clash");
  const [sparkFrame, setSparkFrame] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const intervalRef = useRef<number>();

  // Fade in
  useEffect(() => {
    const start = performance.now();
    function fadeIn(now: number) {
      const t = Math.min((now - start) / 800, 1);
      setOpacity(t);
      if (t < 1) requestAnimationFrame(fadeIn);
      else setPhase("sparks");
    }
    requestAnimationFrame(fadeIn);
  }, []);

  // Spark flicker animation
  useEffect(() => {
    if (phase !== "sparks") return;
    let frame = 0;
    intervalRef.current = window.setInterval(() => {
      frame++;
      setSparkFrame(frame);
      if (frame > 12) {
        setPhase("idle");
        clearInterval(intervalRef.current);
      }
    }, 120);
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  const sparkChars = ["*", "+", "✦", "·", "⚡", "×"];
  const sparkOverlay =
    phase === "sparks" || phase === "idle"
      ? sparkFrame % 2 === 0
        ? sparkChars[sparkFrame % sparkChars.length]
        : ""
      : "";

  const handleClick = () => {
    if (phase !== "idle") return;
    // Fade out and notify parent
    const el = document.querySelector(".sword-container") as HTMLElement;
    if (el) {
      el.style.transition = "opacity 0.6s, filter 0.6s";
      el.style.opacity = "0";
      el.style.filter = "blur(4px)";
      setTimeout(onComplete, 650);
    } else {
      onComplete();
    }
  };

  return (
    <div
      className="sword-container"
      style={{ opacity, cursor: phase === "idle" ? "pointer" : "default" }}
      onClick={handleClick}
    >
      <pre className="sword-ascii">
        {CROSSED.map((line, i) => (
          <span key={i}>
            {line}
            {i === 6 && sparkOverlay ? (
              <span className="sword-spark">{` ${sparkOverlay}`}</span>
            ) : null}
            {"\n"}
          </span>
        ))}
      </pre>
      {phase === "idle" && (
        <p className="sword-hint fadeIn">{"[ click to engage ]"}</p>
      )}
    </div>
  );
}
