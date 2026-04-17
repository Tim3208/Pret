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
import {
  type Language,
  getLocalizedMonsterIntentLabel,
  getLocalizedMonsterName,
  interpolateText,
} from "@/entities/locale";
import {
  HOLLOW_WRAITH,
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
import { resolveMonsterTurn } from "./resolveMonsterTurn";
import { resolvePlayerAction } from "./resolvePlayerAction";

type BattlePhase = "encounter" | "intro" | "combat" | "victory" | "defeat";

interface UseBattleFlowParams {
  language: Language;
  onBattleEnd: (result: { won: boolean }) => void;
}

/**
 * 전투 장면에서 사용하는 상태 전환, 턴 처리, 승패 판정을 한곳에서 관리한다.
 */
export function useBattleFlow({
  language,
  onBattleEnd,
}: UseBattleFlowParams) {
  const monster = HOLLOW_WRAITH;
  const battleLogText = BATTLE_LOG_TEXT[language];
  const sceneText = BATTLE_SCENE_TEXT[language];
  const localizedMonsterName = getLocalizedMonsterName(monster.name, language);
  const [playerStats] = useState<PlayerStats>(() => ({ ...DEFAULT_STATS }));

  const playerMaxHp = getMaxHp(playerStats);
  const playerMaxMana = getMaxMana(playerStats);

  const [phase, setPhase] = useState<BattlePhase>("encounter");
  const [playerHp, setPlayerHp] = useState(playerMaxHp);
  const [playerMana, setPlayerMana] = useState(playerMaxMana);
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
    if (phase !== "combat" || potionUsed || playerHp >= playerMaxHp) {
      return 0;
    }

    const healAmount = Math.min(
      playerMaxHp - playerHp,
      Math.max(8, getHealAmount(playerStats) + 3),
    );
    if (healAmount <= 0) {
      return 0;
    }

    setPotionUsed(true);
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
    playerHp,
    playerMaxHp,
    playerStats,
    potionUsed,
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
        battleLogText,
        currentMonsterShield: monsterShieldRef.current,
        language,
        localizedMonsterName,
        monsterElement: monster.element,
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
      });

      if (!shouldAdvanceTurn) {
        return;
      }

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
      playerStats,
      playerMaxHp,
      playerMana,
      monster,
      addLog,
      battleLogText,
      language,
      localizedMonsterName,
      sceneText,
    ],
  );

  const nextIntentRef = useRef(nextIntent);
  const playerShieldRef = useRef(playerShield);

  useEffect(() => {
    nextIntentRef.current = nextIntent;
    playerShieldRef.current = playerShield;
  }, [nextIntent, playerShield]);

  useEffect(() => {
    if (turn !== "monster") {
      return;
    }
    if (monsterHp <= 0) {
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
        monsterStunned,
        nextIntent: nextIntentRef.current,
        playerShield: playerShieldRef.current,
        projectileCallback: projectileCallbackRef.current,
        scheduleTimeout: (callback, delay) => {
          timeoutIds.push(window.setTimeout(callback, delay));
        },
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
    monsterHp,
    monsterStunned,
    addLog,
    battleLogText,
    language,
    localizedMonsterName,
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
    const id = window.setTimeout(() => onBattleEnd({ won: true }), 3500);
    return () => window.clearTimeout(id);
  }, [phase, onBattleEnd]);

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
    const id = window.setTimeout(() => onBattleEnd({ won: false }), 3500);
    return () => window.clearTimeout(id);
  }, [phase, onBattleEnd]);

  return {
    ambientText,
    battleLog,
    handleEncounterDone,
    handleIntroDone,
    handlePlayerAction,
    handlePotionUse,
    localizedMonsterName,
    monsterHp,
    monsterMaxHp: monster.maxHp,
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
    potionAvailable: !potionUsed,
    projectileCallbackRef,
    sceneText,
    targetOptions,
    turn,
    victoryBannerText,
  };
}
