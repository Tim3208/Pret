import { useEffect, useRef, useState } from "react";

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
  const [fadingOut, setFadingOut] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();

    const fadeIn = (now: number) => {
      const progress = Math.min((now - start) / 800, 1);
      setOpacity(progress);

      if (progress < 1) {
        requestAnimationFrame(fadeIn);
      } else {
        setPhase("sparks");
      }
    };

    requestAnimationFrame(fadeIn);
  }, []);

  useEffect(() => {
    if (phase !== "sparks") return;

    let frame = 0;
    intervalRef.current = window.setInterval(() => {
      frame += 1;
      setSparkFrame(frame);

      if (frame > 12) {
        setPhase("idle");
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
        }
      }
    }, 120);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [phase]);

  const sparkChars = ["*", "+", "x", ".", "o", "#"];
  const sparkOverlay =
    phase === "sparks" || phase === "idle"
      ? sparkFrame % 2 === 0
        ? sparkChars[sparkFrame % sparkChars.length]
        : ""
      : "";

  const handleClick = () => {
    if (phase !== "idle") return;
    setFadingOut(true);
    window.setTimeout(onComplete, 650);
  };

  return (
    <div
      className={`flex flex-col items-center transition-[opacity,filter] duration-700 ${
        fadingOut ? "opacity-0 blur-[4px]" : ""
      }`}
      style={{ opacity, cursor: phase === "idle" ? "pointer" : "default" }}
      onClick={handleClick}
    >
      <pre className="m-0 whitespace-pre text-center text-[0.95rem] leading-[1.1] text-ash [text-shadow:0_0_6px_rgba(255,255,255,0.12)]">
        {CROSSED.map((line, index) => (
          <span key={index}>
            {line}
            {index === 6 && sparkOverlay ? (
              <span className="text-ember">{` ${sparkOverlay}`}</span>
            ) : null}
            {"\n"}
          </span>
        ))}
      </pre>
      {phase === "idle" && (
        <p className="mt-4 text-sm tracking-[0.12em] text-white/50 opacity-0 [animation:fade_1s_0.6s_forwards]">
          {"[ click to engage ]"}
        </p>
      )}
    </div>
  );
}
