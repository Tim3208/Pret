import { useEffect, useMemo, useRef, useState } from "react";
import type { EquippedItems } from "@/entities/equipment";
import {
  getLocalizedMonsterEncounterText,
  type Language,
} from "@/entities/locale";
import { HOLLOW_WRAITH, type MonsterDef } from "@/entities/monster";
import type { BonfireMealEffect, JourneyNode } from "@/entities/run";
import {
  DEFAULT_STATS,
  grantPlayerExperience,
  type PlayerProgress,
  type PlayerStats,
} from "@/entities/player";
import { useAsciiAsset } from "@/shared/lib/ascii";
import BonfireTrailPanel from "@/shared/ui/bonfire-trail";
import type { BonfireTrailStep } from "@/shared/ui/bonfire-trail";
import { BattleLoadingPanel } from "@/widgets/battle-loading";
import { BattleOutcomePanel } from "@/widgets/battle-outcome";
import BattleStage, { useBattleFlow } from "@/widgets/battle-stage";
import { BattleEncounterSequence } from "@/widgets/encounter-scene";

export interface BattleResult {
  won: boolean;
  defeatedMonsterName?: string;
  experienceReward?: number;
  remainingHp?: number;
  remainingMana?: number;
  remainingPotionCharges?: number;
}

interface Props {
  baseStats?: PlayerStats;
  equippedItems: EquippedItems;
  hasPostBattleEvent: boolean;
  initialHp?: number;
  initialMana?: number;
  initialPotionCharges?: number;
  journeyHint?: string;
  journeyNodes?: JourneyNode[] | BonfireTrailStep[];
  journeyTitle?: string;
  language: Language;
  level?: number;
  mealEffect?: BonfireMealEffect | null;
  experience?: number;
  monster?: MonsterDef;
  nextLevelExperience?: number;
  onBattleEnd: (result: BattleResult) => void;
}

/**
 * 전투 장면에서 조우, 인트로, 전투, 승패 화면을 조합한다.
 */
