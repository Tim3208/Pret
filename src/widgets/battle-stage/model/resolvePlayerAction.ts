import type { Dispatch, SetStateAction } from "react";
import { BATTLE_LOG_TEXT } from "@/content/text/battle/log";
import { BATTLE_SCENE_TEXT } from "@/content/text/battle/scene";
import {
  type CombatAnimationRequest,
  type PlayerAction,
  PLAYER_TARGET_ID,
  getActionCritChance,
  getActionHitChance,
  getCriticalDamage,
} from "@/entities/combat";
import {
  type Language,
  getLocalizedSpellName,
  interpolateText,
} from "@/entities/locale";
import {
  type PlayerStats,
  getBaseAttackDamage,
  getBaseShield,
  getHealAmount,
  getStabilityTier,
} from "@/entities/player";
import { type Element, getElementMultiplier } from "@/entities/spell";

type BattleLogText = (typeof BATTLE_LOG_TEXT)[Language];
type BattleSceneText = (typeof BATTLE_SCENE_TEXT)[Language];

interface ResolvePlayerActionParams {
  action: PlayerAction;
  addLog: (text: string, color?: string) => void;
  battleLogText: BattleLogText;
  currentMonsterShield: number;
  language: Language;
  localizedMonsterName: string;
  monsterElement?: Element;
  playerMana: number;
  playerMaxHp: number;
  playerStats: PlayerStats;
  shieldOnDefendBonus: number;
  sceneText: BattleSceneText;
  setMonsterHp: Dispatch<SetStateAction<number>>;
  setMonsterShield: Dispatch<SetStateAction<number>>;
  setMonsterStunned: Dispatch<SetStateAction<boolean>>;
  setPlayerHp: Dispatch<SetStateAction<number>>;
  setPlayerMana: Dispatch<SetStateAction<number>>;
  setPlayerShield: Dispatch<SetStateAction<number>>;
}

interface ResolvePlayerActionResult {
  animationRequest: CombatAnimationRequest | CombatAnimationRequest[] | null;
  shouldAdvanceTurn: boolean;
}

/**
 * 플레이어 입력을 전투 규칙에 맞춰 판정하고, 필요한 상태 변경과 애니메이션 요청을 만든다.
 * 훅 본문에는 턴 전환과 스케줄링만 남기고, 실제 액션 분기는 이 resolver에 모은다.
 */
