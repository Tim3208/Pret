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
  getLiteracyTier,
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
  sceneText: BattleSceneText;
  setMonsterHp: Dispatch<SetStateAction<number>>;
  setMonsterShield: Dispatch<SetStateAction<number>>;
  setMonsterStunned: Dispatch<SetStateAction<boolean>>;
  setPlayerHp: Dispatch<SetStateAction<number>>;
  setPlayerMana: Dispatch<SetStateAction<number>>;
  setPlayerShield: Dispatch<SetStateAction<number>>;
}

interface ResolvePlayerActionResult {
  animationRequest: CombatAnimationRequest | null;
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
      const shield = getBaseShield(playerStats);
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
      const tier = getLiteracyTier(playerStats.literacy);
      if (spell.tier > tier) {
        addLog(
          interpolateText(battleLogText.spellNeedLiteracy, {
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

      const shield = spell.baseShield + Math.floor(playerStats.agility * 0.5);
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
  }
}
