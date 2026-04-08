import { useCallback, useEffect, useState } from "react";
import BattleCombat from "./BattleCombat";
import HeartHP from "./HeartHP";
import SkullEncounter from "./SkullEncounter";
import { useImageToAscii } from "./useImageToAscii";

type BattlePhase = "encounter" | "intro" | "combat";

const ENCOUNTER_TEXT =
  "A twisted figure emerges from the shadows, its body a mass of writhing dark tendrils, " +
  "two pale eyes burning with cold malice. The Hollow Wraith lets out a guttural screech " +
  "that rattles your bones. The air thickens, and the temperature drops.";

const BATTLE_NARRATIVES = [
  "The wraith [lunges] forward, dark tendrils [slashing] through the frigid air. You grip your weapon tightly, searching for an opening.",
  "Shadows coil around the creature as it lets out a hollow [scream]. The ground beneath you [cracks] with unholy energy.",
  "The wraith's pale eyes fixate on you. Its form flickers like a dying [flame], tendrils reaching toward your [throat].",
  "A moment of stillness. The wraith circles you, its movements unnaturally fluid. You see a [weakness] in its flickering [core].",
  "The creature [howls] in fury, summoning a wave of darkness. Frost [spreads] across the ground toward your feet.",
];

export default function BattleScene() {
  const { lines: playerAscii, loading: playerLoading } = useImageToAscii(
    "/assets/hero.png",
    55,
    { flip: true, brightnessThreshold: 40 },
  );
  const { lines: monsterAscii, loading: monsterLoading } = useImageToAscii(
    "/assets/enemy.png",
    55,
    { flip: true, brightnessThreshold: 40 },
  );

  const [phase, setPhase] = useState<BattlePhase>("encounter");
  const [playerHp, setPlayerHp] = useState(24);
  const [, setMonsterHp] = useState(30);
  const [turn, setTurn] = useState<"player" | "monster">("player");
  const maxHp = 24;

  const handleEncounterDone = useCallback(() => {
    setPhase("intro");
  }, []);

  const handleIntroDone = useCallback(() => {
    setPhase("combat");
  }, []);

  const handlePlayerHit = useCallback((damage: number) => {
    setPlayerHp((value) => Math.max(0, value - damage));
  }, []);

  const handleMonsterHit = useCallback((damage: number) => {
    setMonsterHp((value) => Math.max(0, value - damage));
  }, []);

  const handleTurnEnd = useCallback(() => {
    setTurn((value) => (value === "player" ? "monster" : "player"));
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6">
      <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
        <HeartHP current={playerHp} max={maxHp} />
      </div>

      <div className="flex w-full flex-1 items-center justify-center">
        {phase === "encounter" && (
          <SkullEncounter onComplete={handleEncounterDone} />
        )}

        {phase === "intro" && (
          <div
            className="max-w-[500px] cursor-pointer px-6 py-8 animate-fade-in-quick"
            onClick={handleIntroDone}
          >
            <TypewriterText text={ENCOUNTER_TEXT} speed={30} />
            <p className="mt-6 text-center text-[0.9rem] tracking-[0.15em] text-white/40 opacity-0 [animation:fade_1s_4s_forwards]">
              {"[ click to fight ]"}
            </p>
          </div>
        )}

        {phase === "combat" && !playerLoading && !monsterLoading && (
          <BattleCombat
            monsterName="Hollow Wraith"
            monsterAscii={monsterAscii}
            playerAscii={playerAscii}
            narratives={BATTLE_NARRATIVES}
            onPlayerHit={handlePlayerHit}
            onMonsterHit={handleMonsterHit}
            turn={turn}
            onTurnEnd={handleTurnEnd}
          />
        )}

        {phase === "combat" && (playerLoading || monsterLoading) && (
          <p className="px-6 text-[1.15rem] leading-[1.9] text-ash [text-shadow:0_0_4px_rgba(255,255,255,0.1)]">
            Loading combatants...
          </p>
        )}
      </div>
    </div>
  );
}

function TypewriterText({
  text,
  speed = 30,
}: {
  text: string;
  speed?: number;
}) {
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCharCount((value) => {
        const nextValue = Math.min(value + 1, text.length);
        if (nextValue >= text.length) {
          window.clearInterval(intervalId);
        }
        return nextValue;
      });
    }, speed);

    return () => window.clearInterval(intervalId);
  }, [text, speed]);

  return (
    <p className="text-[1.05rem] leading-[1.9] text-ash sm:text-[1.15rem] [text-shadow:0_0_4px_rgba(255,255,255,0.1)]">
      {text.slice(0, charCount)}
      <span className="ml-[2px] inline-block animate-cursor-blink text-ember">
        |
      </span>
    </p>
  );
}
