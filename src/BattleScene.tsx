import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BATTLE_LOG_TEXT } from "@/content/text/battle/log";
import {
  BATTLE_AMBIENT_LINES,
  BATTLE_ENCOUNTER_TEXT,
  BATTLE_SCENE_TEXT,
} from "@/content/text/battle/scene";
import {
  type BattleLogEntry,
  type BattleTargetOption,
  type CombatAnimationRequest,
  type PlayerAction,
  getActionCritChance,
  getActionHitChance,
  getCriticalDamage,
  MONSTER_TARGET_ID,
  PLAYER_TARGET_ID,
} from "@/entities/combat";
import type { EquippedItems } from "@/entities/equipment";
import {
  type Language,
  getLocalizedMonsterIntentLabel,
  getLocalizedMonsterName,
  getLocalizedSpellName,
  interpolateText,
  pickText,
} from "@/entities/locale";
import {
  HOLLOW_WRAITH,
  type MonsterIntent,
  pickMonsterIntent,
} from "@/entities/monster";
import {
  DEFAULT_STATS,
  getBaseAttackDamage,
  getBaseShield,
  getHealAmount,
  getLiteracyTier,
  getMaxHp,
  getMaxMana,
  type PlayerStats,
} from "@/entities/player";
import { getElementMultiplier } from "@/entities/spell";
import BattleCombat from "./BattleCombat";
import { useAsciiAsset } from "@/shared/lib/ascii";
import { SkullEncounter } from "@/widgets/encounter-scene";

type BattlePhase = "encounter" | "intro" | "combat" | "victory" | "defeat";

export interface BattleResult {
  won: boolean;
}

interface Props {
  equippedItems: EquippedItems;
  hasPostBattleEvent: boolean;
  language: Language;
  onBattleEnd: (result: BattleResult) => void;
}

/**
 * 전투 진입, 턴 진행, 승패 전환을 관리하는 전투 장면 컨테이너다.
 */
