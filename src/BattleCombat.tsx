import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface Projectile {
  id: number;
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
  onPlayerHit: (dmg: number) => void;
  onMonsterHit: (dmg: number) => void;
  monsterHp: number;
  playerHp: number;
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
  monsterHp,
  playerHp,
  turn,
  onTurnEnd,
}: BattleCombatProps) {
  const [narrativeIdx, setNarrativeIdx] = useState(0);
  const [input, setInput] = useState("");
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeMonster, setShakeMonster] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const nextProjId = useRef(0);

  // Parse narrative
  const rawNarrative = narratives[narrativeIdx % narratives.length];
  const keywords = [...rawNarrative.matchAll(/\[(\w+)\]/g)].map((m) => m[1]);
  const cleanNarrative = rawNarrative.replace(/\[|\]/g, "");

  // Layout narrative text with pretext
  const [layoutLines, setLayoutLines] = useState<
    { text: string; width: number }[]
  >([]);

  useEffect(() => {
    try {
      const prepared = prepareWithSegments(cleanNarrative, FONT);
      const result = layoutWithLines(prepared, TEXT_WIDTH, LINE_HEIGHT);
      setLayoutLines(
        result.lines.map((l) => ({ text: l.text, width: l.width }))
      );
    } catch {
      setLayoutLines([{ text: cleanNarrative, width: TEXT_WIDTH }]);
    }
  }, [cleanNarrative]);

  // ─── Canvas: narrative text + projectiles (inside CRT area) ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const W = 480;
    const H = 320;
    canvas.width = W;
    canvas.height = H;

    function animate() {
      ctx.clearRect(0, 0, W, H);
      const projs = projectilesRef.current;

      // ── Center narrative text ──
      ctx.font = FONT;
      ctx.textBaseline = "alphabetic";

      // Center text block vertically
      const totalTextH = layoutLines.length * LINE_HEIGHT;
      const textStartY = Math.max(40, (H - totalTextH) / 2);

      for (let li = 0; li < layoutLines.length; li++) {
        const line = layoutLines[li];
        const baseY = textStartY + li * LINE_HEIGHT;
        // Center each line horizontally
        const lineStartX = (W - line.width) / 2;

        let cx = lineStartX;
        for (let ci = 0; ci < line.text.length; ci++) {
          const ch = line.text[ci];
          const charW = ctx.measureText(ch).width;

          let offsetY = 0;
          let offsetX = 0;
          let alpha = 0.75;
          for (const p of projs) {
            if (!p.alive) continue;
            const dx = cx - p.x;
            const dy = baseY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 90) {
              const force = (90 - dist) / 90;
              offsetY += (dy > 0 ? 1 : -1) * force * 20;
              offsetX += (dx > 0 ? 1 : -1) * force * 12;
              alpha = Math.max(0.1, alpha - force * 0.5);
            }
          }

          // Highlight keywords
          const isKeyword = keywords.some((kw) => {
            const idx = cleanNarrative.indexOf(kw);
            let charCount = 0;
            for (let l = 0; l < li; l++)
              charCount += layoutLines[l].text.length;
            charCount += ci;
            return charCount >= idx && charCount < idx + kw.length;
          });

          ctx.fillStyle = isKeyword
            ? `rgba(255, 200, 60, ${alpha})`
            : `rgba(190, 190, 190, ${alpha})`;
          ctx.fillText(ch, cx + offsetX, baseY + offsetY);
          cx += charW;
        }
      }

      // ── Projectiles ──
      let anyProjectileCrossing = false;
      for (const p of projs) {
        if (!p.alive) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.offsets.forEach((o) => {
          o.dx += (Math.random() - 0.5) * 0.4;
          o.dy += (Math.random() - 0.5) * 0.4;
          o.rot += (Math.random() - 0.5) * 0.03;
        });

        // Is projectile inside the CRT text area?
        if (p.x > 0 && p.x < W) {
          anyProjectileCrossing = true;
        }

        ctx.save();
        ctx.font = "bold 18px 'Courier New', monospace";
        const projColor = p.fromPlayer
          ? "rgba(100, 220, 255, 0.9)"
          : "rgba(255, 80, 60, 0.9)";
        const glowColor = p.fromPlayer
          ? "rgba(100, 220, 255, 0.4)"
          : "rgba(255, 80, 60, 0.4)";
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 16;
        ctx.fillStyle = projColor;

        for (let i = 0; i < p.chars.length; i++) {
          const o = p.offsets[i];
          const charX = p.x + i * 14 + o.dx;
          const charY = p.y + o.dy;
          ctx.save();
          ctx.translate(charX, charY);
          ctx.rotate(o.rot);
          ctx.fillText(p.chars[i], 0, 0);
          ctx.restore();
        }
        ctx.restore();

        // Hit detection — projectile exits canvas
        if (p.fromPlayer && p.x > W + 20) {
          p.alive = false;
          onMonsterHit(3 + Math.floor(Math.random() * 3));
          setShakeMonster(true);
          setTimeout(() => setShakeMonster(false), 300);
        } else if (!p.fromPlayer && p.x < -20) {
          p.alive = false;
          onPlayerHit(2 + Math.floor(Math.random() * 3));
          setShakePlayer(true);
          setTimeout(() => setShakePlayer(false), 300);
        }

        if (p.x < -200 || p.x > W + 200) p.alive = false;
      }

      // Trigger CRT glitch when projectile crosses
      setGlitchActive(anyProjectileCrossing);

      projectilesRef.current = projs.filter((p) => p.alive);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    layoutLines,
    shakePlayer,
    shakeMonster,
    keywords,
    cleanNarrative,
    onPlayerHit,
    onMonsterHit,
  ]);

  // ─── Monster auto-attack ───
  useEffect(() => {
    if (turn !== "monster") return;
    const timer = setTimeout(() => {
      const attackWords = ["CLAW", "BITE", "HEX", "DARK"];
      const word = attackWords[Math.floor(Math.random() * attackWords.length)];
      const canvas = canvasRef.current;
      const W = canvas?.width ?? 480;
      const H = canvas?.height ?? 320;
      const proj: Projectile = {
        id: nextProjId.current++,
        chars: word.split(""),
        x: W + 40,
        y: H / 2 + (Math.random() - 0.5) * 80,
        vx: -5 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        alive: true,
        fromPlayer: false,
        offsets: word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
      };
      projectilesRef.current.push(proj);
      setTimeout(() => {
        setNarrativeIdx((i) => i + 1);
        onTurnEnd();
      }, 1400);
    }, 800);
    return () => clearTimeout(timer);
  }, [turn, onTurnEnd]);

  // ─── Player submit ───
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (turn !== "player") return;
      const word = input.trim().toUpperCase();
      if (!word) return;

      const canvas = canvasRef.current;
      const H = canvas?.height ?? 320;
      const proj: Projectile = {
        id: nextProjId.current++,
        chars: word.split(""),
        x: -40,
        y: H / 2 + (Math.random() - 0.5) * 80,
        vx: 5 + Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        alive: true,
        fromPlayer: true,
        offsets: word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
      };
      projectilesRef.current.push(proj);
      setInput("");

      setTimeout(() => {
        setNarrativeIdx((i) => i + 1);
        onTurnEnd();
      }, 1400);
    },
    [input, turn, onTurnEnd]
  );

  return (
    <div className="battle-combat-layout">
      {/* ── Player sprite (outside CRT, left) ── */}
      <div className={`sprite-column sprite-left ${shakePlayer ? "sprite-shake" : ""}`}>
        <pre className="sprite-pre">{playerAscii.join("\n")}</pre>
      </div>

      {/* ── CRT center panel ── */}
      <div className="battle-crt-wrapper">
        <div className={`battle-crt ${glitchActive ? "crt-glitch" : ""}`}>
          <canvas ref={canvasRef} className="battle-canvas" />
          <div className="crt-scanlines" />
          <div className="crt-noise" />
          <div className="crt-vignette" />
        </div>
        {turn === "player" && (
          <form onSubmit={handleSubmit} className="input-form battle-input-row">
            <span className="prompt">{">"}</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                keywords.length > 0
                  ? keywords.join(", ") + "..."
                  : "type to attack..."
              }
              autoFocus
            />
          </form>
        )}
        {turn === "monster" && (
          <p className="battle-wait">The {monsterName} retaliates...</p>
        )}
      </div>

      {/* ── Monster sprite (outside CRT, right) ── */}
      <div className={`sprite-column sprite-right ${shakeMonster ? "sprite-shake" : ""}`}>
        <pre className="sprite-pre">{monsterAscii.join("\n")}</pre>
      </div>
    </div>
  );
}
