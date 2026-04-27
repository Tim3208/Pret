import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BATTLE_LOG_TEXT } from "@/content/text/battle/log";
import {
  BATTLE_AMBIENT_LINES,
  BATTLE_SCENE_TEXT,
} from "@/content/text/battle/scene";
import {
  type BattleLogEntry,
  type BattleTargetOption,
  type CombatAnimationRequest,
  type PlayerAction,
  MONSTER_TARGET_ID,
  PLAYER_TARGET_ID,
} from "@/entities/combat";
import { type EquippedItems, applyEquipmentModifiers } from "@/entities/equipment";
import {
  type Language,
  getLocalizedMonsterAmbientLines,
  getLocalizedMonsterName,
  interpolateText,
} from "@/entities/locale";
import {
  HOLLOW_WRAITH,
  getMonsterIntentTelegraph,
  type MonsterDef,
  type MonsterIntent,
  pickMonsterIntent,
} from "@/entities/monster";
import {
  DEFAULT_STATS,
  getHealAmount,
  getMaxHp,
  getMaxMana,
  type PlayerStats,
} from "@/entities/player";
import type { BonfireMealEffect } from "@/entities/run";
import { resolveMonsterTurn } from "./resolveMonsterTurn";
import { resolvePlayerAction } from "./resolvePlayerAction";

type BattlePhase = "encounter" | "intro" | "combat" | "victory" | "defeat";

interface UseBattleFlowParams {
  baseStats?: PlayerStats;
  equippedItems: EquippedItems;
  initialHp?: number;
  initialMana?: number;
  initialPotionCharges?: number;
  language: Language;
  mealEffect?: BonfireMealEffect | null;
  monster?: MonsterDef;
  onBattleEnd: (result: {
    won: boolean;
    defeatedMonsterName?: string;
    experienceReward?: number;
    remainingHp?: number;
    remainingMana?: number;
    remainingPotionCharges?: number;
  }) => void;
}

/**
 * 전투 장면에서 사용하는 상태 전환, 턴 처리, 승패 판정을 한곳에서 관리한다.
 */
