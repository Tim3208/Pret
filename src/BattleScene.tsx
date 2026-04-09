import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BattleCombat from "./BattleCombat";
import SkullEncounter from "./SkullEncounter";
import { useImageToAscii } from "./useImageToAscii";
import {
  type BattleLogEntry,
  type MonsterIntent,
  type PlayerAction,
  type PlayerStats,
  DEFAULT_STATS,
  HOLLOW_WRAITH,
  getBaseAttackDamage,
  getBaseShield,
  getElementMultiplier,
  getHealAmount,
  getLiteracyTier,
  getMaxHp,
  getMaxMana,
  pickMonsterIntent,
} from "./battleTypes";

type BattlePhase = "encounter" | "intro" | "combat" | "victory" | "defeat";

const ENCOUNTER_TEXT =
  "A twisted figure emerges from the shadows, its body a mass of writhing dark tendrils, " +
  "two pale eyes burning with cold malice. The Hollow Wraith lets out a guttural screech " +
  "that rattles your bones. The air thickens, and the temperature drops.";

const AMBIENT_LINES = [
  "Shadows coil around the wraith's tendrils.",
  "The air tastes of iron and decay.",
  "Wind howls through the hollow.",
  "Frost creeps along the stone floor.",
  "The wraith's eyes pulse with faint hunger.",
  "A low hum resonates from the darkness.",
  "Your breath fogs in the cold air.",
  "Embers drift through the stale dark.",
  "The silence presses like a weight.",
  "Something stirs in the deeper shadows.",
];

export interface BattleResult {
  won: boolean;
}

interface Props {
  onBattleEnd: (result: BattleResult) => void;
}

