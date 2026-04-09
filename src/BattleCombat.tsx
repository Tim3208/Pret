import {
  type FormEvent,
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type LayoutLine,
  type PreparedTextWithSegments,
  layoutWithLines,
  prepareWithSegments,
} from "@chenglou/pretext";
import CrtOverlay from "./CrtOverlay";
import HeartHP from "./HeartHP";
import ManaFlask from "./ManaFlask";
import {
  type BattleLogEntry,
  type MonsterIntent,
  type PlayerAction,
  type PlayerStats,
  findSpell,
} from "./battleTypes";

/* ================================================================
   Types
   ================================================================ */

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
  monsterHp: number;
  monsterMaxHp: number;
  monsterShield: number;
  nextIntent: MonsterIntent;
  battleLog: BattleLogEntry[];
  ambientText: string;
  turn: "player" | "monster";
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerShield: number;
  playerStats: PlayerStats;
  onAction: (action: PlayerAction) => void;
  projectileCallbackRef: MutableRefObject<
    ((word: string, fromPlayer: boolean) => void) | null
  >;
}

/* ================================================================
   Pretext helpers — character-level physics displacement
   ================================================================ */

const CRT_FONT = "500 13px 'Courier New', Courier, monospace";
const W = 480;
const H = 320;
const LINE_H = 18;
const PAD = 14;
const TEXT_W = W - PAD * 2;
/** Radius within which a projectile displaces characters */
const DISPLACE_RADIUS = 90;
/** Maximum pixel push in Y */
const DISPLACE_Y = 18;
/** Maximum pixel push in X */
const DISPLACE_X = 10;

const preparedCache = new Map<string, PreparedTextWithSegments>();

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = font + "::" + text;
  const cached = preparedCache.get(key);
  if (cached) return cached;
  const prepared = prepareWithSegments(text, font);
  preparedCache.set(key, prepared);
  if (preparedCache.size > 200) {
    const first = preparedCache.keys().next().value;
    if (first) preparedCache.delete(first);
  }
  return prepared;
}

function getLayoutLines(text: string): LayoutLine[] {
  if (!text) return [];
  try {
    const prepared = getPrepared(text, CRT_FONT);
    return layoutWithLines(prepared, TEXT_W, LINE_H).lines;
  } catch {
    return [{ text, width: TEXT_W, start: { segmentIndex: 0, graphemeIndex: 0 }, end: { segmentIndex: 0, graphemeIndex: 0 } }];
  }
}

/**
 * Render a text block character-by-character.
 * Each character is displaced away from nearby projectiles
 * using a smooth force falloff — producing the "water flowing
 * around a rock" effect from the old version.
 */
function renderTextBlockPhysics(
  ctx: CanvasRenderingContext2D,
  text: string,
  fillStyle: string,
  startY: number,
  projectiles: Projectile[],
): number {
  const lines = getLayoutLines(text);
  if (lines.length === 0) return startY;

  ctx.font = CRT_FONT;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const baseY = startY + li * LINE_H;
    let cx = PAD;

    for (let ci = 0; ci < line.text.length; ci++) {
      const ch = line.text[ci];
      const charW = ctx.measureText(ch).width;

      // Accumulate displacement from all nearby projectiles
      let offsetX = 0;
      let offsetY = 0;
      let alpha = parseBaseAlpha(fillStyle);

      for (const p of projectiles) {
        if (!p.alive) continue;
        const dx = cx - p.x;
        const dy = baseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < DISPLACE_RADIUS) {
          const force = (DISPLACE_RADIUS - dist) / DISPLACE_RADIUS;
          const forceSquared = force * force; // smoother falloff
          offsetY += (dy > 0 ? 1 : -1) * forceSquared * DISPLACE_Y;
          offsetX += (dx > 0 ? 1 : -1) * forceSquared * DISPLACE_X;
          alpha = Math.max(0.08, alpha - force * 0.45);
        }
      }

      ctx.fillStyle = replaceAlpha(fillStyle, alpha);
      ctx.fillText(ch, cx + offsetX, baseY + offsetY);
      cx += charW;
    }
  }

  return startY + lines.length * LINE_H;
}

