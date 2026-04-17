import type { EquippedItems } from "@/entities/equipment";
import { type Language } from "@/entities/locale";
import { useAsciiAsset } from "@/shared/lib/ascii";
import BattleStage, { useBattleFlow } from "@/widgets/battle-stage";
import { BattleEncounterSequence } from "@/widgets/encounter-scene";

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
 * 전투 장면에서 조우, 인트로, 전투, 승패 화면을 조합한다.
 */
export default function BattlePage({
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
    potionAvailable,
    projectileCallbackRef,
    sceneText,
    targetOptions,
    turn,
    victoryBannerText,
  } = useBattleFlow({
    language,
    onBattleEnd,
  });

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6">
      <div className="flex w-full flex-1 items-center justify-center">
        {(phase === "encounter" || phase === "intro") && (
          <BattleEncounterSequence
            language={language}
            phase={phase}
            onEncounterComplete={handleEncounterDone}
            onIntroComplete={handleIntroDone}
          />
        )}

        {phase === "combat" && !playerLoading && !monsterLoading && (
          <BattleStage
            monsterName={localizedMonsterName}
            monsterAscii={monsterAscii}
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
            targetOptions={targetOptions}
            onAction={handlePlayerAction}
            potionAvailable={potionAvailable}
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
              {victoryBannerText}
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
