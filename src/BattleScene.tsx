import { useState, useCallback } from "react";
import HeartHP from "./HeartHP";
import SkullEncounter from "./SkullEncounter";
import BattleCombat from "./BattleCombat";
import { useImageToAscii } from "./useImageToAscii";

interface BattleSceneProps {
  onBattleEnd?: () => void;
}

type BattlePhase = "encounter" | "intro" | "combat";

const ENCOUNTER_TEXT =
  "A twisted figure emerges from the shadows — its body a mass of writhing dark tendrils, " +
  "two pale eyes burning with cold malice. The Hollow Wraith lets out a guttural screech " +
  "that rattles your bones. The air thickens, and the temperature drops.";

// Narratives with [keywords] the player can type to attack
const BATTLE_NARRATIVES = [
  "The wraith [lunges] forward, dark tendrils [slashing] through the frigid air. You grip your weapon tightly, searching for an opening.",
  "Shadows coil around the creature as it lets out a hollow [scream]. The ground beneath you [cracks] with unholy energy.",
  "The wraith's pale eyes fixate on you. Its form flickers like a dying [flame], tendrils reaching toward your [throat].",
  "A moment of stillness. The wraith circles you, its movements unnaturally fluid. You see a [weakness] in its flickering [core].",
  "The creature [howls] in fury, summoning a wave of darkness. Frost [spreads] across the ground toward your feet.",
];

export default function BattleScene({ onBattleEnd }: BattleSceneProps) {
  // Load and convert sprites to ASCII (flipped horizontally)
  const { lines: playerAscii, loading: playerLoading } = useImageToAscii(
    "/assets/hero.png",
    55,
    { flip: true, brightnessThreshold: 40 }
  );
  const { lines: monsterAscii, loading: monsterLoading } = useImageToAscii(
    "/assets/enemy.png",
    55,
    { flip: true, brightnessThreshold: 40 }
  );

  const [phase, setPhase] = useState<BattlePhase>("encounter");
  const [playerHp, setPlayerHp] = useState(24);
  const [monsterHp, setMonsterHp] = useState(30);
  const [turn, setTurn] = useState<"player" | "monster">("player");
  const maxHp = 24;

  const handleEncounterDone = useCallback(() => {
    setPhase("intro");
  }, []);

  const handleIntroDone = useCallback(() => {
    setPhase("combat");
  }, []);

  const handlePlayerHit = useCallback((dmg: number) => {
    setPlayerHp((hp) => Math.max(0, hp - dmg));
  }, []);

  const handleMonsterHit = useCallback((dmg: number) => {
    setMonsterHp((hp) => Math.max(0, hp - dmg));
  }, []);

  const handleTurnEnd = useCallback(() => {
    setTurn((t) => (t === "player" ? "monster" : "player"));
  }, []);

  return (
    <div className="battle-root">
      {/* ─── HP Heart (top) ─── */}
      <div className="battle-hp-bar">
        <HeartHP current={playerHp} max={maxHp} />
      </div>

      {/* ─── Main content area ─── */}
      <div className="battle-stage">
        {phase === "encounter" && (
          <SkullEncounter onComplete={handleEncounterDone} />
        )}

        {phase === "intro" && (
          <div className="battle-intro" onClick={handleIntroDone}>
            <TypewriterText text={ENCOUNTER_TEXT} speed={30} />
            <p className="battle-intro-hint fadeIn">
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
            monsterHp={monsterHp}
            playerHp={playerHp}
            turn={turn}
            onTurnEnd={handleTurnEnd}
          />
        )}
        {phase === "combat" && (playerLoading || monsterLoading) && (
          <p className="typewriter-text">Loading combatants...</p>
        )}
      </div>
    </div>
  );
}

/* ── Simple typewriter for encounter description ── */
import { useEffect, useRef } from "react";

function TypewriterText({
  text,
  speed = 30,
}: {
  text: string;
  speed?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    const iv = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  return (
    <p className="typewriter-text">
      {displayed}
      <span className="cursor-blink">▌</span>
    </p>
  );
}