/** Extract the alpha value from an rgba() string, default 0.75. */
function parseBaseAlpha(rgba: string): number {
  const m = rgba.match(/,\s*([\d.]+)\s*\)/);
  return m ? Number(m[1]) : 0.75;
}

/** Replace the alpha in an rgba() string. */
function replaceAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/,\s*[\d.]+\s*\)/, `, ${alpha.toFixed(2)})`);
}

/** Map tailwind color classes to approximate canvas RGBA */
function classToCanvasColor(cls?: string): string {
  if (!cls) return "rgba(180, 180, 180, 0.6)";
  if (cls.includes("ember")) return "rgba(255, 170, 0, 0.85)";
  if (cls.includes("sky")) return "rgba(100, 200, 255, 0.8)";
  if (cls.includes("blue")) return "rgba(80, 160, 255, 0.75)";
  if (cls.includes("cyan")) return "rgba(80, 220, 240, 0.8)";
  if (cls.includes("teal")) return "rgba(80, 200, 180, 0.75)";
  if (cls.includes("red")) return "rgba(255, 90, 70, 0.8)";
  if (cls.includes("orange")) return "rgba(255, 170, 80, 0.8)";
  if (cls.includes("green")) return "rgba(80, 220, 100, 0.75)";
  if (cls.includes("purple")) return "rgba(180, 120, 255, 0.75)";
  if (cls.includes("yellow")) return "rgba(255, 220, 80, 0.85)";
  if (cls.includes("gray")) return "rgba(150, 150, 150, 0.5)";
  return "rgba(180, 180, 180, 0.6)";
}

/* ================================================================
   Component
   ================================================================ */