export function useBattleFlow({
  baseStats,
  equippedItems,
  initialHp,
  initialMana,
  initialPotionCharges = 1,
  language,
  mealEffect = null,
  monster,
  onBattleEnd,
}: UseBattleFlowParams) {
  const activeMonster = monster ?? HOLLOW_WRAITH;
  const battleLogText = BATTLE_LOG_TEXT[language];
  const sceneText = BATTLE_SCENE_TEXT[language];
  const localizedMonsterName = getLocalizedMonsterName(activeMonster.name, language);
  const combatStats = useMemo(
    () => applyEquipmentModifiers(baseStats ?? DEFAULT_STATS, equippedItems),
    [baseStats, equippedItems],
  );
  const playerStats: PlayerStats = combatStats.stats;
  const playerMaxHp = getMaxHp(playerStats) + combatStats.maxHpBonus;
  const playerMaxMana = getMaxMana(playerStats) + combatStats.maxManaBonus;
  const attackDamageBonus = mealEffect?.attackDamageBonus ?? 0;
  const mealShieldOnDefendBonus = mealEffect?.shieldOnDefendBonus ?? 0;

  const [phase, setPhase] = useState<BattlePhase>("encounter");
  const [playerHp, setPlayerHp] = useState(() => Math.max(1, Math.min(initialHp ?? playerMaxHp, playerMaxHp)));
  const [playerMana, setPlayerMana] = useState(() => Math.max(0, Math.min(initialMana ?? playerMaxMana, playerMaxMana)));
  const [playerShield, setPlayerShield] = useState(0);
  const [monsterHp, setMonsterHp] = useState(activeMonster.maxHp);
  const [monsterShield, setMonsterShield] = useState(0);
  const [monsterStunned, setMonsterStunned] = useState(false);
  const [turn, setTurn] = useState<"player" | "monster">("player");
  const [nextIntent, setNextIntent] = useState<MonsterIntent>(() =>
    pickMonsterIntent(activeMonster),
  );
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [ambientIndex, setAmbientIndex] = useState(0);
  const [potionCharges, setPotionCharges] = useState(() => Math.max(0, initialPotionCharges));

  const ambientText = useMemo(() => {
    const lines = getLocalizedMonsterAmbientLines(activeMonster.name, language);
    if (lines.length === 0) {
      const fallbackLines = BATTLE_AMBIENT_LINES[language];
      return fallbackLines[ambientIndex % fallbackLines.length];
    }

    return lines[ambientIndex % lines.length];
  }, [activeMonster.name, ambientIndex, language]);

  const nextIntentLabel = useMemo(
    () => getMonsterIntentTelegraph(nextIntent, playerStats.decipher, language),
    [language, nextIntent, playerStats.decipher],
  );

  const targetOptions = useMemo<BattleTargetOption[]>(
    () => [
      { id: PLAYER_TARGET_ID, name: sceneText.selfTargetName, side: "player" },
      { id: MONSTER_TARGET_ID, name: localizedMonsterName, side: "enemy" },
    ],
    [localizedMonsterName, sceneText.selfTargetName],
  );

  const victoryBannerText = useMemo(
    () =>
      interpolateText(battleLogText.victoryBanner, {
        monsterName: localizedMonsterName,
      }),
    [battleLogText.victoryBanner, localizedMonsterName],
  );

  const addLog = useCallback((text: string, color?: string) => {
    setBattleLog((prev) => [...prev.slice(-30), { text, color }]);
  }, []);

  const trimIntentLabel = useCallback(
    (label: string) => label.replace(/\.\.\.$/, ""),
    [],
  );

  const rollNextIntent = useCallback(() => {
    setNextIntent(pickMonsterIntent(activeMonster));
  }, [activeMonster]);

  const handleEncounterDone = useCallback(() => setPhase("intro"), []);

  const handleIntroDone = useCallback(() => {
    setPhase("combat");
    addLog(sceneText.battleBegins, "text-ember");
    if (mealEffect) {
      addLog(
        interpolateText(battleLogText.mealEffectStart, {
          attack: mealEffect.attackDamageBonus,
          shield: mealEffect.shieldOnDefendBonus,
        }),
        "text-amber-200",
      );
    }
  }, [addLog, battleLogText, mealEffect, sceneText.battleBegins]);

  /**
   * 포션 사용 가능 여부를 검사하고 실제 회복량을 반환한다.
   */
  const handlePotionUse = useCallback(() => {
    if (phase !== "combat" || potionCharges <= 0 || playerHp >= playerMaxHp) {
      return 0;
    }

    const healAmount = Math.min(
      playerMaxHp - playerHp,
      Math.max(8, getHealAmount(playerStats) + 3),
    );
    if (healAmount <= 0) {
      return 0;
    }

    setPotionCharges((value) => Math.max(0, value - 1));
    setPlayerHp((value) => Math.min(playerMaxHp, value + healAmount));
    addLog(
      interpolateText(battleLogText.potionUse, { healAmount }),
      "text-green-300",
    );
    return healAmount;
  }, [
    addLog,
    battleLogText,
    phase,
    potionCharges,
    playerHp,
    playerMaxHp,
    playerStats,
  ]);

  const monsterShieldRef = useRef(monsterShield);
  const playerActionCommittedRef = useRef(false);
  const monsterTurnTimeoutRef = useRef<number | null>(null);
  const monsterTurnFastForwardRef = useRef<(() => void) | null>(null);
  const projectileCallbackRef = useRef<((request: CombatAnimationRequest) => void) | null>(null);

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
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  /**
   * 플레이어가 선택한 행동을 판정하고 몬스터 턴으로 넘길 준비를 한다.
   */
  const handlePlayerAction = useCallback(
    (action: PlayerAction) => {
      if (turn !== "player" || playerActionCommittedRef.current) {
        return;
      }

      setPlayerShield(0);

      const { animationRequest, shouldAdvanceTurn } = resolvePlayerAction({
        action,
        addLog,
        attackDamageBonus,
        battleLogText,
        currentMonsterShield: monsterShieldRef.current,
        language,
        localizedMonsterName,
        monsterElement: activeMonster.element,
        playerMana,
        playerMaxHp,
        playerStats,
        shieldOnDefendBonus: combatStats.shieldOnDefendBonus + mealShieldOnDefendBonus,
        sceneText,
        setMonsterHp,
        setMonsterShield,
        setMonsterStunned,
        setPlayerHp,
        setPlayerMana,
        setPlayerShield,
      });

      if (!shouldAdvanceTurn) {
        return;
      }

      const animationRequests = !animationRequest
        ? []
        : Array.isArray(animationRequest)
          ? animationRequest
          : [animationRequest];

      const turnDelay = animationRequests.length > 0
        ? Math.max(
          ...animationRequests.map((request) => {
            const baseDuration =
              request.durationMs ??
              (request.kind === "crescent-slash"
                ? 1050
                : request.charged
                  ? 1220
                  : 920);
            return (request.delayMs ?? 0) + baseDuration + 1000;
          }),
        )
        : 400;

      playerActionCommittedRef.current = true;
      if (monsterTurnTimeoutRef.current) {
        window.clearTimeout(monsterTurnTimeoutRef.current);
      }
      monsterTurnTimeoutRef.current = window.setTimeout(() => {
        monsterTurnTimeoutRef.current = null;
        setTurn("monster");
      }, turnDelay);

      if (animationRequests.length > 0) {
        if (projectileCallbackRef.current) {
          animationRequests.forEach((request) => {
            projectileCallbackRef.current?.(request);
          });
        } else {
          animationRequests.forEach((request) => {
            if ((request.delayMs ?? 0) > 0) {
              window.setTimeout(() => request.onImpact?.(), request.delayMs);
              return;
            }

            request.onImpact?.();
          });
        }
      }
    },
    [
      turn,
      playerStats,
      combatStats.shieldOnDefendBonus,
      attackDamageBonus,
      mealShieldOnDefendBonus,
      playerMaxHp,
      playerMana,
      activeMonster,
      addLog,
      battleLogText,
      language,
      localizedMonsterName,
      sceneText,
    ],
  );

  const nextIntentRef = useRef(nextIntent);
  const monsterHpRef = useRef(monsterHp);
  const playerShieldRef = useRef(playerShield);

  useEffect(() => {
    nextIntentRef.current = nextIntent;
    monsterHpRef.current = monsterHp;
    playerShieldRef.current = playerShield;
  }, [monsterHp, nextIntent, playerShield]);

  useEffect(() => {
    if (turn !== "monster") {
      return;
    }
    if (monsterHpRef.current <= 0) {
      return;
    }

    const timeoutIds: number[] = [];
    let turnResolved = false;
    let actionStarted = false;
    let pendingResolve: (() => void) | null = null;

    const clearTurnTimeouts = () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
      timeoutIds.length = 0;
    };

    const finishMonsterTurn = () => {
      if (turnResolved) {
        return;
      }
      turnResolved = true;
      playerActionCommittedRef.current = false;
      setAmbientIndex((value) => value + 1);
      rollNextIntent();
      setTurn("player");
    };

    const executeMonsterAction = (skipAnimation = false) => {
      if (turnResolved) {
        return;
      }
      if (actionStarted) {
        if (skipAnimation) {
          pendingResolve?.();
        }
        return;
      }
      actionStarted = true;

      pendingResolve = resolveMonsterTurn({
        addLog,
        battleLogText,
        finishMonsterTurn,
        isTurnResolved: () => turnResolved,
        language,
        localizedMonsterName,
        monsterMaxHp: activeMonster.maxHp,
        monsterStunned,
        nextIntent: nextIntentRef.current,
        playerShield: playerShieldRef.current,
        projectileCallback: projectileCallbackRef.current,
        scheduleTimeout: (callback, delay) => {
          timeoutIds.push(window.setTimeout(callback, delay));
        },
        setMonsterHp,
        setMonsterShield,
        setMonsterStunned,
        setPlayerHp,
        setPlayerShield,
        skipAnimation,
        trimIntentLabel,
      });
    };

    timeoutIds.push(
      window.setTimeout(() => executeMonsterAction(document.hidden), 720),
    );
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
    monsterStunned,
    addLog,
    battleLogText,
    language,
    localizedMonsterName,
    activeMonster.maxHp,
    rollNextIntent,
    trimIntentLabel,
  ]);

  useEffect(() => {
    if (phase !== "combat") {
      return;
    }
    if (monsterHp <= 0) {
      if (monsterTurnTimeoutRef.current) {
        window.clearTimeout(monsterTurnTimeoutRef.current);
        monsterTurnTimeoutRef.current = null;
      }
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

  useEffect(() => {
    if (phase !== "victory") {
      return;
    }
    const id = window.setTimeout(
      () =>
        onBattleEnd({
          won: true,
          defeatedMonsterName: activeMonster.name,
          experienceReward: activeMonster.experienceReward,
          remainingHp: playerHp,
          remainingMana: playerMana,
          remainingPotionCharges: potionCharges,
        }),
      3500,
    );
    return () => window.clearTimeout(id);
  }, [activeMonster.experienceReward, activeMonster.name, onBattleEnd, phase, playerHp, playerMana, potionCharges]);

  useEffect(() => {
    if (phase !== "combat") {
      return;
    }
    if (playerHp > 0) {
      return;
    }

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

  useEffect(() => {
    if (phase !== "defeat") {
      return;
    }
    const id = window.setTimeout(
      () => onBattleEnd({ won: false, remainingHp: 0, remainingMana: playerMana, remainingPotionCharges: potionCharges }),
      3500,
    );
    return () => window.clearTimeout(id);
  }, [onBattleEnd, phase, playerMana, potionCharges]);

  return {
    ambientText,
    battleLog,
    handleEncounterDone,
    handleIntroDone,
    handlePlayerAction,
    handlePotionUse,
    localizedMonsterName,
    monsterHp,
    monsterMaxHp: activeMonster.maxHp,
    monsterShield,
    nextIntent,
    nextIntentLabel,
    phase,
    playerHp,
    playerMaxHp,
    playerMana,
    playerMaxMana,
    playerShield,
    playerStats,
    potionAvailable: potionCharges > 0,
    potionCharges,
    projectileCallbackRef,
    sceneText,
    targetOptions,
    turn,
    victoryBannerText,
  };
}
