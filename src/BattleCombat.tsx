import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import CrtOverlay from "./CrtOverlay";

interface Projectile {
  chars: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  fromPlayer: boolean;
  offsets: { dx: number; dy: number; rot: number }[];
}

interface BattleCombatProps {
  monsterName: string;
  monsterAscii: string[];
  playerAscii: string[];
  narratives: string[];
  onPlayerHit: (damage: number) => void;
  onMonsterHit: (damage: number) => void;
  turn: "player" | "monster";
  onTurnEnd: () => void;
}

const FONT = "500 15px 'Courier New', Courier, monospace";
const LINE_HEIGHT = 24;
const TEXT_WIDTH = 380;

export default function BattleCombat({
  monsterName,
  monsterAscii,
  playerAscii,
  narratives,
  onPlayerHit,
  onMonsterHit,
  turn,
  onTurnEnd,
}: BattleCombatProps) {
  const [narrativeIndex, setNarrativeIndex] = useState(0);
  const [input, setInput] = useState("");
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeMonster, setShakeMonster] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const glitchStateRef = useRef(false);

  const rawNarrative = narratives[narrativeIndex % narratives.length];
  const keywords = [...rawNarrative.matchAll(/\[(\w+)\]/g)].map((match) => match[1]);
  const cleanNarrative = rawNarrative.replace(/\[|\]/g, "");

  const layoutLines = useMemo(() => {
    try {
      const prepared = prepareWithSegments(cleanNarrative, FONT);
      const result = layoutWithLines(prepared, TEXT_WIDTH, LINE_HEIGHT);
      return result.lines.map((line) => ({ text: line.text, width: line.width }));
    } catch {
      return [{ text: cleanNarrative, width: TEXT_WIDTH }];
    }
  }, [cleanNarrative]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const width = 480;
    const height = 320;
    canvas.width = width;
    canvas.height = height;

    const animate = () => {
      context.clearRect(0, 0, width, height);
      const projectiles = projectilesRef.current;

      context.font = FONT;
      context.textBaseline = "alphabetic";

      const totalTextHeight = layoutLines.length * LINE_HEIGHT;
      const textStartY = Math.max(40, (height - totalTextHeight) / 2);

      for (let lineIndex = 0; lineIndex < layoutLines.length; lineIndex += 1) {
        const line = layoutLines[lineIndex];
        const baseY = textStartY + lineIndex * LINE_HEIGHT;
        const lineStartX = (width - line.width) / 2;
        let currentX = lineStartX;

        for (let charIndex = 0; charIndex < line.text.length; charIndex += 1) {
          const char = line.text[charIndex];
          const charWidth = context.measureText(char).width;
          let offsetX = 0;
          let offsetY = 0;
          let alpha = 0.75;

          for (const projectile of projectiles) {
            if (!projectile.alive) continue;

            const dx = currentX - projectile.x;
            const dy = baseY - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 90) {
              const force = (90 - distance) / 90;
              offsetY += (dy > 0 ? 1 : -1) * force * 20;
              offsetX += (dx > 0 ? 1 : -1) * force * 12;
              alpha = Math.max(0.1, alpha - force * 0.5);
            }
          }

          const isKeyword = keywords.some((keyword) => {
            const keywordIndex = cleanNarrative.indexOf(keyword);
            let characterCount = 0;

            for (let prevLine = 0; prevLine < lineIndex; prevLine += 1) {
              characterCount += layoutLines[prevLine].text.length;
            }

            characterCount += charIndex;
            return characterCount >= keywordIndex && characterCount < keywordIndex + keyword.length;
          });

          context.fillStyle = isKeyword
            ? `rgba(255, 200, 60, ${alpha})`
            : `rgba(190, 190, 190, ${alpha})`;
          context.fillText(char, currentX + offsetX, baseY + offsetY);
          currentX += charWidth;
        }
      }

      let anyProjectileCrossing = false;

      for (const projectile of projectiles) {
        if (!projectile.alive) continue;

        projectile.x += projectile.vx;
        projectile.y += projectile.vy;

        projectile.offsets.forEach((offset) => {
          offset.dx += (Math.random() - 0.5) * 0.4;
          offset.dy += (Math.random() - 0.5) * 0.4;
          offset.rot += (Math.random() - 0.5) * 0.03;
        });

        if (projectile.x > 0 && projectile.x < width) {
          anyProjectileCrossing = true;
        }

        context.save();
        context.font = "bold 18px 'Courier New', monospace";
        context.fillStyle = projectile.fromPlayer
          ? "rgba(100, 220, 255, 0.9)"
          : "rgba(255, 80, 60, 0.9)";
        context.shadowColor = projectile.fromPlayer
          ? "rgba(100, 220, 255, 0.4)"
          : "rgba(255, 80, 60, 0.4)";
        context.shadowBlur = 16;

        for (let charIndex = 0; charIndex < projectile.chars.length; charIndex += 1) {
          const offset = projectile.offsets[charIndex];
          const charX = projectile.x + charIndex * 14 + offset.dx;
          const charY = projectile.y + offset.dy;

          context.save();
          context.translate(charX, charY);
          context.rotate(offset.rot);
          context.fillText(projectile.chars[charIndex], 0, 0);
          context.restore();
        }

        context.restore();

        if (projectile.fromPlayer && projectile.x > width + 20) {
          projectile.alive = false;
          onMonsterHit(3 + Math.floor(Math.random() * 3));
          setShakeMonster(true);
          window.setTimeout(() => setShakeMonster(false), 300);
        } else if (!projectile.fromPlayer && projectile.x < -20) {
          projectile.alive = false;
          onPlayerHit(2 + Math.floor(Math.random() * 3));
          setShakePlayer(true);
          window.setTimeout(() => setShakePlayer(false), 300);
        }

        if (projectile.x < -200 || projectile.x > width + 200) {
          projectile.alive = false;
        }
      }

      if (glitchStateRef.current !== anyProjectileCrossing) {
        glitchStateRef.current = anyProjectileCrossing;
        setGlitchActive(anyProjectileCrossing);
      }

      projectilesRef.current = projectiles.filter((projectile) => projectile.alive);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cleanNarrative, keywords, layoutLines, onMonsterHit, onPlayerHit]);

  useEffect(() => {
    if (turn !== "monster") return;

    const timeoutId = window.setTimeout(() => {
      const attacks = ["CLAW", "BITE", "HEX", "DARK"];
      const word = attacks[Math.floor(Math.random() * attacks.length)];
      const canvas = canvasRef.current;
      const width = canvas?.width ?? 480;
      const height = canvas?.height ?? 320;

      projectilesRef.current.push({
        chars: word.split(""),
        x: width + 40,
        y: height / 2 + (Math.random() - 0.5) * 80,
        vx: -5 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        alive: true,
        fromPlayer: false,
        offsets: word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
      });

      window.setTimeout(() => {
        setNarrativeIndex((value) => value + 1);
        onTurnEnd();
      }, 1400);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [turn, onTurnEnd]);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (turn !== "player") return;

      const word = input.trim().toUpperCase();
      if (!word) return;

      const canvas = canvasRef.current;
      const height = canvas?.height ?? 320;

      projectilesRef.current.push({
        chars: word.split(""),
        x: -40,
        y: height / 2 + (Math.random() - 0.5) * 80,
        vx: 5 + Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        alive: true,
        fromPlayer: true,
        offsets: word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
      });

      setInput("");

      window.setTimeout(() => {
        setNarrativeIndex((value) => value + 1);
        onTurnEnd();
      }, 1400);
    },
    [input, onTurnEnd, turn]
  );

  return (
    <div className="flex w-full max-w-[1200px] flex-col items-center justify-center gap-8 px-4 animate-fade-in-quick lg:flex-row lg:gap-8">
      <div
        className={`flex shrink-0 items-end transition-transform duration-100 ${
          shakePlayer ? "animate-sprite-shake" : ""
        }`}
      >
        <pre
          className={`m-0 whitespace-pre text-[4px] leading-[5px] select-none sm:text-[5px] sm:leading-[6px] ${
            shakePlayer
              ? "text-[rgba(255,80,80,0.9)]"
              : "text-[rgba(200,200,200,0.85)]"
          }`}
        >
          {playerAscii.join("\n")}
        </pre>
      </div>

      <div className="flex min-w-0 flex-col items-center gap-5">
        <div
          className={`relative overflow-hidden rounded-xl shadow-[inset_0_0_40px_rgba(0,0,0,0.5),0_0_30px_rgba(0,0,0,0.6)] ${
            glitchActive ? "animate-crt-glitch" : ""
          }`}
        >
          <canvas
            ref={canvasRef}
            className="block h-auto w-[min(92vw,480px)] max-w-full"
          />
          <CrtOverlay glitchActive={glitchActive} />
        </div>

        {turn === "player" && (
          <form onSubmit={handleSubmit} className="flex w-full max-w-[480px] items-center gap-2">
            <span className="font-bold text-ember">{">"}</span>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                keywords.length > 0 ? `${keywords.join(", ")}...` : "type to attack..."
              }
              autoFocus
              className="min-w-0 flex-1 border-0 border-b border-white/30 bg-transparent text-[1.05rem] text-ember outline-none placeholder:text-white/35 focus:border-ember sm:text-[1.2rem]"
            />
          </form>
        )}

        {turn === "monster" && (
          <p className="m-0 text-center text-[0.95rem] tracking-[0.1em] text-[rgba(255,100,80,0.5)] animate-wait-blink">
            The {monsterName} retaliates...
          </p>
        )}
      </div>

      <div
        className={`flex shrink-0 items-end transition-transform duration-100 ${
          shakeMonster ? "animate-sprite-shake" : ""
        }`}
      >
        <pre
          className={`m-0 whitespace-pre text-[4px] leading-[5px] select-none sm:text-[5px] sm:leading-[6px] ${
            shakeMonster
              ? "text-[rgba(255,80,80,0.9)]"
              : "text-[rgba(200,200,200,0.85)]"
          }`}
        >
          {monsterAscii.join("\n")}
        </pre>
      </div>
    </div>
  );
}