export default function BattleCombat({
  monsterName,
  monsterAscii,
  playerAscii,
  monsterHp,
  monsterMaxHp,
  monsterShield,
  nextIntent,
  battleLog,
  ambientText,
  turn,
  playerHp,
  playerMaxHp,
  playerMana,
  playerMaxMana,
  playerShield,
  playerStats,
  onAction,
  projectileCallbackRef,
}: BattleCombatProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeMonster, setShakeMonster] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const glitchStateRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  /* Keep text data in a ref so the RAF loop never needs to restart */
  const textRef = useRef({ nextIntent, monsterShield, ambientText, battleLog });
  textRef.current = { nextIntent, monsterShield, ambientText, battleLog };

  const hpRatio = monsterMaxHp > 0 ? monsterHp / monsterMaxHp : 1;
  const monsterColor =
    hpRatio > 0.75
      ? "text-[rgba(200,200,200,0.85)]"
      : hpRatio > 0.5
        ? "text-[rgba(220,160,140,0.85)]"
        : hpRatio > 0.25
          ? "text-[rgba(255,100,80,0.9)]"
          : "text-[rgba(200,30,30,0.95)]";

  // ── Projectile callback ──
  useEffect(() => {
    projectileCallbackRef.current = (word: string, fromPlayer: boolean) => {
      if (!word) return;
      const canvas = canvasRef.current;
      const cw = canvas?.width ?? W;
      const ch = canvas?.height ?? H;

      projectilesRef.current.push({
        chars: word.split(""),
        x: fromPlayer ? -40 : cw + 40,
        y: ch / 2 + (Math.random() - 0.5) * 80,
        vx: fromPlayer ? 5 + Math.random() * 2 : -5 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        alive: true,
        fromPlayer,
        offsets: word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
      });

      if (fromPlayer) {
        window.setTimeout(() => {
          setShakeMonster(true);
          window.setTimeout(() => setShakeMonster(false), 300);
        }, 600);
      } else {
        window.setTimeout(() => {
          setShakePlayer(true);
          window.setTimeout(() => setShakePlayer(false), 300);
        }, 600);
      }
    };
    return () => {
      projectileCallbackRef.current = null;
    };
  }, [projectileCallbackRef]);

  // ── Canvas loop — pretext dynamic layout + projectiles ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      const {
        nextIntent: intent,
        monsterShield: mShield,
        ambientText: ambient,
        battleLog: log,
      } = textRef.current;
      const projectiles = projectilesRef.current;

      ctx.font = CRT_FONT;
      ctx.textBaseline = "top";

      let y = 12;

      // 1. Monster intent (orange, highest priority)
      y = renderTextBlockPhysics(
        ctx,
        `> ${intent.label}`,
        "rgba(255, 170, 60, 0.85)",
        y,
        projectiles,
      );
      y += 4;

      if (mShield > 0) {
        y = renderTextBlockPhysics(
          ctx,
          `  [Shield: ${mShield}]`,
          "rgba(100, 180, 255, 0.6)",
          y,
          projectiles,
        );
      }

      // 2. Ambient text (dim, medium priority)
      y = renderTextBlockPhysics(
        ctx,
        ambient,
        "rgba(180, 180, 180, 0.5)",
        y,
        projectiles,
      );
      y += 4;

      // Separator
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(PAD, y, W - PAD * 2, 1);
      y += 8;

      // 3. Battle log (scrolls up)
      const maxLogLines = Math.floor((H - y - 10) / LINE_H);
      const visibleLog = log.slice(-maxLogLines);

      for (const entry of visibleLog) {
        ctx.font = CRT_FONT;
        y = renderTextBlockPhysics(
          ctx,
          entry.text,
          classToCanvasColor(entry.color),
          y,
          projectiles,
        );
      }

      // ── Projectiles ──
      let anyCrossing = false;

      for (const p of projectiles) {
        if (!p.alive) continue;
        p.x += p.vx;
        p.y += p.vy;

        p.offsets.forEach((o) => {
          o.dx += (Math.random() - 0.5) * 0.4;
          o.dy += (Math.random() - 0.5) * 0.4;
          o.rot += (Math.random() - 0.5) * 0.03;
        });

        if (p.x > 0 && p.x < W) anyCrossing = true;

        ctx.save();
        ctx.font = "bold 18px 'Courier New', monospace";
        ctx.fillStyle = p.fromPlayer
          ? "rgba(100, 220, 255, 0.9)"
          : "rgba(255, 80, 60, 0.9)";
        ctx.shadowColor = p.fromPlayer
          ? "rgba(100, 220, 255, 0.4)"
          : "rgba(255, 80, 60, 0.4)";
        ctx.shadowBlur = 16;

        for (let i = 0; i < p.chars.length; i += 1) {
          const o = p.offsets[i];
          ctx.save();
          ctx.translate(p.x + i * 14 + o.dx, p.y + o.dy);
          ctx.rotate(o.rot);
          ctx.fillText(p.chars[i], 0, 0);
          ctx.restore();
        }
        ctx.restore();

        if (
          (p.fromPlayer && p.x > W + 20) ||
          (!p.fromPlayer && p.x < -20) ||
          p.x < -200 ||
          p.x > W + 200
        ) {
          p.alive = false;
        }
      }

      if (glitchStateRef.current !== anyCrossing) {
        glitchStateRef.current = anyCrossing;
        setGlitchActive(anyCrossing);
      }

      projectilesRef.current = projectiles.filter((p) => p.alive);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // stable — reads from textRef

  // Auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleLog]);

  // ── Keyboard navigation ──
  useEffect(() => {
    if (turn !== "player") return;

    const handler = (e: KeyboardEvent) => {
      if (showPrompt) {
        if (e.key === "Escape") {
          setShowPrompt(false);
          setPromptInput("");
        }
        return;
      }
      if (e.key === "ArrowUp" || e.key === "w") {
        setSelectedIndex((v) => (v <= 0 ? 2 : v - 1));
      } else if (e.key === "ArrowDown" || e.key === "s") {
        setSelectedIndex((v) => (v >= 2 ? 0 : v + 1));
      } else if (e.key === "Enter") {
        executeChoice(selectedIndex);
      } else if (e.key === "1") {
        executeChoice(0);
      } else if (e.key === "2") {
        executeChoice(1);
      } else if (e.key === "3") {
        executeChoice(2);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [turn, showPrompt, selectedIndex]);

  const executeChoice = useCallback(
    (index: number) => {
      if (index === 0) {
        onAction({ type: "attack" });
      } else if (index === 1) {
        onAction({ type: "defend" });
      } else {
        setShowPrompt(true);
      }
    },
    [onAction],
  );

  // ── Prompt submit ──
  const handlePromptSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (turn !== "player") return;

      const raw = promptInput.trim();
      if (!raw) return;

      const isDefendMode = raw.toLowerCase().startsWith("defend:");
      const spellQuery = isDefendMode ? raw.slice(7).trim() : raw;

      const spell = findSpell(spellQuery);
      if (spell) {
        const mode =
          isDefendMode && spell.modes.includes("defend")
            ? ("defend" as const)
            : ("attack" as const);
        onAction({ type: "spell", spell, mode });
      } else {
        const lower = raw.toLowerCase();
        if (
          lower.includes("heal") ||
          lower.includes("breath") ||
          lower.includes("rest") ||
          lower.includes("호흡") ||
          lower.includes("회복")
        ) {
          onAction({ type: "heal" });
        } else {
          onAction({ type: "attack" });
        }
      }

      setPromptInput("");
      setShowPrompt(false);
    },
    [turn, promptInput, onAction],
  );

  // Reset prompt on monster turn
  useEffect(() => {
    if (turn === "monster") {
      setShowPrompt(false);
      setPromptInput("");
    }
  }, [turn]);

  const CHOICES = [
    { key: "1", label: "Attack" },
    { key: "2", label: "Defend" },
    { key: "3", label: ">_" },
  ];

  return (
    <div className="flex w-full max-w-[1200px] flex-col items-center justify-center gap-6 px-4 animate-fade-in-quick lg:flex-row lg:gap-8">
      {/* Player ASCII */}
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

      {/* Center panel */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
        {/* HP + Mana — right above CRT */}
        <div className="flex items-center gap-4">
          <HeartHP current={playerHp} max={playerMaxHp} shield={playerShield} />
          <ManaFlask current={playerMana} max={playerMaxMana} />
        </div>

        {/* CRT container — all text lives here */}
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

        {/* Terminal-style choices (OUTSIDE CRT, below) */}
        {turn === "player" && !showPrompt && (
          <div className="w-full max-w-[480px] font-crt text-[0.9rem]">
            {CHOICES.map((c, i) => (
              <div
                key={c.key}
                className={`cursor-pointer px-3 py-1 tracking-[0.06em] transition-colors duration-100 ${
                  selectedIndex === i
                    ? "text-ember [text-shadow:0_0_6px_rgba(255,170,0,0.4)]"
                    : "text-ash/50 hover:text-ash/80"
                }`}
                onClick={() => executeChoice(i)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {selectedIndex === i ? "> " : "  "}
                [{c.key}] {c.label}
              </div>
            ))}
          </div>
        )}

        {/* Direct input prompt */}
        {turn === "player" && showPrompt && (
          <div className="w-full max-w-[480px]">
            <form
              onSubmit={handlePromptSubmit}
              className="flex items-center gap-2"
            >
              <span className="font-bold text-ember">{">"}</span>
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="cast a spell, heal, or act..."
                autoFocus
                className="min-w-0 flex-1 border-0 border-b border-ember/30 bg-transparent text-[1rem] text-ember outline-none placeholder:text-white/25 focus:border-ember sm:text-[1.1rem]"
              />
              <button
                type="button"
                onClick={() => setShowPrompt(false)}
                className="cursor-pointer border-0 bg-transparent text-[0.8rem] text-white/40 hover:text-white/70"
              >
                [ESC]
              </button>
            </form>
            <p className="mt-1 text-[0.6rem] text-white/20">
              Spell names, "defend:Stone", "heal", or anything you can think of.
              MP: {playerMana}
            </p>
          </div>
        )}

        {/* Monster turn */}
        {turn === "monster" && (
          <p className="m-0 text-center text-[0.95rem] tracking-[0.1em] text-[rgba(255,100,80,0.5)] animate-wait-blink">
            {monsterName} acts...
          </p>
        )}

        <div ref={logEndRef} />
      </div>

      {/* Monster ASCII */}
      <div
        className={`flex shrink-0 items-end transition-transform duration-100 ${
          shakeMonster ? "animate-sprite-shake" : ""
        }`}
      >
        <pre
          className={`m-0 whitespace-pre text-[4px] leading-[5px] select-none sm:text-[5px] sm:leading-[6px] transition-colors duration-500 ${
            shakeMonster ? "text-[rgba(255,80,80,0.9)]" : monsterColor
          }`}
        >
          {monsterAscii.join("\n")}
        </pre>
      </div>
    </div>
  );
}