export default function BattleScene({
  equippedItems,
  hasPostBattleEvent,
  language,
  onBattleEnd,
}: Props) {
  const assetBase = import.meta.env.BASE_URL;
  const { lines: playerAscii, loading: playerLoading } = useAsciiAsset(
    `${assetBase}assets/new_hero_ascii.md`,
  );
  const { lines: monsterAscii, loading: monsterLoading } = useAsciiAsset(
    `${assetBase}assets/new_enemy_ascii.md`,
  );

  const monster = HOLLOW_WRAITH;
  const battleLogText = BATTLE_LOG_TEXT[language];
  const sceneText = BATTLE_SCENE_TEXT[language];
  const localizedMonsterName = getLocalizedMonsterName(monster.name, language);
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
  const ambientText = useMemo(() => {
    const lines = BATTLE_AMBIENT_LINES[language];
    return lines[ambientIndex % lines.length];
  }, [ambientIndex, language]);
  const nextIntentLabel = useMemo(
    () => getLocalizedMonsterIntentLabel(nextIntent.label, language),
    [language, nextIntent.label],
  );
  const targetOptions = useMemo<BattleTargetOption[]>(
    () => [
      { id: PLAYER_TARGET_ID, name: sceneText.selfTargetName, side: "player" },
      { id: MONSTER_TARGET_ID, name: localizedMonsterName, side: "enemy" },
    ],
    [localizedMonsterName, sceneText.selfTargetName],
  );

  const addLog = useCallback((text: string, color?: string) => {
    setBattleLog((prev) => [...prev.slice(-30), { text, color }]);
  }, []);
  const trimIntentLabel = useCallback((label: string) => label.replace(/\.\.\.$/, ""), []);

  // ── Roll next monster intent at the start of each PLAYER turn ──
  const rollNextIntent = useCallback(() => {
    setNextIntent(pickMonsterIntent(monster));
  }, [monster]);

  const handleEncounterDone = useCallback(() => setPhase("intro"), []);
  const handleIntroDone = useCallback(() => {
    setPhase("combat");
    addLog(sceneText.battleBegins, "text-ember");
  }, [addLog, sceneText.battleBegins]);

  /**
   * 포션 사용 가능 여부를 검사하고 실제 회복량을 반환한다.
   */
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
    addLog(
      interpolateText(battleLogText.potionUse, { healAmount }),
      "text-green-300",
    );
    return healAmount;
  }, [addLog, battleLogText, maxHp, phase, playerHp, potionUsed, stats]);

  /**
   * 현재 몬스터 방어막을 최신값으로 읽기 위한 ref다.
   */
  const monsterShieldRef = useRef(monsterShield);
  /**
   * 플레이어 턴에서 행동이 이미 확정됐는지 추적해 중복 입력을 막는다.
   */
  const playerActionCommittedRef = useRef(false);
  /**
   * 플레이어 행동 후 몬스터 턴으로 넘기는 지연 타이머를 저장한다.
   */
  const monsterTurnTimeoutRef = useRef<number | null>(null);
  const monsterTurnFastForwardRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    monsterShieldRef.current = monsterShield;
  }, [monsterShield]);

  useEffect(() => {
    return () => {
      if (monsterTurnTimeoutRef.current) {
        window.clearTimeout(monsterTurnTimeoutRef.current);
      }
    };
  }, []);

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
  /**
   * 플레이어가 선택한 행동을 해석하고 몬스터 턴으로 넘긴다.
   */
  const handlePlayerAction = useCallback(
    (action: PlayerAction) => {
      if (turn !== "player" || playerActionCommittedRef.current) return;

      // Clear previous shield (shields expire each turn)
      setPlayerShield(0);

      let animationRequest: CombatAnimationRequest | null = null;

      switch (action.type) {
        case "attack": {
          const targetSide = action.targetId === PLAYER_TARGET_ID ? "player" : "enemy";
          const targetName = targetSide === "player" ? sceneText.yourself : localizedMonsterName;
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
                addLog(
                  interpolateText(battleLogText.attackMiss, { targetName }),
                  "text-white/40",
                );
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
                    interpolateText(
                      didCrit
                        ? battleLogText.attackShieldCriticalHit
                        : battleLogText.attackShieldHit,
                      { hpDamage: hpDmg, shieldAbsorb },
                    ),
                    didCrit ? "text-yellow-300" : "text-sky-400",
                  );
                } else {
                  addLog(
                    interpolateText(
                      didCrit
                        ? battleLogText.attackCriticalHit
                        : battleLogText.attackHit,
                      { damage: totalDamage },
                    ),
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
                interpolateText(
                  didCrit
                    ? battleLogText.attackSelfCriticalHit
                    : battleLogText.attackSelfHit,
                  { damage: totalDamage },
                ),
                didCrit ? "text-yellow-300" : "text-red-400",
              );
            },
          };
          break;
        }
        case "defend": {
          const shield = getBaseShield(stats);
          setPlayerShield(shield);
          addLog(
            interpolateText(battleLogText.defend, { shield }),
            "text-blue-400",
          );
          break;
        }
        case "heal": {
          const heal = getHealAmount(stats);
          setPlayerHp((v) => Math.min(maxHp, v + heal));
          addLog(
            interpolateText(battleLogText.heal, { heal }),
            "text-green-400",
          );
          break;
        }
        case "spell": {
          const { spell, mode } = action;
          const spellDisplayName = getLocalizedSpellName(spell.name, language);
          const tier = getLiteracyTier(stats.literacy);
          if (spell.tier > tier) {
            addLog(
              interpolateText(battleLogText.spellNeedLiteracy, {
                tier: spell.tier,
              }),
              "text-red-400",
            );
            return;
          }
          if (playerMana < spell.manaCost) {
            addLog(
              interpolateText(battleLogText.spellNeedMana, {
                manaCost: spell.manaCost,
              }),
              "text-red-400",
            );
            return;
          }
          setPlayerMana((v) => v - spell.manaCost);

          if (mode === "attack") {
            const targetSide = action.targetId === PLAYER_TARGET_ID ? "player" : "enemy";
            const targetName = targetSide === "player" ? sceneText.yourself : localizedMonsterName;
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
                  text: sceneText.elementalWeakness,
                  color: "text-yellow-300",
                };
              } else if (mult < 1) {
                elementLog = {
                  text: sceneText.elementalResistance,
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
                    interpolateText(battleLogText.spellMiss, {
                      manaCost: spell.manaCost,
                      spellName: spellDisplayName,
                      targetName,
                    }),
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
                    interpolateText(
                      didCrit
                        ? battleLogText.spellCriticalHit
                        : battleLogText.spellHit,
                      {
                        damage,
                        manaCost: spell.manaCost,
                        spellName: spellDisplayName,
                      },
                    ),
                    didCrit ? "text-yellow-300" : "text-cyan-300",
                  );

                  if (willStun) {
                    setMonsterStunned(true);
                    addLog(sceneText.enemyStunned, "text-purple-400");
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
                  interpolateText(
                    didCrit
                      ? battleLogText.spellSelfCriticalHit
                      : battleLogText.spellSelfHit,
                    {
                      damage,
                      manaCost: spell.manaCost,
                      spellName: spellDisplayName,
                    },
                  ),
                  didCrit ? "text-yellow-300" : "text-red-400",
                );
              },
            };
          } else {
            // defend mode
            const shield = spell.baseShield + Math.floor(stats.agility * 0.5);
            setPlayerShield(shield);
            addLog(
              interpolateText(battleLogText.spellWard, {
                manaCost: spell.manaCost,
                shield,
                spellName: spellDisplayName,
              }),
              "text-teal-300",
            );
            if (spell.healOnDefend > 0) {
              setPlayerHp((v) => Math.min(maxHp, v + spell.healOnDefend));
              addLog(
                interpolateText(battleLogText.spellDefendHeal, {
                  heal: spell.healOnDefend,
                }),
                "text-green-300",
              );
            }
          }
          break;
        }
      }

      // Trigger monster turn — delay depends on whether player fired a projectile
      const turnDelay = animationRequest ? 1920 : 400;
      playerActionCommittedRef.current = true;
      if (monsterTurnTimeoutRef.current) {
        window.clearTimeout(monsterTurnTimeoutRef.current);
      }
      monsterTurnTimeoutRef.current = window.setTimeout(() => {
        monsterTurnTimeoutRef.current = null;
        setTurn("monster");
      }, turnDelay);

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
      battleLogText,
      language,
      localizedMonsterName,
      sceneText,
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
      playerActionCommittedRef.current = false;
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
        addLog(
          interpolateText(battleLogText.monsterStunned, {
            monsterName: localizedMonsterName,
          }),
          "text-purple-300",
        );
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
          interpolateText(battleLogText.monsterDefend, {
            monsterName: localizedMonsterName,
            shield: shieldVal,
          }),
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
      const localizedIntent = trimIntentLabel(getLocalizedMonsterIntentLabel(intent.label, language));

      const resolveMonsterHit = () => {
        if (turnResolved) return;
        if (absorbed > 0) {
          setPlayerShield((v) => Math.max(0, v - absorbed));
          if (hpDmg > 0) {
            addLog(
              interpolateText(battleLogText.monsterHitThroughShield, {
                absorbed,
                hpDamage: hpDmg,
                intentLabel: localizedIntent,
              }),
              "text-red-400",
            );
          } else {
            addLog(
              interpolateText(battleLogText.monsterHitBlocked, {
                intentLabel: localizedIntent,
              }),
              "text-blue-400",
            );
          }
        } else {
          addLog(
            interpolateText(battleLogText.monsterHit, {
              damage: dmg,
              intentLabel: localizedIntent,
            }),
            "text-red-400",
          );
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
    battleLogText,
    language,
    localizedMonsterName,
    rollNextIntent,
    trimIntentLabel,
  ]);

  // ── Victory / Defeat detection ──
  useEffect(() => {
    if (phase !== "combat") return;
    if (monsterHp <= 0 && phase === "combat") {
      if (monsterTurnTimeoutRef.current) {
        window.clearTimeout(monsterTurnTimeoutRef.current);
        monsterTurnTimeoutRef.current = null;
      }
      // HP now drops on impact, so only wait for the hit flash and death sink.
      const id = window.setTimeout(() => {
        setPhase("victory");
        addLog(
          interpolateText(battleLogText.victoryLog, {
            monsterName: localizedMonsterName,
          }),
          "text-yellow-400",
        );
      }, 1900);
      return () => window.clearTimeout(id);
    }
  }, [monsterHp, phase, addLog, battleLogText, localizedMonsterName]);

  // Victory → return to bonfire after delay
  useEffect(() => {
    if (phase !== "victory") return;
    const id = window.setTimeout(() => onBattleEnd({ won: true }), 3500);
    return () => window.clearTimeout(id);
  }, [phase, onBattleEnd]);

  /**
   * 플레이어 사망 시 짧은 피격 여운 뒤 패배 장면으로 전환한다.
   */
  useEffect(() => {
    if (phase !== "combat") return;
    if (playerHp > 0) return;

    if (monsterTurnTimeoutRef.current) {
      window.clearTimeout(monsterTurnTimeoutRef.current);
      monsterTurnTimeoutRef.current = null;
    }

    const id = window.setTimeout(() => {
      setPhase("defeat");
      addLog(battleLogText.defeatLog, "text-red-400");
    }, 1400);
    return () => window.clearTimeout(id);
  }, [playerHp, phase, addLog, battleLogText]);

  /**
   * 패배 연출 후 앱 시작 장면으로 되돌린다.
   */
  useEffect(() => {
    if (phase !== "defeat") return;
    const id = window.setTimeout(() => onBattleEnd({ won: false }), 3500);
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
            <TypewriterText text={pickText(language, BATTLE_ENCOUNTER_TEXT)} speed={30} />
            <p className="mt-6 text-center text-[0.9rem] tracking-[0.15em] text-white/40 opacity-0 [animation:fade_1s_4s_forwards]">
              {sceneText.clickToFight}
            </p>
          </div>
        )}

        {phase === "combat" && !playerLoading && !monsterLoading && (
          <BattleCombat
            monsterName={localizedMonsterName}
            monsterAscii={monsterAscii}
            playerAscii={playerAscii}
            equippedItems={equippedItems}
            monsterHp={monsterHp}
            monsterMaxHp={monster.maxHp}
            monsterShield={monsterShield}
            language={language}
            nextIntentLabel={nextIntentLabel}
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
            {sceneText.loadingCombatants}
          </p>
        )}

        {phase === "victory" && (
          <div className="flex flex-col items-center gap-4 animate-fade-in-quick">
            <p className="text-[1.3rem] text-ember tracking-wider [text-shadow:0_0_12px_rgba(255,170,0,0.4)]">
              {interpolateText(battleLogText.victoryBanner, {
                monsterName: localizedMonsterName,
              })}
            </p>
            <p className="text-[0.85rem] text-white/40 tracking-[0.15em]">
              {hasPostBattleEvent ? sceneText.victoryEvent : sceneText.victoryReturn}
            </p>
          </div>
        )}

        {phase === "defeat" && (
          <div className="flex flex-col items-center gap-4 animate-fade-in-quick">
            <p className="text-[1.3rem] tracking-wider text-red-300 [text-shadow:0_0_12px_rgba(220,38,38,0.35)]">
              {sceneText.defeatTitle}
            </p>
            <p className="text-[0.85rem] text-white/40 tracking-[0.15em]">
              {sceneText.defeatReturn}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 소개 문장을 한 글자씩 출력하는 타이프라이터 텍스트 컴포넌트다.
 */
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
