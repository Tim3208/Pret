import { useEffect, useState } from "react";
import { BATTLE_ENCOUNTER_TEXT } from "@/content/text/battle/scene";
import type { EquippedItems } from "@/entities/equipment";
import { type Language, pickText } from "@/entities/locale";
import { useAsciiAsset } from "@/shared/lib/ascii";
import BattleStage, { useBattleFlow } from "@/widgets/battle-stage";
import { SkullEncounter } from "@/widgets/encounter-scene";

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
        {phase === "encounter" && (
          <SkullEncounter onComplete={handleEncounterDone} />
        )}

        {phase === "intro" && (
          <div
            className="max-w-[500px] cursor-pointer px-6 py-8 animate-fade-in-quick"
            onClick={handleIntroDone}
          >
            <TypewriterText
              text={pickText(language, BATTLE_ENCOUNTER_TEXT)}
              speed={30}
            />
            <p className="mt-6 text-center text-[0.9rem] tracking-[0.15em] text-white/40 opacity-0 [animation:fade_1s_4s_forwards]">
              {sceneText.clickToFight}
            </p>
          </div>
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
