import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BattleCombat from "./BattleCombat";
import SkullEncounter from "./SkullEncounter";
import { useAsciiAsset } from "./useAsciiAsset";
import {
  type BattleTargetOption,
  type BattleLogEntry,
  type CombatAnimationRequest,
  type MonsterIntent,
  type PlayerAction,
  type PlayerStats,
  DEFAULT_STATS,
  HOLLOW_WRAITH,
  MONSTER_TARGET_ID,
  PLAYER_TARGET_ID,
  getActionCritChance,
  getActionHitChance,
  getBaseAttackDamage,
  getBaseShield,
  getCriticalDamage,
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
  const { lines: playerAscii, loading: playerLoading } = useAsciiAsset(
    "/assets/new_hero_ascii.md",
  );
  const { lines: monsterAscii, loading: monsterLoading } = useAsciiAsset(
    "/assets/new_enemy_ascii.md",
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
  const [potionUsed, setPotionUsed] = useState(false);
  const ambientText = useMemo(() => AMBIENT_LINES[ambientIndex % AMBIENT_LINES.length], [ambientIndex]);
  const targetOptions = useMemo<BattleTargetOption[]>(
    () => [
      { id: PLAYER_TARGET_ID, name: "You", side: "player" },
      { id: MONSTER_TARGET_ID, name: monster.name, side: "enemy" },
    ],
    [monster.name],
  );

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

  const handlePotionUse = useCallback(() => {
    if (phase !== "combat" || potionUsed || playerHp >= maxHp) {
      return 0;
    }

    const healAmount = Math.min(maxHp - playerHp, Math.max(8, getHealAmount(stats) + 3));
    if (healAmount <= 0) {
      return 0;
    }

    setPotionUsed(true);
    setPlayerHp((value) => Math.min(maxHp, value + healAmount));
    addLog(`The crimson flask bursts over you... +${healAmount} HP`, "text-green-300");
    return healAmount;
  }, [addLog, maxHp, phase, playerHp, potionUsed, stats]);

  const monsterShieldRef = useRef(monsterShield);
  const monsterTurnFastForwardRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    monsterShieldRef.current = monsterShield;
  }, [monsterShield]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        monsterTurnFastForwardRef.current?.();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ── Resolve player action ──
  const handlePlayerAction = useCallback(
    (action: PlayerAction) => {
      if (turn !== "player") return;

      // Clear previous shield (shields expire each turn)
      setPlayerShield(0);

      let animationRequest: CombatAnimationRequest | null = null;

      switch (action.type) {
        case "attack": {
          const targetSide = action.targetId === PLAYER_TARGET_ID ? "player" : "enemy";
          const targetName = targetSide === "player" ? "yourself" : monster.name;
          const hitChance = getActionHitChance(action, stats, targetSide);
          const critChance = getActionCritChance(action, stats, targetSide);
          const didHit = targetSide === "player" || Math.random() < hitChance;
          const didCrit = didHit && Math.random() < critChance;
          const totalDamage = didCrit
            ? getCriticalDamage(getBaseAttackDamage(stats))
            : getBaseAttackDamage(stats);

          if (!didHit) {
            animationRequest = {
              word: "STRIKE",
              fromPlayer: true,
              targetId: action.targetId,
              targetSide,
              kind: "projectile",
              missed: true,
              onImpact: () => {
                addLog(`Strike misses ${targetName}!`, "text-white/40");
              },
            };
            break;
          }

          if (targetSide === "enemy") {
            const currentShield = monsterShieldRef.current;
            const shieldAbsorb = Math.min(currentShield, totalDamage);
            const hpDmg = totalDamage - shieldAbsorb;
            animationRequest = {
              word: "STRIKE",
              fromPlayer: true,
              targetId: action.targetId,
              targetSide,
              kind: "projectile",
              shielded: currentShield > 0,
              blocked: currentShield >= totalDamage,
              critical: didCrit,
              impactDamage: hpDmg,
              onImpact: () => {
                if (shieldAbsorb > 0) {
                  setMonsterShield((v) => Math.max(0, v - shieldAbsorb));
                }
                setMonsterHp((v) => Math.max(0, v - hpDmg));

                if (shieldAbsorb > 0) {
                  addLog(
                    didCrit
                      ? `Critical strike! ${shieldAbsorb} absorbed, ${hpDmg} damage!`
                      : `Strike! ${shieldAbsorb} absorbed, ${hpDmg} damage!`,
                    didCrit ? "text-yellow-300" : "text-sky-400",
                  );
                } else {
                  addLog(
                    didCrit
                      ? `Critical strike! ${totalDamage} damage!`
                      : `Strike! ${totalDamage} damage!`,
                    didCrit ? "text-yellow-300" : "text-sky-400",
                  );
                }
              },
            };
            break;
          }

          animationRequest = {
            word: "STRIKE",
            fromPlayer: true,
            targetId: action.targetId,
            targetSide,
            kind: "projectile",
            critical: didCrit,
            impactDamage: totalDamage,
            onImpact: () => {
              setPlayerHp((v) => Math.max(0, v - totalDamage));
              addLog(
                didCrit
                  ? `Critical strike! You hit yourself for ${totalDamage} damage!`
                  : `You strike yourself for ${totalDamage} damage!`,
                didCrit ? "text-yellow-300" : "text-red-400",
              );
            },
          };
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
            const targetSide = action.targetId === PLAYER_TARGET_ID ? "player" : "enemy";
            const targetName = targetSide === "player" ? "yourself" : monster.name;
            const hitChance = getActionHitChance(action, stats, targetSide);
            const critChance = getActionCritChance(action, stats, targetSide);
            const didHit = targetSide === "player" || Math.random() < hitChance;
            const didCrit = didHit && Math.random() < critChance;

            let damage = spell.baseDamage;
            let elementLog: { text: string; color: string } | null = null;
            if (targetSide === "enemy" && monster.element) {
              const mult = getElementMultiplier(spell.element, monster.element);
              damage = Math.round(damage * mult);
              if (mult > 1) {
                elementLog = {
                  text: "Elemental weakness! Super effective!",
                  color: "text-yellow-300",
                };
              } else if (mult < 1) {
                elementLog = {
                  text: "Elemental resistance... not very effective.",
                  color: "text-gray-400",
                };
              }
            }

            if (didCrit) {
              damage = getCriticalDamage(damage);
            }

            const willStun =
              didHit &&
              targetSide === "enemy" &&
              spell.stunChance > 0 &&
              Math.random() < spell.stunChance;

            if (!didHit) {
              animationRequest = {
                word: spell.name.toUpperCase(),
                fromPlayer: true,
                targetId: action.targetId,
                targetSide,
                kind: "projectile",
                element: spell.element,
                missed: true,
                onImpact: () => {
                  addLog(
                    `${spell.name} misses ${targetName}! (MP -${spell.manaCost})`,
                    "text-white/40",
                  );
                },
              };
              break;
            }

            if (targetSide === "enemy") {
              const currentShield = monsterShieldRef.current;
              const shieldAbsorb = Math.min(currentShield, damage);
              const hpDmg = damage - shieldAbsorb;
              animationRequest = {
                word: spell.name.toUpperCase(),
                fromPlayer: true,
                targetId: action.targetId,
                targetSide,
                kind: "projectile",
                element: spell.element,
                shielded: currentShield > 0,
                blocked: currentShield >= damage,
                critical: didCrit,
                impactDamage: hpDmg,
                onImpact: () => {
                  if (shieldAbsorb > 0) {
                    setMonsterShield((v) => Math.max(0, v - shieldAbsorb));
                  }
                  if (elementLog) {
                    addLog(elementLog.text, elementLog.color);
                  }
                  setMonsterHp((v) => Math.max(0, v - hpDmg));
                  addLog(
                    didCrit
                      ? `Critical ${spell.name}! ${damage} damage! (MP -${spell.manaCost})`
                      : `${spell.name}! ${damage} damage! (MP -${spell.manaCost})`,
                    didCrit ? "text-yellow-300" : "text-cyan-300",
                  );

                  if (willStun) {
                    setMonsterStunned(true);
                    addLog("Enemy stunned!", "text-purple-400");
                  }
                },
              };
              break;
            }

            animationRequest = {
              word: spell.name.toUpperCase(),
              fromPlayer: true,
              targetId: action.targetId,
              targetSide,
              kind: "projectile",
              element: spell.element,
              critical: didCrit,
              impactDamage: damage,
              onImpact: () => {
                setPlayerHp((v) => Math.max(0, v - damage));
                addLog(
                  didCrit
                    ? `Critical ${spell.name}! You take ${damage} damage. (MP -${spell.manaCost})`
                    : `${spell.name} hits yourself for ${damage} damage. (MP -${spell.manaCost})`,
                  didCrit ? "text-yellow-300" : "text-red-400",
                );
              },
            };
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

      // Trigger monster turn — delay depends on whether player fired a projectile
      const turnDelay = animationRequest ? 1920 : 400;
      window.setTimeout(() => setTurn("monster"), turnDelay);

      if (animationRequest) {
        if (projectileCallbackRef.current) {
          projectileCallbackRef.current(animationRequest);
        } else {
          animationRequest.onImpact?.();
        }
      }
    },
    [
      turn,
      stats,
      maxHp,
      playerMana,
      monster,
      addLog,
    ],
  );

  const projectileCallbackRef = useRef<((request: CombatAnimationRequest) => void) | null>(null);

  // Refs for values the monster-turn effect needs to read WITHOUT re-triggering
  const nextIntentRef = useRef(nextIntent);
  const playerShieldRef = useRef(playerShield);

  useEffect(() => {
    nextIntentRef.current = nextIntent;
    playerShieldRef.current = playerShield;
  }, [nextIntent, playerShield]);

  // ── Monster turn ──
  useEffect(() => {
    if (turn !== "monster") return;
    if (monsterHp <= 0) return;

    const timeoutIds: number[] = [];
    let turnResolved = false;
    let actionStarted = false;
    let pendingResolve: (() => void) | null = null;

    const clearTurnTimeouts = () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
      timeoutIds.length = 0;
    };

    const finishMonsterTurn = () => {
      if (turnResolved) return;
      turnResolved = true;
      setAmbientIndex((v) => v + 1);
      rollNextIntent();
      setTurn("player");
    };

    const executeMonsterAction = (skipAnimation = false) => {
      if (turnResolved) return;
      if (actionStarted) {
        if (skipAnimation) {
          pendingResolve?.();
        }
        return;
      }
      actionStarted = true;

      // Clear monster shield each turn
      setMonsterShield(0);

      if (monsterStunned) {
        addLog(`${monster.name} is stunned and cannot act!`, "text-purple-300");
        setMonsterStunned(false);
        finishMonsterTurn();
        return;
      }

      // Read from refs so we don't depend on these values
      const intent = nextIntentRef.current;
      const shield = playerShieldRef.current;

      if (intent.kind === "defend") {
        const shieldVal = 8;
        setMonsterShield(shieldVal);
        addLog(
          `${monster.name} hardens its guard! (Shield ${shieldVal})`,
          "text-orange-300",
        );
        pendingResolve = finishMonsterTurn;
        if (skipAnimation) {
          finishMonsterTurn();
        } else {
          timeoutIds.push(window.setTimeout(finishMonsterTurn, 920));
        }
        return;
      }

      // Attack or spell — fire projectile first
      const dmg = intent.damage;
      const absorbed = Math.min(shield, dmg);
      const hpDmg = dmg - absorbed;
      const blocked = shield >= dmg;
      const shielded = absorbed > 0;

      const resolveMonsterHit = () => {
        if (turnResolved) return;
        if (absorbed > 0) {
          setPlayerShield((v) => Math.max(0, v - absorbed));
          if (hpDmg > 0) {
            addLog(
              `${intent.label.replace("...", "")} — ${absorbed} blocked, ${hpDmg} damage!`,
              "text-red-400",
            );
          } else {
            addLog(
              `${intent.label.replace("...", "")} — fully blocked by shield!`,
              "text-blue-400",
            );
          }
        } else {
          addLog(`${intent.label.replace("...", "")} — ${dmg} damage!`, "text-red-400");
        }

        setPlayerHp((v) => Math.max(0, v - hpDmg));
        if (skipAnimation) {
          finishMonsterTurn();
          return;
        }

        const recoveryDelay = hpDmg > 0 ? 760 : shielded ? 520 : 120;
        if (recoveryDelay > 0) {
          timeoutIds.push(window.setTimeout(finishMonsterTurn, recoveryDelay));
        } else {
          finishMonsterTurn();
        }
      };
      pendingResolve = resolveMonsterHit;

      // Fire projectile animation
      if (!skipAnimation && projectileCallbackRef.current) {
        projectileCallbackRef.current({
          word: intent.element?.toUpperCase() ?? intent.kind.toUpperCase(),
          fromPlayer: false,
          targetId: PLAYER_TARGET_ID,
          targetSide: "player",
          kind: "crescent-slash",
          element: intent.element,
          shielded,
          blocked,
          impactDamage: hpDmg,
          onImpact: resolveMonsterHit,
        });
      } else {
        resolveMonsterHit();
      }
    };

    timeoutIds.push(window.setTimeout(() => executeMonsterAction(document.hidden), 720));
    monsterTurnFastForwardRef.current = () => {
      clearTurnTimeouts();
      executeMonsterAction(true);
    };

    return () => {
      monsterTurnFastForwardRef.current = null;
      clearTurnTimeouts();
    };
  }, [
    turn,
    monsterHp,
    monsterStunned,
    monster,
    addLog,
    rollNextIntent,
  ]);

  // ── Victory / Defeat detection ──
  useEffect(() => {
    if (phase !== "combat") return;
    if (monsterHp <= 0 && phase === "combat") {
      // HP now drops on impact, so only wait for the hit flash and death sink.
      const id = window.setTimeout(() => {
        setPhase("victory");
        addLog(`${monster.name} has been slain!`, "text-yellow-400");
      }, 1900);
      return () => window.clearTimeout(id);
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
            targetOptions={targetOptions}
            onAction={handlePlayerAction}
            potionAvailable={!potionUsed}
            onPotionUse={handlePotionUse}
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
