import type { Dispatch, SetStateAction } from "react";
import { BATTLE_LOG_TEXT } from "@/content/text/battle/log";
import {
  type CombatAnimationRequest,
  PLAYER_TARGET_ID,
} from "@/entities/combat";
import {
  type Language,
  getLocalizedMonsterIntentLabel,
  interpolateText,
} from "@/entities/locale";
import type { MonsterIntent } from "@/entities/monster";

type BattleLogText = (typeof BATTLE_LOG_TEXT)[Language];

interface ResolveMonsterTurnParams {
  addLog: (text: string, color?: string) => void;
  battleLogText: BattleLogText;
  finishMonsterTurn: () => void;
  isTurnResolved: () => boolean;
  language: Language;
  localizedMonsterName: string;
  monsterMaxHp?: number;
  monsterStunned: boolean;
  nextIntent: MonsterIntent;
  playerShield: number;
  projectileCallback: ((request: CombatAnimationRequest) => void) | null;
  setMonsterHp?: Dispatch<SetStateAction<number>>;
  scheduleTimeout: (callback: () => void, delay: number) => void;
  setMonsterShield: Dispatch<SetStateAction<number>>;
  setMonsterStunned: Dispatch<SetStateAction<boolean>>;
  setPlayerHp: Dispatch<SetStateAction<number>>;
  setPlayerShield: Dispatch<SetStateAction<number>>;
  skipAnimation?: boolean;
  trimIntentLabel: (label: string) => string;
}

/**
 * 몬스터 턴 한 번의 규칙 판정과 후속 애니메이션/타이머 연결을 처리한다.
 * `useBattleFlow`에는 턴 스케줄링만 남기고, 몬스터 행동 분기 자체는 이 resolver에 모은다.
 */
export function resolveMonsterTurn({
  addLog,
  battleLogText,
  finishMonsterTurn,
  isTurnResolved,
  language,
  localizedMonsterName,
  monsterMaxHp,
  monsterStunned,
  nextIntent,
  playerShield,
  projectileCallback,
  setMonsterHp,
  scheduleTimeout,
  setMonsterShield,
  setMonsterStunned,
  setPlayerHp,
  setPlayerShield,
  skipAnimation = false,
  trimIntentLabel,
}: ResolveMonsterTurnParams) {
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
    return finishMonsterTurn;
  }

  if (nextIntent.kind === "defend") {
    const shield = 8;
    setMonsterShield(shield);
    addLog(
      interpolateText(battleLogText.monsterDefend, {
        monsterName: localizedMonsterName,
        shield,
      }),
      "text-orange-300",
    );

    if (skipAnimation) {
      finishMonsterTurn();
    } else {
      scheduleTimeout(finishMonsterTurn, 920);
    }

    return finishMonsterTurn;
  }

  if (nextIntent.kind === "heal") {
    const heal = Math.max(0, nextIntent.healing ?? 0);
    const localizedIntent = trimIntentLabel(
      getLocalizedMonsterIntentLabel(nextIntent.label, language),
    );

    if (heal > 0 && setMonsterHp && monsterMaxHp !== undefined) {
      setMonsterHp((value) => Math.min(monsterMaxHp, value + heal));
    }

    addLog(
      interpolateText(battleLogText.monsterHeal, {
        heal,
        intentLabel: localizedIntent,
        monsterName: localizedMonsterName,
      }),
      "text-green-300",
    );

    if (skipAnimation) {
      finishMonsterTurn();
    } else {
      scheduleTimeout(finishMonsterTurn, 920);
    }

    return finishMonsterTurn;
  }

  const damage = nextIntent.damage;
  const absorbed = Math.min(playerShield, damage);
  const hpDamage = damage - absorbed;
  const blocked = playerShield >= damage;
  const shielded = absorbed > 0;
  const localizedIntent = trimIntentLabel(
    getLocalizedMonsterIntentLabel(nextIntent.label, language),
  );

  const resolveMonsterHit = () => {
    if (isTurnResolved()) {
      return;
    }

    if (absorbed > 0) {
      setPlayerShield((value) => Math.max(0, value - absorbed));
      if (hpDamage > 0) {
        addLog(
          interpolateText(battleLogText.monsterHitThroughShield, {
            absorbed,
            hpDamage,
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
          damage,
          intentLabel: localizedIntent,
        }),
        "text-red-400",
      );
    }

    setPlayerHp((value) => Math.max(0, value - hpDamage));
    if (skipAnimation) {
      finishMonsterTurn();
      return;
    }

    const recoveryDelay = hpDamage > 0 ? 760 : shielded ? 520 : 120;
    if (recoveryDelay > 0) {
      scheduleTimeout(finishMonsterTurn, recoveryDelay);
    } else {
      finishMonsterTurn();
    }
  };

  if (!skipAnimation && projectileCallback) {
    projectileCallback({
      word: nextIntent.element?.toUpperCase() ?? nextIntent.kind.toUpperCase(),
      fromPlayer: false,
      targetId: PLAYER_TARGET_ID,
      targetSide: "player",
      kind: "crescent-slash",
      element: nextIntent.element,
      shielded,
      blocked,
      impactDamage: hpDamage,
      onImpact: resolveMonsterHit,
    });
  } else {
    resolveMonsterHit();
  }

  return resolveMonsterHit;
}
