import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BATTLE_COMBAT_TEXT } from "@/content/text/battle/ui";
import {
  type BattleTargetOption,
  type PlayerAction,
  type PlayerActionDraft,
  getActionCritChance,
  getActionHitChance,
  getActionTargeting,
  PLAYER_TARGET_ID,
} from "@/entities/combat";
import {
  type Language,
  getLocalizedSpellName,
  normalizeSpellQuery,
} from "@/entities/locale";
import type { PlayerStats } from "@/entities/player";
import { findSpell } from "@/entities/spell";

interface BattleCommandInputProps {
  language: Language;
  monsterName: string;
  playerMana: number;
  playerStats: PlayerStats;
  targetOptions: BattleTargetOption[];
  turn: "player" | "monster";
  onAction: (action: PlayerAction) => void;
}

/**
 * 전투 중 명령 선택, 타깃 지정, 자유 입력 주문 해석을 담당하는 입력 패널이다.
 */
export default function BattleCommandInput({
  language,
  monsterName,
  playerMana,
  playerStats,
  targetOptions,
  turn,
  onAction,
}: BattleCommandInputProps) {
  const combatText = BATTLE_COMBAT_TEXT[language];
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [pendingAction, setPendingAction] = useState<PlayerActionDraft | null>(null);

  const pendingTargeting = pendingAction ? getActionTargeting(pendingAction) : null;
  const availableTargets = useMemo(() => {
    if (!pendingAction) {
      return [];
    }
    if (pendingTargeting === "self") {
      return targetOptions.filter((target) => target.side === "player");
    }
    if (pendingTargeting === "all-enemies") {
      return targetOptions.filter((target) => target.side === "enemy");
    }
    return targetOptions;
  }, [pendingAction, pendingTargeting, targetOptions]);

  /**
   * 대상까지 확정된 행동을 상위 전투 위젯으로 전달하고 입력 상태를 초기화한다.
   */
  const submitResolvedAction = useCallback(
    (action: PlayerActionDraft, targetId: string) => {
      switch (action.type) {
        case "attack":
          onAction({ type: "attack", targetId });
          break;
        case "defend":
          onAction({ type: "defend", targetId });
          break;
        case "heal":
          onAction({ type: "heal", targetId });
          break;
        case "spell":
          onAction({ type: "spell", spell: action.spell, mode: action.mode, targetId });
          break;
      }

      setPendingAction(null);
      setSelectedTargetIndex(0);
      setShowPrompt(false);
      setPromptInput("");
    },
    [onAction],
  );

  /**
   * 행동 초안을 받아 즉시 확정 가능한 경우 제출하고, 아니면 타깃 선택 상태로 전환한다.
   */
  const stageAction = useCallback(
    (action: PlayerActionDraft) => {
      const targeting = getActionTargeting(action);
      if (targeting === "self") {
        submitResolvedAction(action, PLAYER_TARGET_ID);
        return;
      }

      setPendingAction(action);
      setSelectedTargetIndex(0);
      setShowPrompt(false);
      setPromptInput("");
    },
    [submitResolvedAction],
  );

  /**
   * 현재 선택된 타깃 인덱스를 실제 행동으로 확정한다.
   */
  const confirmTargetAtIndex = useCallback(
    (index: number) => {
      if (!pendingAction) {
        return;
      }
      const target = availableTargets[index];
      if (!target) {
        return;
      }
      setSelectedTargetIndex(index);
      submitResolvedAction(pendingAction, target.id);
    },
    [availableTargets, pendingAction, submitResolvedAction],
  );

  const executeChoice = useCallback(
    (index: number) => {
      if (index === 0) {
        stageAction({ type: "attack" });
      } else if (index === 1) {
        stageAction({ type: "defend" });
      } else {
        setPendingAction(null);
        setPromptInput("");
        setShowPrompt(true);
      }
    },
    [stageAction],
  );

  useEffect(() => {
    if (turn !== "player") {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (showPrompt) {
        if (event.key === "Escape") {
          event.preventDefault();
          setShowPrompt(false);
          setPromptInput("");
        }
        return;
      }

      if (pendingAction) {
        if (event.key === "Escape") {
          event.preventDefault();
          setPendingAction(null);
          setSelectedTargetIndex(0);
          return;
        }

        if (event.key === "ArrowUp" || event.key === "w") {
          event.preventDefault();
          setSelectedTargetIndex((value) =>
            value <= 0 ? Math.max(availableTargets.length - 1, 0) : value - 1,
          );
          return;
        }

        if (event.key === "ArrowDown" || event.key === "s") {
          event.preventDefault();
          setSelectedTargetIndex((value) =>
            value >= availableTargets.length - 1 ? 0 : value + 1,
          );
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          confirmTargetAtIndex(selectedTargetIndex);
          return;
        }

        if (/^[1-9]$/.test(event.key)) {
          const index = Number(event.key) - 1;
          if (index < availableTargets.length) {
            event.preventDefault();
            confirmTargetAtIndex(index);
          }
        }
        return;
      }

      if (event.key === "ArrowUp" || event.key === "w") {
        event.preventDefault();
        setSelectedIndex((value) => (value <= 0 ? 2 : value - 1));
      } else if (event.key === "ArrowDown" || event.key === "s") {
        event.preventDefault();
        setSelectedIndex((value) => (value >= 2 ? 0 : value + 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        executeChoice(selectedIndex);
      } else if (event.key === "1") {
        event.preventDefault();
        executeChoice(0);
      } else if (event.key === "2") {
        event.preventDefault();
        executeChoice(1);
      } else if (event.key === "3") {
        event.preventDefault();
        executeChoice(2);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    availableTargets.length,
    confirmTargetAtIndex,
    executeChoice,
    pendingAction,
    selectedIndex,
    selectedTargetIndex,
    showPrompt,
    turn,
  ]);

  /**
   * 자유 입력 문장을 주문, 회복, 일반 공격 중 하나로 해석해 전투 행동으로 변환한다.
   */
  const handlePromptSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (turn !== "player") {
        return;
      }

      const raw = promptInput.trim();
      if (!raw) {
        return;
      }

      const lower = raw.toLowerCase();
      const defendPrefix = ["defend:", "방어:"].find((prefix) => lower.startsWith(prefix));
      const isDefendMode = Boolean(defendPrefix);
      const spellQuery = defendPrefix ? raw.slice(defendPrefix.length).trim() : raw;

      const spell = findSpell(normalizeSpellQuery(spellQuery));
      if (spell) {
        const mode =
          isDefendMode && spell.modes.includes("defend")
            ? ("defend" as const)
            : ("attack" as const);
        stageAction({ type: "spell", spell, mode });
      } else if (
        lower.includes("heal") ||
        lower.includes("breath") ||
        lower.includes("rest") ||
        lower.includes("호흡") ||
        lower.includes("회복")
      ) {
        stageAction({ type: "heal" });
      } else {
        stageAction({ type: "attack" });
      }
    },
    [promptInput, stageAction, turn],
  );

  const choices = useMemo(
    () => [
      { key: "1", label: combatText.attackLabel, hint: combatText.attackHint },
      { key: "2", label: combatText.defendLabel, hint: combatText.defendHint },
      { key: "3", label: combatText.promptLabel, hint: combatText.promptHint },
    ],
    [combatText],
  );

  const pendingActionLabel = !pendingAction
    ? ""
    : pendingAction.type === "attack"
      ? combatText.attackLabel
      : pendingAction.type === "spell"
        ? getLocalizedSpellName(pendingAction.spell.name, language)
        : pendingAction.type === "heal"
          ? combatText.healLabel
          : combatText.defendLabel;

  const pendingActionHint = !pendingAction
    ? ""
    : pendingTargeting === "all-enemies"
      ? combatText.chooseEnemyHint
      : pendingTargeting === "single"
        ? combatText.chooseSingleHint
        : combatText.chooseSelfHint;

  if (turn === "monster") {
    return (
      <p
        className="m-0 animate-wait-blink text-center text-[0.9rem] uppercase tracking-[0.16em]"
        style={{ color: "rgba(255, 100, 80, 0.55)" }}
      >
        {combatText.monsterTurnMessageTemplate.replace("{monsterName}", monsterName)}
      </p>
    );
  }

  if (!showPrompt && !pendingAction) {
    return (
      <div className="w-full max-w-[560px] font-crt text-[0.92rem] sm:text-[0.96rem]">
        {choices.map((choice, index) => (
          <button
            key={choice.key}
            type="button"
            className={`block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left tracking-[0.06em] transition-colors duration-100 ${
              selectedIndex === index
                ? "text-ember [text-shadow:0_0_6px_rgba(255,170,0,0.4)]"
                : "text-ash/50 hover:text-ash/80"
            }`}
            onClick={() => executeChoice(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {selectedIndex === index ? "> " : "  "}[{choice.key}] {choice.label}
            <span className="ml-3 text-[0.72rem] text-white/28">{choice.hint}</span>
          </button>
        ))}
      </div>
    );
  }

  if (!showPrompt && pendingAction) {
    return (
      <div className="w-full max-w-[560px] font-crt text-[0.92rem] sm:text-[0.96rem]">
        <p className="px-3 pb-1 text-[0.7rem] uppercase tracking-[0.14em] text-white/38">
          {pendingActionLabel} {combatText.targetSuffix}
        </p>
        {availableTargets.map((target, index) => {
          const hitChance = Math.round(
            getActionHitChance(pendingAction, playerStats, target.side) * 100,
          );
          const critChance = Math.round(
            getActionCritChance(pendingAction, playerStats, target.side) * 100,
          );
          return (
            <button
              key={target.id}
              type="button"
              className={`block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left tracking-[0.06em] transition-colors duration-100 ${
                selectedTargetIndex === index
                  ? "text-ember [text-shadow:0_0_6px_rgba(255,170,0,0.4)]"
                  : "text-ash/50 hover:text-ash/80"
              }`}
              onClick={() => confirmTargetAtIndex(index)}
              onMouseEnter={() => setSelectedTargetIndex(index)}
            >
              {selectedTargetIndex === index ? "> " : "  "}[{index + 1}]{" "}
              <span
                className={
                  target.side === "enemy"
                    ? selectedTargetIndex === index
                      ? "text-[rgba(255,118,108,0.98)]"
                      : "text-[rgba(214,78,68,0.94)]"
                    : undefined
                }
              >
                {target.name}
              </span>
              <span className="ml-3 text-[0.72rem] text-white/28">
                {combatText.hitLabel} {hitChance}% | {combatText.critLabel} {critChance}%
              </span>
            </button>
          );
        })}
        <p className="px-3 pt-1 text-[0.68rem] text-white/30">
          {pendingActionHint} [ESC] {combatText.cancelLabel}.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[560px] font-crt">
      <form onSubmit={handlePromptSubmit} className="flex items-center gap-2">
        <span className="font-bold text-ember">{">"}</span>
        <input
          type="text"
          value={promptInput}
          onChange={(event) => setPromptInput(event.target.value)}
          placeholder={combatText.promptPlaceholder}
          autoFocus
          className="min-w-0 flex-1 border-0 border-b border-ember/30 bg-transparent text-[1rem] text-ember outline-none placeholder:text-white/25 focus:border-ember sm:text-[1.08rem]"
        />
        <button
          type="button"
          onClick={() => setShowPrompt(false)}
          className="cursor-pointer border-0 bg-transparent text-[0.8rem] text-white/40 hover:text-white/70"
        >
          [ESC]
        </button>
      </form>
      <p className="mt-1 text-[0.68rem] text-white/30">
        {combatText.promptHelp} {combatText.manaLabel}: {playerMana}
      </p>
    </div>
  );
}
