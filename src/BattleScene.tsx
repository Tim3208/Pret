import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BattleCombat from "./BattleCombat";
import SkullEncounter from "./SkullEncounter";
import { useAsciiAsset } from "./useAsciiAsset";
import {
  type Language,
  getLocalizedMonsterIntentLabel,
  getLocalizedMonsterName,
  getLocalizedSpellName,
  pickText,
} from "./language";
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

const ENCOUNTER_TEXT = {
  en:
    "A twisted figure emerges from the shadows, its body a mass of writhing dark tendrils, " +
    "two pale eyes burning with cold malice. The Hollow Wraith lets out a guttural screech " +
    "that rattles your bones. The air thickens, and the temperature drops.",
  ko:
    "비틀린 형상이 그림자 속에서 모습을 드러낸다. 뒤엉킨 검은 촉수로 이루어진 육체와, " +
    "차가운 악의로 타오르는 창백한 두 눈이 어둠을 가른다. 공허의 망령이 뼈를 울리는 듯한 " +
    "거친 비명을 지르자 공기가 무거워지고 온도가 뚝 떨어진다.",
} as const;

const AMBIENT_LINES = {
  en: [
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
  ],
  ko: [
    "그림자가 망령의 촉수 주위를 소용돌이친다.",
    "공기에서 쇠와 부패의 맛이 난다.",
    "허공을 가르는 바람 소리가 스민다.",
    "차가운 서리가 돌바닥을 타고 번진다.",
    "망령의 눈빛이 희미한 굶주림으로 맥동한다.",
    "어둠 깊은 곳에서 낮은 울림이 퍼진다.",
    "차가운 공기 속에 입김이 하얗게 흩어진다.",
    "희미한 불씨가 눅눅한 어둠 사이를 떠돈다.",
    "침묵이 무게처럼 짓눌러 온다.",
    "더 깊은 그림자 속에서 무언가 꿈틀댄다.",
  ],
} as const;

const BATTLE_SCENE_TEXT = {
  en: {
    selfTargetName: "You",
    yourself: "yourself",
    battleBegins: "The battle begins!",
    clickToFight: "[ click to fight ]",
    loadingCombatants: "Loading combatants...",
    victoryReturn: "Returning to the bonfire...",
    defeatTitle: "You fall in the dark.",
    defeatReturn: "Returning to the campfire...",
    enemyStunned: "Enemy stunned!",
    elementalWeakness: "Elemental weakness! Super effective!",
    elementalResistance: "Elemental resistance... not very effective.",
  },
  ko: {
    selfTargetName: "당신",
    yourself: "당신 자신",
    battleBegins: "전투가 시작된다!",
    clickToFight: "[ 클릭하여 전투 ]",
    loadingCombatants: "전투원을 불러오는 중...",
    victoryReturn: "모닥불로 돌아가는 중...",
    defeatTitle: "어둠 속에 쓰러졌다.",
    defeatReturn: "모닥불로 돌아가는 중...",
    enemyStunned: "적이 기절했다!",
    elementalWeakness: "원소 약점 적중! 큰 피해!",
    elementalResistance: "원소 저항... 피해가 줄었다.",
  },
} as const;

export interface BattleResult {
  won: boolean;
}

interface Props {
  language: Language;
  onBattleEnd: (result: BattleResult) => void;
}

/**
 * 전투 진입, 턴 진행, 승패 전환을 관리하는 전투 장면 컨테이너다.
 */