export default function BattlePage({
  baseStats,
  equippedItems,
  hasPostBattleEvent,
  initialHp,
  initialMana,
  language,
  level = 1,
  mealEffect = null,
  experience = 0,
  monster,
  nextLevelExperience = 10,
  initialPotionCharges = 1,
  journeyHint,
  journeyNodes,
  journeyTitle,
  onBattleEnd,
}: Props) {
  const assetBase = import.meta.env.BASE_URL;
  const activeMonster = monster ?? HOLLOW_WRAITH;
  const encounterText = getLocalizedMonsterEncounterText(activeMonster.name, language);
  const baseProgress = useMemo<PlayerProgress>(
    () => ({
      level,
      experience,
      nextLevelExperience,
      unspentStatPoints: 0,
      baseStats: baseStats ?? DEFAULT_STATS,
    }),
    [baseStats, experience, level, nextLevelExperience],
  );
  const [displayedExperience, setDisplayedExperience] = useState(experience);
  const [displayedLevel, setDisplayedLevel] = useState(level);
  const [displayedNextLevelExperience, setDisplayedNextLevelExperience] = useState(nextLevelExperience);
  const [experienceAnimating, setExperienceAnimating] = useState(false);
  const [levelUpHighlight, setLevelUpHighlight] = useState(false);
  const ringTimeoutRef = useRef<number | null>(null);
  const { lines: playerAscii, loading: playerLoading } = useAsciiAsset(
    `${assetBase}assets/new_hero_ascii.md`,
  );
  const { lines: monsterAscii, loading: monsterLoading } = useAsciiAsset(
    `${assetBase}${activeMonster.asciiAssetPath}`,
  );
  const {
    ambientText,
    battleLog,
    handleEncounterDone,
    handleIntroDone,
    handlePlayerAction,
    handlePotionUse,
    localizedMonsterName,
    monsterHp,
    monsterMaxHp,
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
    potionCharges,
    potionAvailable,
    projectileCallbackRef,
    sceneText,
    targetOptions,
    turn,
    victoryBannerText,
  } = useBattleFlow({
    baseStats,
    equippedItems,
    initialHp,
    initialMana,
    initialPotionCharges,
    language,
    mealEffect,
    monster: activeMonster,
    onBattleEnd,
  });

  useEffect(() => {
    if (phase !== "victory") {
      if (ringTimeoutRef.current) {
        window.clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      return;
    }

    const animationDuration = 1800;
    const startedAt = performance.now();
    const reward = activeMonster.experienceReward;
    let rafId = 0;
    let ringTriggered = false;

    const startAnimation = () => {
      setExperienceAnimating(true);
      setDisplayedExperience(experience);
      setDisplayedLevel(level);
      setDisplayedNextLevelExperience(nextLevelExperience);
      tick();
    };

    const tick = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / animationDuration);
      const partialGain = Math.round(reward * progress);
      const preview = grantPlayerExperience(baseProgress, partialGain).progress;

      setDisplayedExperience(preview.experience);
      setDisplayedLevel(preview.level);
      setDisplayedNextLevelExperience(preview.nextLevelExperience);

      if (!ringTriggered && preview.level > level) {
        ringTriggered = true;
        setLevelUpHighlight(true);
        ringTimeoutRef.current = window.setTimeout(() => {
          setLevelUpHighlight(false);
          ringTimeoutRef.current = null;
        }, 1100);
      }

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      setExperienceAnimating(false);
    };

    rafId = window.requestAnimationFrame(startAnimation);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (ringTimeoutRef.current) {
        window.clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, [activeMonster.experienceReward, baseProgress, experience, level, nextLevelExperience, phase]);

  const victoryOverlay =
    phase === "victory" ? (
      <div className="absolute inset-0 flex items-start justify-center pt-[7.5%]">
        <BattleOutcomePanel
          variant="victory"
          title={victoryBannerText}
          subtitle={hasPostBattleEvent ? sceneText.victoryEvent : sceneText.victoryReturn}
        />
      </div>
    ) : null;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6">
      {journeyTitle && journeyHint && journeyNodes && (
        <BonfireTrailPanel
          hint={journeyHint}
          steps={journeyNodes.map((node) => ({
            id: node.id,
            label:
              "label" in node && typeof node.label === "string"
                ? node.label
                : node.id === "event"
                  ? "EVENT"
                  : node.id === "bonfire"
                    ? "BONFIRE"
                    : "BATTLE",
            state: node.state,
          }))}
          title={journeyTitle}
        />
      )}

      <div className="flex w-full flex-1 items-center justify-center">
        {(phase === "encounter" || phase === "intro") && (
          <BattleEncounterSequence
            encounterText={encounterText}
            language={language}
            phase={phase}
            onEncounterComplete={handleEncounterDone}
            onIntroComplete={handleIntroDone}
          />
        )}

        {(phase === "combat" || phase === "victory") && !playerLoading && !monsterLoading && (
          <BattleStage
            experience={phase === "victory" ? displayedExperience : experience}
            experienceAnimating={phase === "victory" && experienceAnimating}
            level={phase === "victory" ? displayedLevel : level}
            levelUpHighlight={phase === "victory" && levelUpHighlight}
            monsterName={localizedMonsterName}
            monsterAscii={monsterAscii}
            overlay={victoryOverlay}
            playerAscii={playerAscii}
            equippedItems={equippedItems}
            monsterHp={monsterHp}
            monsterMaxHp={monsterMaxHp}
            monsterShield={monsterShield}
            language={language}
            nextIntentLabel={nextIntentLabel}
            nextIntent={nextIntent}
            battleLog={battleLog}
            ambientText={ambientText}
            turn={turn}
            playerHp={playerHp}
            playerMaxHp={playerMaxHp}
            playerMana={playerMana}
            playerMaxMana={playerMaxMana}
            playerShield={playerShield}
            playerStats={playerStats}
            showCommandInput={phase === "combat"}
            targetOptions={targetOptions}
            nextLevelExperience={phase === "victory" ? displayedNextLevelExperience : nextLevelExperience}
            onAction={handlePlayerAction}
            potionCharges={potionCharges}
            potionAvailable={potionAvailable}
            onPotionUse={handlePotionUse}
            projectileCallbackRef={projectileCallbackRef}
          />
        )}

        {(phase === "combat" || phase === "victory") && (playerLoading || monsterLoading) && (
          <BattleLoadingPanel message={sceneText.loadingCombatants} />
        )}

        {phase === "defeat" && (
          <BattleOutcomePanel
            variant="defeat"
            title={sceneText.defeatTitle}
            subtitle={sceneText.defeatReturn}
          />
        )}
      </div>
    </div>
  );
}