export default function BattleScene({ onBattleEnd }: Props) {
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

  const monster = HOLLOW_WRAITH;
  const [stats] = useState<PlayerStats>({ ...DEFAULT_STATS });

  const maxHp = getMaxHp(stats);
  const maxMana = getMaxMana(stats);

  const [phase, setPhase] = useState<BattlePhase>("encounter");
  const [playerHp, setPlayerHp] = useState(maxHp);
  const [playerMana, setPlayerMana] = useState(maxMana);
  const [playerShield, setPlayerShield] = useState(0);
  const [monsterHp, setMonsterHp] = useState(monster.maxHp);
  const [monsterShield, setMonsterShield] = useState(0);
  const [monsterStunned, setMonsterStunned] = useState(false);
  const [turn, setTurn] = useState<"player" | "monster">("player");
  const [nextIntent, setNextIntent] = useState<MonsterIntent>(() =>
    pickMonsterIntent(monster),
  );
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [ambientIndex, setAmbientIndex] = useState(0);
  const ambientText = useMemo(() => AMBIENT_LINES[ambientIndex % AMBIENT_LINES.length], [ambientIndex]);

  const addLog = useCallback((text: string, color?: string) => {
    setBattleLog((prev) => [...prev.slice(-30), { text, color }]);
  }, []);

  // ── Roll next monster intent at the start of each PLAYER turn ──
  const rollNextIntent = useCallback(() => {
    setNextIntent(pickMonsterIntent(monster));
  }, [monster]);

  const handleEncounterDone = useCallback(() => setPhase("intro"), []);
  const handleIntroDone = useCallback(() => {
    setPhase("combat");
    addLog("The battle begins!", "text-ember");
  }, [addLog]);

  // ── Resolve player action ──
  const handlePlayerAction = useCallback(
    (action: PlayerAction) => {
      if (turn !== "player") return;

      // Clear previous shield (shields expire each turn)
      setPlayerShield(0);

      let projectileWord = "";
      let projectileFromPlayer = true;

      switch (action.type) {
        case "attack": {
          const dmg = getBaseAttackDamage(stats);
          const shieldAbsorb = Math.min(monsterShield, dmg);
          const hpDmg = dmg - shieldAbsorb;
          if (shieldAbsorb > 0) {
            setMonsterShield((v) => Math.max(0, v - shieldAbsorb));
            addLog(
              `Strike! ${shieldAbsorb} absorbed, ${hpDmg} damage!`,
              "text-sky-400",
            );
          } else {
            addLog(`Strike! ${dmg} damage!`, "text-sky-400");
          }
          setMonsterHp((v) => Math.max(0, v - hpDmg));
          projectileWord = "STRIKE";
          break;
        }
        case "defend": {
          const shield = getBaseShield(stats);
          setPlayerShield(shield);
          addLog(`Brace! Shield +${shield}!`, "text-blue-400");
          break;
        }
        case "heal": {
          const heal = getHealAmount(stats);
          setPlayerHp((v) => Math.min(maxHp, v + heal));
          addLog(`Steady breath... +${heal} HP.`, "text-green-400");
          break;
        }
        case "spell": {
          const { spell, mode } = action;
          const tier = getLiteracyTier(stats.literacy);
          if (spell.tier > tier) {
            addLog(
              `Not enough literacy... (need tier ${spell.tier})`,
              "text-red-400",
            );
            return;
          }
          if (playerMana < spell.manaCost) {
            addLog(`Not enough mana! (need ${spell.manaCost})`, "text-red-400");
            return;
          }
          setPlayerMana((v) => v - spell.manaCost);

          if (mode === "attack") {
            let dmg = spell.baseDamage;
            if (monster.element) {
              const mult = getElementMultiplier(spell.element, monster.element);
              dmg = Math.round(dmg * mult);
              if (mult > 1)
                addLog("Elemental weakness! Super effective!", "text-yellow-300");
              if (mult < 1)
                addLog("Elemental resistance... not very effective.", "text-gray-400");
            }
            const shieldAbsorb = Math.min(monsterShield, dmg);
            const hpDmg = dmg - shieldAbsorb;
            if (shieldAbsorb > 0) {
              setMonsterShield((v) => Math.max(0, v - shieldAbsorb));
            }
            setMonsterHp((v) => Math.max(0, v - hpDmg));
            addLog(
              `${spell.name}! ${dmg} damage! (MP -${spell.manaCost})`,
              "text-cyan-300",
            );
            projectileWord = spell.name.toUpperCase();

            if (spell.stunChance > 0 && Math.random() < spell.stunChance) {
              setMonsterStunned(true);
              addLog("Enemy stunned!", "text-purple-400");
            }
          } else {
            // defend mode
            const shield = spell.baseShield + Math.floor(stats.agility * 0.5);
            setPlayerShield(shield);
            addLog(
              `${spell.name} ward! Shield +${shield}! (MP -${spell.manaCost})`,
              "text-teal-300",
            );
            if (spell.healOnDefend > 0) {
              setPlayerHp((v) => Math.min(maxHp, v + spell.healOnDefend));
              addLog(`Nature mends your wounds... +${spell.healOnDefend} HP`, "text-green-300");
            }
          }
          break;
        }
      }

      // Trigger monster turn after a delay
      setTurn("monster");
      projectileFromPlayer; // used by BattleCombat for animation
      void projectileWord; // used by BattleCombat for animation

      // Pass the projectile info via a ref so BattleCombat can animate it
      if (projectileCallbackRef.current) {
        projectileCallbackRef.current(projectileWord, projectileFromPlayer);
      }
    },
    [
      turn,
      stats,
      maxHp,
      playerMana,
      monster,
      monsterShield,
      addLog,
    ],
  );

  const projectileCallbackRef = useRef<
    ((word: string, fromPlayer: boolean) => void) | null
  >(null);

  // ── Monster turn ──
  useEffect(() => {
    if (turn !== "monster") return;
    if (monsterHp <= 0) return;

    const timeoutId = window.setTimeout(() => {
      // Clear monster shield each turn
      setMonsterShield(0);

      if (monsterStunned) {
        addLog(`${monster.name} is stunned and cannot act!`, "text-purple-300");
        setMonsterStunned(false);
        setTurn("player");
        setAmbientIndex((v) => v + 1);
        rollNextIntent();
        return;
      }

      const intent = nextIntent;

      if (intent.kind === "defend") {
        const shield = 8;
        setMonsterShield(shield);
        addLog(
          `${monster.name} hardens its guard! (Shield ${shield})`,
          "text-orange-300",
        );
      } else {
        // attack or spell
        let dmg = intent.damage;
        const absorbed = Math.min(playerShield, dmg);
        const hpDmg = dmg - absorbed;

        if (absorbed > 0) {
          setPlayerShield((v) => Math.max(0, v - absorbed));
          addLog(
            `${intent.label.replace("...", "")} — ${absorbed} blocked, ${hpDmg} damage!`,
            "text-red-400",
          );
        } else {
          addLog(`${intent.label.replace("...", "")} — ${dmg} damage!`, "text-red-400");
        }

        setPlayerHp((v) => Math.max(0, v - hpDmg));

        // Projectile animation
        if (projectileCallbackRef.current) {
          const word =
            intent.element?.toUpperCase() ?? intent.kind.toUpperCase();
          projectileCallbackRef.current(word, false);
        }
      }

      setAmbientIndex((v) => v + 1);
      rollNextIntent();
      setTurn("player");
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [
    turn,
    nextIntent,
    monsterHp,
    monsterStunned,
    playerShield,
    monster,
    addLog,
    rollNextIntent,
  ]);

  // ── Victory / Defeat detection ──
  useEffect(() => {
    if (phase !== "combat") return;
    if (monsterHp <= 0 && phase === "combat") {
      setPhase("victory");
      addLog(`${monster.name} has been slain!`, "text-yellow-400");
    }
  }, [monsterHp, phase, monster.name, addLog]);

  // Victory → return to bonfire after delay
  useEffect(() => {
    if (phase !== "victory") return;
    const id = window.setTimeout(() => onBattleEnd({ won: true }), 3500);
    return () => window.clearTimeout(id);
  }, [phase, onBattleEnd]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6">
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
            monsterName={monster.name}
            monsterAscii={monsterAscii}
            playerAscii={playerAscii}
            monsterHp={monsterHp}
            monsterMaxHp={monster.maxHp}
            monsterShield={monsterShield}
            nextIntent={nextIntent}
            battleLog={battleLog}
            ambientText={ambientText}
            turn={turn}
            playerHp={playerHp}
            playerMaxHp={maxHp}
            playerMana={playerMana}
            playerMaxMana={maxMana}
            playerShield={playerShield}
            playerStats={stats}
            onAction={handlePlayerAction}
            projectileCallbackRef={projectileCallbackRef}
          />
        )}

        {phase === "combat" && (playerLoading || monsterLoading) && (
          <p className="px-6 text-[1.15rem] leading-[1.9] text-ash [text-shadow:0_0_4px_rgba(255,255,255,0.1)]">
            Loading combatants...
          </p>
        )}

        {phase === "victory" && (
          <div className="flex flex-col items-center gap-4 animate-fade-in-quick">
            <p className="text-[1.3rem] text-ember tracking-wider [text-shadow:0_0_12px_rgba(255,170,0,0.4)]">
              {monster.name} has been slain.
            </p>
            <p className="text-[0.85rem] text-white/40 tracking-[0.15em]">
              Returning to the bonfire...
            </p>
          </div>
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
