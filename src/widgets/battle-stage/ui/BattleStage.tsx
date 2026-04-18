import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { BATTLE_COMBAT_TEXT } from "@/content/text/battle/ui";
import {
  type BattleLogEntry,
  type BattleTargetOption,
  type CombatAnimationRequest,
  type PlayerAction,
} from "@/entities/combat";
import {
  type EquippedItems,
  getEquippedItems,
} from "@/entities/equipment";
import type { Language } from "@/entities/locale";
import type { MonsterIntent } from "@/entities/monster";
import type { PlayerStats } from "@/entities/player";
import BattleCommandInput from "@/features/battle-command-input";
import {
  PotionUseButton,
  usePotionUseInteraction,
} from "@/features/potion-use";
import CrtOverlay from "@/shared/ui/crt-overlay";
import BattleLogPanel from "@/widgets/battle-log";
import { ResourcePanel } from "@/widgets/resource-panel";
import BattleEquipmentOverlay from "./BattleEquipmentOverlay";
import BattleMonsterPanel from "./BattleMonsterPanel";
import {
  H,
  SCENE_H,
  SCENE_W,
  W,
  getProjectileSceneAnchors,
  getSceneAnchors,
} from "../lib/core";
import { spawnPotionShatterBurst } from "../lib/visuals";
import type {
  EffectParticle,
  Point,
} from "../model/battleStageScene.types";
import { useBattleStageCombatFeedback } from "../model/useBattleStageCombatFeedback";
import { useBattleStageEffects } from "../model/useBattleStageEffects";
import { useBattleStageCanvasLoop } from "../model/useBattleStageCanvasLoop";
import { useMonsterAsciiPresentation } from "../model/useMonsterAsciiPresentation";
import { usePlayerAsciiPresentation } from "../model/usePlayerAsciiPresentation";

interface BattleStageProps {
  monsterName: string;
  monsterAscii: string[];
  playerAscii: string[];
  equippedItems: EquippedItems;
  monsterHp: number;
  monsterMaxHp: number;
  monsterShield: number;
  language: Language;
  nextIntent: MonsterIntent;
  nextIntentLabel: string;
  battleLog: BattleLogEntry[];
  ambientText: string;
  turn: "player" | "monster";
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerShield: number;
  playerStats: PlayerStats;
  targetOptions: BattleTargetOption[];
  onAction: (action: PlayerAction) => void;
  potionAvailable: boolean;
  onPotionUse: () => number;
  projectileCallbackRef: MutableRefObject<((request: CombatAnimationRequest) => void) | null>;
}

/**
 * 전투 콘솔, ASCII 캐릭터, 투사체 연출을 함께 렌더링하는 메인 전투 UI다.
 */
