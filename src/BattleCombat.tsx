import {
  type FormEvent,
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import CrtOverlay from "./CrtOverlay";
import {
  type BattleLogEntry,
  type MonsterIntent,
  type PlayerAction,
  type PlayerStats,
  SPELLS,
  findSpell,
  getLiteracyTier,
} from "./battleTypes";

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
  turn: "player" | "monster";
  playerMana: number;
  playerStats: PlayerStats;
  onAction: (action: PlayerAction) => void;
  projectileCallbackRef: MutableRefObject<
    ((word: string, fromPlayer: boolean) => void) | null
  >;
}

export default function BattleCombat({
  monsterName,
  monsterAscii,
  playerAscii,
  monsterHp,
  monsterMaxHp,
  monsterShield,
  nextIntent,
  battleLog,
  turn,
  playerMana,
  playerStats,
  onAction,
  projectileCallbackRef,
}: BattleCombatProps) {
  const [spellInput, setSpellInput] = useState("");
  const [showSpellInput, setShowSpellInput] = useState(false);
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeMonster, setShakeMonster] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const glitchStateRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Monster HP → color ──
  const hpRatio = monsterMaxHp > 0 ? monsterHp / monsterMaxHp : 1;
  const monsterColor =
    hpRatio > 0.75
      ? "text-[rgba(200,200,200,0.85)]"
      : hpRatio > 0.5
        ? "text-[rgba(220,160,140,0.85)]"
        : hpRatio > 0.25
          ? "text-[rgba(255,100,80,0.9)]"
          : "text-[rgba(200,30,30,0.95)]";

  // ── Register projectile callback so BattleScene can trigger animations ──
  useEffect(() => {
    projectileCallbackRef.current = (word: string, fromPlayer: boolean) => {
      if (!word) return;
      const canvas = canvasRef.current;
      const width = canvas?.width ?? 480;
      const height = canvas?.height ?? 200;

      projectilesRef.current.push({
        chars: word.split(""),
        x: fromPlayer ? -40 : width + 40,
        y: height / 2 + (Math.random() - 0.5) * 60,
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

  // ── Canvas animation loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const width = 480;
    const height = 200;
    canvas.width = width;
    canvas.height = height;

    const animate = () => {
      context.clearRect(0, 0, width, height);
      const projectiles = projectilesRef.current;

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

        for (
          let charIndex = 0;
          charIndex < projectile.chars.length;
          charIndex += 1
        ) {
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

        if (
          (projectile.fromPlayer && projectile.x > width + 20) ||
          (!projectile.fromPlayer && projectile.x < -20) ||
          projectile.x < -200 ||
          projectile.x > width + 200
        ) {
          projectile.alive = false;
        }
      }

      if (glitchStateRef.current !== anyProjectileCrossing) {
        glitchStateRef.current = anyProjectileCrossing;
        setGlitchActive(anyProjectileCrossing);
      }

      projectilesRef.current = projectiles.filter((p) => p.alive);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleLog]);

  // ── Spell submit ──
  const handleSpellSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (turn !== "player") return;
      const found = findSpell(spellInput);
      if (!found) {
        setSpellInput("");
        return;
      }

      // If spell supports defend, let user choose mode
      if (found.modes.length > 1) {
        // For simplicity: if spell has defend mode, default to attack. 
        // User can prefix with "방어:" to choose defend mode.
        const isDefend = spellInput.trim().toLowerCase().startsWith("방어:");
        onAction({
          type: "spell",
          spell: found,
          mode: isDefend ? "defend" : "attack",
        });
      } else {
        onAction({ type: "spell", spell: found, mode: found.modes[0] });
      }

      setSpellInput("");
      setShowSpellInput(false);
    },
    [turn, spellInput, onAction],
  );

  // Available spells for hints
  const tier = getLiteracyTier(playerStats.literacy);
  const availableSpells = SPELLS.filter((s) => s.tier <= tier);

  return (
    <div className="flex w-full max-w-[1200px] flex-col items-center justify-center gap-6 px-4 animate-fade-in-quick lg:flex-row lg:gap-8">
      {/* ── Player ASCII ── */}
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

      {/* ── Center panel ── */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
        {/* Monster intent */}
        <div className="w-full max-w-[480px] text-center">
          <p className="text-[0.8rem] tracking-[0.08em] text-orange-400/70 italic">
            {nextIntent.label}
          </p>
          {monsterShield > 0 && (
            <span className="text-[0.7rem] text-blue-400/60">
              🛡 {monsterShield}
            </span>
          )}
        </div>

        {/* Projectile canvas */}
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

        {/* Battle log */}
        <div className="w-full max-w-[480px] h-[100px] overflow-y-auto rounded border border-white/10 bg-black/30 px-3 py-2 text-[0.75rem] leading-[1.6]">
          {battleLog.map((entry, i) => (
            <p key={i} className={`m-0 ${entry.color ?? "text-ash/70"}`}>
              {entry.text}
            </p>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* ── Player actions ── */}
        {turn === "player" && !showSpellInput && (
          <div className="flex w-full max-w-[480px] flex-wrap items-center justify-center gap-2">
            <ActionButton
              label="⚔ 공격"
              onClick={() => onAction({ type: "attack" })}
            />
            <ActionButton
              label="🛡 방어"
              onClick={() => onAction({ type: "defend" })}
            />
            <ActionButton
              label="💨 호흡"
              onClick={() => onAction({ type: "heal" })}
            />
            <ActionButton
              label="✦ 마법"
              onClick={() => setShowSpellInput(true)}
              accent
            />
          </div>
        )}

        {/* ── Spell typing ── */}
        {turn === "player" && showSpellInput && (
          <div className="w-full max-w-[480px]">
            <form
              onSubmit={handleSpellSubmit}
              className="flex items-center gap-2"
            >
              <span className="font-bold text-cyan-400">{"✦"}</span>
              <input
                type="text"
                value={spellInput}
                onChange={(e) => setSpellInput(e.target.value)}
                placeholder="주문 이름을 입력... (방어:Stone 으로 방어 모드)"
                autoFocus
                className="min-w-0 flex-1 border-0 border-b border-cyan-400/30 bg-transparent text-[1rem] text-cyan-300 outline-none placeholder:text-white/25 focus:border-cyan-400 sm:text-[1.1rem]"
              />
              <button
                type="button"
                onClick={() => setShowSpellInput(false)}
                className="cursor-pointer border-0 bg-transparent text-[0.8rem] text-white/40 hover:text-white/70"
              >
                취소
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1">
              {availableSpells.map((s) => (
                <span
                  key={s.name}
                  className="cursor-pointer rounded bg-white/5 px-2 py-0.5 text-[0.65rem] text-white/40 hover:bg-white/10 hover:text-white/70"
                  onClick={() => setSpellInput(s.name)}
                >
                  {s.name}{" "}
                  <span className="text-cyan-400/40">({s.manaCost}mp)</span>
                  {s.modes.includes("defend") && (
                    <span className="text-teal-400/40"> 🛡</span>
                  )}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[0.6rem] text-white/20">
              MP: {playerMana} | 방어 모드: "방어:주문이름" 입력
            </p>
          </div>
        )}

        {/* ── Monster turn ── */}
        {turn === "monster" && (
          <p className="m-0 text-center text-[0.95rem] tracking-[0.1em] text-[rgba(255,100,80,0.5)] animate-wait-blink">
            {monsterName}이(가) 행동한다...
          </p>
        )}
      </div>

      {/* ── Monster ASCII ── */}
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

function ActionButton({
  label,
  onClick,
  accent,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded border px-4 py-1.5 text-[0.85rem] tracking-[0.08em] transition-colors duration-200 ${
        accent
          ? "border-cyan-400/40 bg-cyan-400/5 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-400/10"
          : "border-white/20 bg-white/5 text-ash/80 hover:border-white/40 hover:bg-white/10 hover:text-ash"
      }`}
    >
      {label}
    </button>
  );
}