export default function BattleScene({ language, onBattleEnd }: Props) {
  const { lines: playerAscii, loading: playerLoading } = useAsciiAsset(
    "/assets/new_hero_ascii.md",
  );
  const { lines: monsterAscii, loading: monsterLoading } = useAsciiAsset(
    "/assets/new_enemy_ascii.md",
  );

  const monster = HOLLOW_WRAITH;
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
    const lines = AMBIENT_LINES[language];
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
      language === "ko"
        ? `진홍 물약이 몸 위에서 터진다... HP +${healAmount}`
        : `The crimson flask bursts over you... +${healAmount} HP`,
      "text-green-300",
    );
    return healAmount;
  }, [addLog, language, maxHp, phase, playerHp, potionUsed, stats]);

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
                  language === "ko"
                    ? `일격이 ${targetName}에게 빗나갔다!`
                    : `Strike misses ${targetName}!`,
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
                    didCrit
                      ? language === "ko"
                        ? `치명타! 방어막이 ${shieldAbsorb} 막아내고 ${hpDmg} 피해를 입혔다!`
                        : `Critical strike! ${shieldAbsorb} absorbed, ${hpDmg} damage!`
                      : language === "ko"
                        ? `일격! 방어막이 ${shieldAbsorb} 막아내고 ${hpDmg} 피해를 입혔다!`
                        : `Strike! ${shieldAbsorb} absorbed, ${hpDmg} damage!`,
                    didCrit ? "text-yellow-300" : "text-sky-400",
                  );
                } else {
                  addLog(
                    didCrit
                      ? language === "ko"
                        ? `치명타! ${totalDamage} 피해!`
                        : `Critical strike! ${totalDamage} damage!`
                      : language === "ko"
                        ? `일격! ${totalDamage} 피해!`
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
                  ? language === "ko"
                    ? `치명타! 당신 자신에게 ${totalDamage} 피해를 입혔다!`
                    : `Critical strike! You hit yourself for ${totalDamage} damage!`
                  : language === "ko"
                    ? `당신 자신을 공격해 ${totalDamage} 피해를 입었다!`
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
          addLog(
            language === "ko" ? `방어 태세! 방어막 +${shield}!` : `Brace! Shield +${shield}!`,
            "text-blue-400",
          );
          break;
        }
        case "heal": {
          const heal = getHealAmount(stats);
          setPlayerHp((v) => Math.min(maxHp, v + heal));
          addLog(
            language === "ko" ? `호흡을 가다듬는다... HP +${heal}.` : `Steady breath... +${heal} HP.`,
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
              language === "ko"
                ? `문해력이 부족하다... (필요 티어 ${spell.tier})`
                : `Not enough literacy... (need tier ${spell.tier})`,
              "text-red-400",
            );
            return;
          }
          if (playerMana < spell.manaCost) {
            addLog(
              language === "ko"
                ? `마나가 부족하다! (${spell.manaCost} 필요)`
                : `Not enough mana! (need ${spell.manaCost})`,
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
                    language === "ko"
                      ? `${spellDisplayName}이(가) ${targetName}에게 빗나갔다! (MP -${spell.manaCost})`
                      : `${spellDisplayName} misses ${targetName}! (MP -${spell.manaCost})`,
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
                      ? language === "ko"
                        ? `치명적인 ${spellDisplayName}! ${damage} 피해! (MP -${spell.manaCost})`
                        : `Critical ${spellDisplayName}! ${damage} damage! (MP -${spell.manaCost})`
                      : language === "ko"
                        ? `${spellDisplayName}! ${damage} 피해! (MP -${spell.manaCost})`
                        : `${spellDisplayName}! ${damage} damage! (MP -${spell.manaCost})`,
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
                  didCrit
                    ? language === "ko"
                      ? `치명적인 ${spellDisplayName}! 당신이 ${damage} 피해를 입었다. (MP -${spell.manaCost})`
                      : `Critical ${spellDisplayName}! You take ${damage} damage. (MP -${spell.manaCost})`
                    : language === "ko"
                      ? `${spellDisplayName}이(가) 당신 자신에게 ${damage} 피해를 주었다. (MP -${spell.manaCost})`
                      : `${spellDisplayName} hits yourself for ${damage} damage. (MP -${spell.manaCost})`,
                  didCrit ? "text-yellow-300" : "text-red-400",
                );
              },
            };
          } else {
            // defend mode
            const shield = spell.baseShield + Math.floor(stats.agility * 0.5);
            setPlayerShield(shield);
            addLog(
              language === "ko"
                ? `${spellDisplayName} 수호! 방어막 +${shield}! (MP -${spell.manaCost})`
                : `${spellDisplayName} ward! Shield +${shield}! (MP -${spell.manaCost})`,
              "text-teal-300",
            );
            if (spell.healOnDefend > 0) {
              setPlayerHp((v) => Math.min(maxHp, v + spell.healOnDefend));
              addLog(
                language === "ko"
                  ? `자연의 힘이 상처를 메운다... HP +${spell.healOnDefend}`
                  : `Nature mends your wounds... +${spell.healOnDefend} HP`,
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
          language === "ko"
            ? `${localizedMonsterName}은(는) 기절해 움직이지 못한다!`
            : `${localizedMonsterName} is stunned and cannot act!`,
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
          language === "ko"
            ? `${localizedMonsterName}이(가) 몸을 굳히며 방어한다! (방어막 ${shieldVal})`
            : `${localizedMonsterName} hardens its guard! (Shield ${shieldVal})`,
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
              language === "ko"
                ? `${localizedIntent} - ${absorbed} 막아내고 ${hpDmg} 피해!`
                : `${localizedIntent} - ${absorbed} blocked, ${hpDmg} damage!`,
              "text-red-400",
            );
          } else {
            addLog(
              language === "ko"
                ? `${localizedIntent} - 방어막이 완전히 막아냈다!`
                : `${localizedIntent} - fully blocked by shield!`,
              "text-blue-400",
            );
          }
        } else {
          addLog(
            language === "ko"
              ? `${localizedIntent} - ${dmg} 피해!`
              : `${localizedIntent} - ${dmg} damage!`,
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
          language === "ko"
            ? `${localizedMonsterName}을(를) 쓰러뜨렸다!`
            : `${localizedMonsterName} has been slain!`,
          "text-yellow-400",
        );
      }, 1900);
      return () => window.clearTimeout(id);
    }
  }, [monsterHp, phase, addLog, language, localizedMonsterName]);

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
      addLog(
        language === "ko"
          ? "망령의 맹공에 무너졌다."
          : "You collapse beneath the wraith's assault.",
        "text-red-400",
      );
    }, 1400);
    return () => window.clearTimeout(id);
  }, [playerHp, phase, addLog, language]);

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
            <TypewriterText text={pickText(language, ENCOUNTER_TEXT)} speed={30} />
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
              {language === "ko"
                ? `${localizedMonsterName}을(를) 쓰러뜨렸다.`
                : `${localizedMonsterName} has been slain.`}
            </p>
            <p className="text-[0.85rem] text-white/40 tracking-[0.15em]">
              {sceneText.victoryReturn}
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