export default function BattleStage({
  monsterName,
  monsterAscii,
  playerAscii,
  equippedItems,
  monsterHp,
  monsterMaxHp,
  monsterShield,
  language,
  nextIntent,
  nextIntentLabel,
  battleLog,
  ambientText,
  turn,
  playerHp,
  playerMaxHp,
  playerMana,
  playerMaxMana,
  playerShield,
  playerStats,
  targetOptions,
  onAction,
  potionAvailable,
  onPotionUse,
  projectileCallbackRef,
}: BattleStageProps) {
  const combatText = BATTLE_COMBAT_TEXT[language];
  const battleFrameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneFxCanvasRef = useRef<HTMLCanvasElement>(null);
  const playerAsciiPreRef = useRef<HTMLPreElement>(null);
  const playerOverlayRef = useRef<HTMLCanvasElement>(null);
  const monsterOverlayRef = useRef<HTMLCanvasElement>(null);
  const monsterIntentOverlayRef = useRef<HTMLCanvasElement>(null);
  const monsterImpactBandTriggerRef = useRef<
    ((impactPoint: Point, damage: number, critical: boolean) => void) | null
  >(null);
  const rafRef = useRef<number>(0);
  const sceneScatterRef = useRef<EffectParticle[]>([]);
  const intentSparksRef = useRef<EffectParticle[]>([]);
  const lastIntentSparkFrameRef = useRef(0);

  /* Keep text data in a ref so the RAF loop never needs to restart */
  const textRef = useRef({
    nextIntent,
    nextIntentLabel,
    monsterShield,
    ambientText,
    battleLog,
    monsterHp,
    turn,
    shieldLabel: combatText.shieldLabel,
  });
  const sceneAnchors = useMemo(() => getSceneAnchors(W, H), []);
  const projectileSceneAnchors = useMemo(() => getProjectileSceneAnchors(SCENE_W, SCENE_H), []);
  const handlePotionConsumeEffect = useCallback((framePoint: Point) => {
    const frameRect = battleFrameRef.current?.getBoundingClientRect();
    if (frameRect && frameRect.width > 0 && frameRect.height > 0) {
      spawnPotionShatterBurst(sceneScatterRef.current, {
        x: (framePoint.x / frameRect.width) * SCENE_W,
        y: (framePoint.y / frameRect.height) * SCENE_H,
      });
      return;
    }

    spawnPotionShatterBurst(sceneScatterRef.current, projectileSceneAnchors.playerCore);
  }, [projectileSceneAnchors.playerCore]);

  useEffect(() => {
    textRef.current = {
      nextIntent,
      nextIntentLabel,
      monsterShield,
      ambientText,
      battleLog,
      monsterHp,
      turn,
      shieldLabel: combatText.shieldLabel,
    };
  }, [ambientText, battleLog, combatText.shieldLabel, monsterHp, monsterShield, nextIntent, nextIntentLabel, turn]);

  const playerAsciiText = playerAscii.join("\n");
  const {
    effectsRef,
    forceFieldsRef,
    monsterDying,
    triggerEffect,
  } = useBattleStageEffects({
    monsterHp,
    monsterOverlayRef,
    monsterShield,
    playerHp,
    playerOverlayRef,
    playerShield,
    projectileSceneAnchors,
    sceneAnchors,
    sceneScatterRef,
  });
  const {
    consolePulsesRef,
    crtNoiseLevel,
    glitchActive,
    hitAbsorbMonster,
    hitAbsorbPlayer,
    lungePlayer,
    monsterHitWaveProgress,
    monsterHitWaveScale,
    playerHitWaveProgress,
    playerHitWaveScale,
    projectilesRef,
    shakeMonster,
    shakePlayer,
    slashesRef,
  } = useBattleStageCombatFeedback({
    monsterImpactBandTriggerRef,
    monsterMaxHp,
    playerMaxHp,
    projectileCallbackRef,
    projectileSceneAnchors,
    sceneAnchors,
    sceneScatterRef,
    triggerEffect,
  });
  const {
    activePotionPosition,
    handlePotionHoverEnd,
    handlePotionHoverStart,
    handlePotionPointerCancel,
    handlePotionPointerDown,
    handlePotionPointerMove,
    handlePotionPointerUp,
    potionDragging,
    potionHoverDisplacement,
    potionHovered,
    potionHoveringPlayer,
  } = usePotionUseInteraction({
    battleFrameRef,
    onConsumeSuccess: handlePotionConsumeEffect,
    onPotionUse,
    playerAsciiPreRef,
    playerAsciiText,
    playerHp,
    playerMaxHp,
    potionAvailable,
  });
  const equippedItemList = useMemo(() => getEquippedItems(equippedItems), [equippedItems]);
  const {
    playerAsciiCanvasActive,
    playerAsciiCanvasRef,
    playerAsciiClassName,
    playerAsciiMarkup,
    playerAsciiMetricsRef,
    playerAsciiRenderRef,
    playerAsciiStyle,
    playerPotionDisplacementRef,
  } = usePlayerAsciiPresentation({
    playerAscii,
    playerAsciiPreRef,
    playerAsciiText,
    equippedItems: equippedItemList,
    hitAbsorbPlayer,
    playerHitWaveProgress,
    playerHitWaveScale,
    potionHoverDisplacement,
    shakePlayer,
  });
  const {
    monsterAsciiCanvasActive: monsterImpactCanvasActive,
    monsterAsciiCanvasRef,
    monsterAsciiClassName,
    monsterAsciiMetricsRef,
    monsterAsciiPreRef,
    monsterAsciiRenderRef,
    monsterAsciiStyle,
    monsterAsciiText,
    monsterImpactRef,
    triggerMonsterImpactBand,
  } = useMonsterAsciiPresentation({
    monsterAscii,
    monsterMaxHp,
    monsterHp,
    hitAbsorbMonster,
    monsterHitWaveProgress,
    monsterHitWaveScale,
    projectileSceneAnchors,
    sceneFxCanvasRef,
    shakeMonster,
  });
  useLayoutEffect(() => {
    monsterImpactBandTriggerRef.current = triggerMonsterImpactBand;
  }, [triggerMonsterImpactBand]);

  useBattleStageCanvasLoop({
    canvasRef,
    consolePulsesRef,
    effectsRef,
    forceFieldsRef,
    intentSparksRef,
    lastIntentSparkFrameRef,
    monsterAsciiCanvasRef,
    monsterAsciiMetricsRef,
    monsterAsciiRenderRef,
    monsterImpactRef,
    monsterIntentOverlayRef,
    monsterOverlayRef,
    playerAsciiCanvasRef,
    playerAsciiMetricsRef,
    playerAsciiRenderRef,
    playerPotionDisplacementRef,
    playerOverlayRef,
    projectilesRef,
    rafRef,
    sceneFxCanvasRef,
    sceneScatterRef,
    slashesRef,
    textRef,
  });

  return (
    <div className="flex w-full flex-col items-center gap-4 px-3 pb-8 animate-fade-in-quick sm:px-4">
      <div
        ref={battleFrameRef}
        className="relative w-full max-w-[1140px] overflow-hidden rounded-[24px] border border-white/10 bg-[#060606] shadow-[inset_0_0_60px_rgba(0,0,0,0.62),0_0_42px_rgba(0,0,0,0.78)]"
        style={{
          aspectRatio: "16 / 10",
          boxShadow: "0 32px 90px rgba(0, 0, 0, 0.65), inset 0 0 120px rgba(0, 0, 0, 0.55)",
        }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[#050505]" />
          <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_28%,rgba(244,214,168,0.08)_0%,rgba(0,0,0,0)_34%),linear-gradient(180deg,rgba(255,255,255,0.015)_0%,rgba(0,0,0,0.14)_24%,rgba(0,0,0,0.36)_100%)]" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.012) 0%, rgba(0, 0, 0, 0.08) 28%, rgba(0, 0, 0, 0.28) 100%)",
            }}
          />
        </div>

        <canvas
          ref={sceneFxCanvasRef}
          width={SCENE_W}
          height={SCENE_H}
          className="pointer-events-none absolute inset-0 z-[34] h-full w-full mix-blend-screen opacity-95"
        />

        <div
          className={`absolute bottom-[-11%] left-[-4%] z-40 ${
            shakePlayer ? "animate-sprite-shake" : ""
          } ${lungePlayer ? "animate-player-lunge" : ""}`}
        >
          <div
            className={`relative origin-bottom-left animate-player-breathe ${
              potionHoveringPlayer ? "drop-shadow-[0_0_18px_rgba(255,112,112,0.18)]" : ""
            }`}
          >
            <pre
              ref={playerAsciiPreRef}
              className={playerAsciiClassName}
              style={{
                ...playerAsciiStyle,
                opacity: playerAsciiCanvasActive ? 0 : 1,
              }}
            >
              {playerAsciiMarkup}
            </pre>
            <canvas
              ref={playerAsciiCanvasRef}
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
              style={{ opacity: playerAsciiCanvasActive ? 1 : 0 }}
            />
            <canvas
              ref={playerOverlayRef}
              width={980}
              height={980}
              className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
            />
            <BattleEquipmentOverlay
              effectLabel={combatText.equipmentEffectLabel}
              inactiveLabel={combatText.equipmentInactiveLabel}
              items={equippedItemList}
              language={language}
            />
          </div>
        </div>

        {potionAvailable && activePotionPosition && (
          <PotionUseButton
            ariaLabel={combatText.potionAriaLabel}
            dragging={potionDragging}
            hovered={potionHovered}
            hoveringPlayer={potionHoveringPlayer}
            label={combatText.potionLabel}
            onHoverEnd={handlePotionHoverEnd}
            onHoverStart={handlePotionHoverStart}
            onPointerCancel={handlePotionPointerCancel}
            onPointerDown={handlePotionPointerDown}
            onPointerMove={handlePotionPointerMove}
            onPointerUp={handlePotionPointerUp}
            position={activePotionPosition}
            tooltip={combatText.potionTooltip}
          />
        )}

        <BattleMonsterPanel
          monsterAsciiCanvasRef={monsterAsciiCanvasRef}
          monsterAsciiClassName={monsterAsciiClassName}
          monsterAsciiPreRef={monsterAsciiPreRef}
          monsterAsciiStyle={monsterAsciiStyle}
          monsterAsciiText={monsterAsciiText}
          monsterDying={monsterDying}
          monsterHp={monsterHp}
          monsterImpactCanvasActive={monsterImpactCanvasActive}
          monsterIntentOverlayRef={monsterIntentOverlayRef}
          monsterMaxHp={monsterMaxHp}
          monsterOverlayRef={monsterOverlayRef}
          monsterShield={monsterShield}
          shakeMonster={shakeMonster}
        />

        <BattleLogPanel canvasRef={canvasRef} glitchActive={glitchActive} />

        <div className="absolute left-1/2 top-[71%] z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          <ResourcePanel
            hpCurrent={playerHp}
            hpMax={playerMaxHp}
            manaCurrent={playerMana}
            manaMax={playerMaxMana}
            shield={playerShield}
            hpLabel={combatText.hpLabel}
            manaLabel={combatText.manaLabel}
            shieldLabel={combatText.shieldLabel}
          />
        </div>

        <CrtOverlay glitchActive={glitchActive} noiseLevel={crtNoiseLevel} />
      </div>

      <BattleCommandInput
        language={language}
        monsterName={monsterName}
        playerMana={playerMana}
        playerStats={playerStats}
        targetOptions={targetOptions}
        turn={turn}
        onAction={onAction}
      />
    </div>
  );
}