export function resolvePlayerAction({
  action,
  addLog,
  battleLogText,
  currentMonsterShield,
  language,
  localizedMonsterName,
  monsterElement,
  playerMana,
  playerMaxHp,
  playerStats,
  shieldOnDefendBonus,
  sceneText,
  setMonsterHp,
  setMonsterShield,
  setMonsterStunned,
  setPlayerHp,
  setPlayerMana,
  setPlayerShield,
}: ResolvePlayerActionParams): ResolvePlayerActionResult {
  switch (action.type) {
    case "attack": {
      const targetSide = action.targetId === PLAYER_TARGET_ID ? "player" : "enemy";
      const targetName =
        targetSide === "player" ? sceneText.yourself : localizedMonsterName;
      const hitChance = getActionHitChance(action, playerStats, targetSide);
      const critChance = getActionCritChance(action, playerStats, targetSide);
      const didHit = targetSide === "player" || Math.random() < hitChance;
      const didCrit = didHit && Math.random() < critChance;
      const baseDamage = getBaseAttackDamage(playerStats);
      const totalDamage = didCrit ? getCriticalDamage(baseDamage) : baseDamage;

      if (!didHit) {
        return {
          animationRequest: {
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
          },
          shouldAdvanceTurn: true,
        };
      }

      if (targetSide === "enemy") {
        const shieldAbsorb = Math.min(currentMonsterShield, totalDamage);
        const hpDamage = totalDamage - shieldAbsorb;

        return {
          animationRequest: {
            word: "STRIKE",
            fromPlayer: true,
            targetId: action.targetId,
            targetSide,
            kind: "projectile",
            shielded: currentMonsterShield > 0,
            blocked: currentMonsterShield >= totalDamage,
            critical: didCrit,
            impactDamage: hpDamage,
            onImpact: () => {
              if (shieldAbsorb > 0) {
                setMonsterShield((value) => Math.max(0, value - shieldAbsorb));
              }
              setMonsterHp((value) => Math.max(0, value - hpDamage));

              if (shieldAbsorb > 0) {
                addLog(
                  interpolateText(
                    didCrit
                      ? battleLogText.attackShieldCriticalHit
                      : battleLogText.attackShieldHit,
                    { hpDamage, shieldAbsorb },
                  ),
                  didCrit ? "text-yellow-300" : "text-sky-400",
                );
                return;
              }

              addLog(
                interpolateText(
                  didCrit
                    ? battleLogText.attackCriticalHit
                    : battleLogText.attackHit,
                  { damage: totalDamage },
                ),
                didCrit ? "text-yellow-300" : "text-sky-400",
              );
            },
          },
          shouldAdvanceTurn: true,
        };
      }

      return {
        animationRequest: {
          word: "STRIKE",
          fromPlayer: true,
          targetId: action.targetId,
          targetSide,
          kind: "projectile",
          critical: didCrit,
          impactDamage: totalDamage,
          onImpact: () => {
            setPlayerHp((value) => Math.max(0, value - totalDamage));
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
        },
        shouldAdvanceTurn: true,
      };
    }

    case "defend": {
      const shield = getBaseShield(playerStats) + shieldOnDefendBonus;
      setPlayerShield(shield);
      addLog(
        interpolateText(battleLogText.defend, { shield }),
        "text-blue-400",
      );
      return { animationRequest: null, shouldAdvanceTurn: true };
    }

    case "heal": {
      const heal = getHealAmount(playerStats);
      setPlayerHp((value) => Math.min(playerMaxHp, value + heal));
      addLog(
        interpolateText(battleLogText.heal, { heal }),
        "text-green-400",
      );
      return { animationRequest: null, shouldAdvanceTurn: true };
    }

    case "spell": {
      const { spell, mode } = action;
      const spellDisplayName = getLocalizedSpellName(spell.name, language);
      const tier = getStabilityTier(playerStats.stability);
      if (spell.tier > tier) {
        addLog(
          interpolateText(battleLogText.spellNeedStability, {
            tier: spell.tier,
          }),
          "text-red-400",
        );
        return { animationRequest: null, shouldAdvanceTurn: false };
      }

      if (playerMana < spell.manaCost) {
        addLog(
          interpolateText(battleLogText.spellNeedMana, {
            manaCost: spell.manaCost,
          }),
          "text-red-400",
        );
        return { animationRequest: null, shouldAdvanceTurn: false };
      }

      setPlayerMana((value) => value - spell.manaCost);

      if (mode === "attack") {
        const targetSide = action.targetId === PLAYER_TARGET_ID ? "player" : "enemy";
        const targetName =
          targetSide === "player" ? sceneText.yourself : localizedMonsterName;
        const hitChance = getActionHitChance(action, playerStats, targetSide);
        const critChance = getActionCritChance(action, playerStats, targetSide);
        const didHit = targetSide === "player" || Math.random() < hitChance;
        const didCrit = didHit && Math.random() < critChance;

        let damage = spell.baseDamage;
        let elementLog: { color: string; text: string } | null = null;
        if (targetSide === "enemy" && monsterElement) {
          const multiplier = getElementMultiplier(spell.element, monsterElement);
          damage = Math.round(damage * multiplier);
          if (multiplier > 1) {
            elementLog = {
              text: sceneText.elementalWeakness,
              color: "text-yellow-300",
            };
          } else if (multiplier < 1) {
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
          return {
            animationRequest: {
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
            },
            shouldAdvanceTurn: true,
          };
        }

        if (targetSide === "enemy") {
          const shieldAbsorb = Math.min(currentMonsterShield, damage);
          const hpDamage = damage - shieldAbsorb;

          return {
            animationRequest: {
              word: spell.name.toUpperCase(),
              fromPlayer: true,
              targetId: action.targetId,
              targetSide,
              kind: "projectile",
              element: spell.element,
              shielded: currentMonsterShield > 0,
              blocked: currentMonsterShield >= damage,
              critical: didCrit,
              impactDamage: hpDamage,
              onImpact: () => {
                if (shieldAbsorb > 0) {
                  setMonsterShield((value) => Math.max(0, value - shieldAbsorb));
                }
                if (elementLog) {
                  addLog(elementLog.text, elementLog.color);
                }
                setMonsterHp((value) => Math.max(0, value - hpDamage));
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
            },
            shouldAdvanceTurn: true,
          };
        }

        return {
          animationRequest: {
            word: spell.name.toUpperCase(),
            fromPlayer: true,
            targetId: action.targetId,
            targetSide,
            kind: "projectile",
            element: spell.element,
            critical: didCrit,
            impactDamage: damage,
            onImpact: () => {
              setPlayerHp((value) => Math.max(0, value - damage));
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
          },
          shouldAdvanceTurn: true,
        };
      }

      const shield =
        spell.baseShield + Math.floor(playerStats.agility * 0.5) + shieldOnDefendBonus;
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
        setPlayerHp((value) => Math.min(playerMaxHp, value + spell.healOnDefend));
        addLog(
          interpolateText(battleLogText.spellDefendHeal, {
            heal: spell.healOnDefend,
          }),
          "text-green-300",
        );
      }

      return { animationRequest: null, shouldAdvanceTurn: true };
    }

    case "prompt": {
      const { evaluation } = action;
      const attackSteps = evaluation.steps.filter((step) => step.verb === "attack");
      const promptShieldGain =
        evaluation.shieldGain > 0
          ? evaluation.shieldGain + shieldOnDefendBonus
          : 0;
      const actionWord =
        evaluation.runeCount > 0
          ? "XLEW"
          : evaluation.contrastCount > 0
            ? "UBT"
            : evaluation.connectorCount > 0
              ? "MOR"
              : evaluation.steps[0]?.verb === "defend"
                ? "WARD"
                : "STRIKE";

      /**
       * prompt 반동 자원 손실과 로그를 한 번에 적용한다.
       */
      const applyPromptBacklashCosts = (
        logText: string,
        logColor: string,
      ) => {
        if (evaluation.selfManaCost > 0) {
          setPlayerMana((value) => Math.max(0, value - evaluation.selfManaCost));
        }

        if (evaluation.selfHpCost > 0) {
          setPlayerHp((value) => Math.max(0, value - evaluation.selfHpCost));
        }

        addLog(
          interpolateText(logText, {
            hpCost: evaluation.selfHpCost,
            manaCost: evaluation.selfManaCost,
          }),
          logColor,
        );
      };

      /**
       * prompt 반동이 체력 피해를 줄 때 플레이어 쪽으로 되돌아오는 투사체를 만든다.
       */
      const buildPromptBacklashAnimation = (
        logText: string,
        logColor: string,
        delayMs: number = 0,
      ): CombatAnimationRequest | null => {
        if (evaluation.selfHpCost <= 0) {
          return null;
        }

        return {
          word: actionWord,
          fromPlayer: true,
          targetId: PLAYER_TARGET_ID,
          targetSide: "player",
          kind: "projectile",
          delayMs,
          durationMs: 1040,
          impactDamage: evaluation.selfHpCost,
          onImpact: () => {
            applyPromptBacklashCosts(logText, logColor);
          },
        } satisfies CombatAnimationRequest;
      };

      if (evaluation.outcome === "failure") {
        const backlashAnimation = buildPromptBacklashAnimation(
          battleLogText.promptFailure,
          "text-red-400",
        );

        if (backlashAnimation) {
          return {
            animationRequest: backlashAnimation,
            shouldAdvanceTurn: true,
          };
        }

        applyPromptBacklashCosts(battleLogText.promptFailure, "text-red-400");
        return { animationRequest: null, shouldAdvanceTurn: true };
      }

      if (evaluation.attackDamage > 0) {
        const hitChance = getActionHitChance(action, playerStats, "enemy");
        const critChance = getActionCritChance(action, playerStats, "enemy");
        const guaranteedMultiStrike =
          evaluation.connectorCount > 0 && attackSteps.length > 1;
        let remainingMonsterShield = currentMonsterShield;

        const finalizePromptSequence = (missed: boolean) => {
          if (promptShieldGain > 0) {
            setPlayerShield(promptShieldGain);
            addLog(
              interpolateText(
                missed
                  ? battleLogText.promptMissShield
                  : battleLogText.promptShieldGainOnHit,
                {
                  shield: promptShieldGain,
                },
              ),
              "text-blue-300",
            );
          }
        };

        const attackRequests = attackSteps.map((step, index) => {
          const didHit = guaranteedMultiStrike || Math.random() < hitChance;
          const didCrit = didHit && Math.random() < critChance;
          const stepElement = step.rune ? evaluation.element : undefined;
          let damage = Math.max(1, Math.round(getBaseAttackDamage(playerStats) * step.multiplier));
          let elementLog: { text: string; color: string } | null = null;

          if (monsterElement && stepElement) {
            const multiplier = getElementMultiplier(stepElement, monsterElement);
            damage = Math.round(damage * multiplier);
            if (multiplier > 1) {
              elementLog = {
                text: sceneText.elementalWeakness,
                color: "text-yellow-300",
              };
            } else if (multiplier < 1) {
              elementLog = {
                text: sceneText.elementalResistance,
                color: "text-gray-400",
              };
            }
          }

          if (didCrit) {
            damage = getCriticalDamage(damage);
          }

          const isLastAttack = index === attackSteps.length - 1;

          if (!didHit) {
            return {
              word: actionWord,
              fromPlayer: true,
              targetId: "monster",
              targetSide: "enemy",
              kind: "projectile",
              charged: step.contrast,
              delayMs: index * 340,
              durationMs: step.contrast ? 1220 : 920,
              element: stepElement,
              missed: true,
              onImpact: () => {
                addLog(
                  interpolateText(battleLogText.promptMiss, {
                    actionWord,
                  }),
                  "text-white/40",
                );

                if (isLastAttack) {
                  finalizePromptSequence(true);
                }
              },
            } satisfies CombatAnimationRequest;
          }

          return {
            word: actionWord,
            fromPlayer: true,
            targetId: "monster",
            targetSide: "enemy",
            kind: "projectile",
            charged: step.contrast,
            delayMs: index * 340,
            durationMs: step.contrast ? 1220 : 920,
            element: stepElement,
            shielded: remainingMonsterShield > 0,
            blocked: remainingMonsterShield >= damage,
            critical: didCrit,
            impactDamage: Math.max(0, damage - Math.min(remainingMonsterShield, damage)),
            onImpact: () => {
              const shieldAbsorb = Math.min(remainingMonsterShield, damage);
              const hpDamage = damage - shieldAbsorb;
              remainingMonsterShield = Math.max(0, remainingMonsterShield - shieldAbsorb);

              if (shieldAbsorb > 0) {
                setMonsterShield(remainingMonsterShield);
              }
              if (elementLog) {
                addLog(elementLog.text, elementLog.color);
              }

              setMonsterHp((value) => Math.max(0, value - hpDamage));

              addLog(
                interpolateText(
                  shieldAbsorb > 0
                    ? didCrit
                      ? battleLogText.promptShieldCriticalHit
                      : battleLogText.promptShieldHit
                    : didCrit
                      ? battleLogText.promptCriticalHit
                      : battleLogText.promptHit,
                  {
                    actionWord,
                    damage,
                    hpDamage,
                    shieldAbsorb,
                  },
                ),
                didCrit ? "text-yellow-300" : "text-cyan-300",
              );

              if (isLastAttack) {
                finalizePromptSequence(false);
              }
            },
          } satisfies CombatAnimationRequest;
        });

        const backlashDelay =
          attackRequests.reduce((latest, request) => {
            return Math.max(
              latest,
              (request.delayMs ?? 0) + (request.durationMs ?? 0),
            );
          }, 0) + 140;
        const backlashAnimation = buildPromptBacklashAnimation(
          battleLogText.promptBacklash,
          "text-amber-300",
          backlashDelay,
        );

        return {
          animationRequest: backlashAnimation
            ? [...attackRequests, backlashAnimation]
            : attackRequests,
          shouldAdvanceTurn: true,
        };
      }

      if (promptShieldGain > 0) {
        setPlayerShield(promptShieldGain);
        addLog(
          interpolateText(battleLogText.promptShieldOnly, {
            shield: promptShieldGain,
          }),
          "text-blue-300",
        );
      }

      const backlashAnimation = buildPromptBacklashAnimation(
        battleLogText.promptBacklash,
        "text-amber-300",
      );

      if (backlashAnimation) {
        return {
          animationRequest: backlashAnimation,
          shouldAdvanceTurn: true,
        };
      }

      applyPromptBacklashCosts(battleLogText.promptBacklash, "text-amber-300");
      return { animationRequest: null, shouldAdvanceTurn: true };
    }
  }
}
