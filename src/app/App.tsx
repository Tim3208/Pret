import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  BONFIRE_ALLOCATE_KEYWORDS,
  BONFIRE_CONFIRM_KEYWORDS,
  BONFIRE_VENTURE_KEYWORDS,
  CAMPFIRE_STORY_TEXT,
  CAMPFIRE_UI_TEXT,
} from "@/content/text/app/campfire";
import { POST_BATTLE_EVENT_TEXT } from "@/content/text/event/postBattle";
import {
  type EquippedItems,
  applyEquipmentModifiers,
} from "@/entities/equipment";
import {
  getInitialLanguage,
  getLocalizedMonsterName,
  type Language,
  interpolateText,
  LOCALE_STORAGE_KEY,
  pickText,
} from "@/entities/locale";
import { pickMonsterForDepth } from "@/entities/monster";
import {
  BATTLES_PER_BONFIRE,
  getJourneyStatus,
  MAX_RUN_POTION_CHARGES,
  rollRunEvent,
  type RunEvent,
  type RunEventResolution,
} from "@/entities/run";
import {
  BONFIRE_HP_RECOVERY_RATIO,
  BONFIRE_MANA_RECOVERY_RATIO,
  LEVEL_UP_STAT_POINT_GAIN,
  clampPlayerResource,
  createInitialPlayerProgress,
  getMaxHp,
  getMaxMana,
  getPlayerBaseResources,
  grantPlayerExperience,
  recoverPlayerResourceAtBonfire,
  spendPlayerStatPoint,
  type PlayerProgress,
  type PlayerStatKey,
} from "@/entities/player";
import BattlePage from "@/pages/battle";
import PostBattleEvent from "@/pages/post-battle-event";
import BonfireTrailPanel, {
  type BonfireTrailStep,
} from "@/shared/ui/bonfire-trail";
import CrtOverlay from "@/shared/ui/crt-overlay";
import type { BattleResult } from "@/pages/battle";
import VocaLexicon from "@/widgets/voca-lexicon";
import { getDefaultUnlockedLexiconIds } from "@/content/glossary/voca/lexicon";

/**
 * 밝기에 따라 아스키 문자 밀도를 매핑할 때 사용하는 문자 램프다.
 */
const ASCII_RAMP = " .:-=+*#%@";

interface RunState {
  currentHp: number;
  currentMana: number;
  depth: number;
  maxHpPenalty: number;
  potionCharges: number;
  progress: PlayerProgress;
}

interface BonfireRecoveryResult {
  nextState: RunState;
  recoveredHp: number;
  recoveredMana: number;
  refilledPotions: number;
}

const PLAYER_STAT_ORDER: readonly PlayerStatKey[] = [
  "strength",
  "agility",
  "decipher",
  "combination",
  "stability",
];

/**
 * 키워드 입력이 특정 행동을 가리키는지 검사한다.
 *
 * @param input 플레이어 입력 문자열
 * @param keywords 허용할 키워드 목록
 * @returns 키워드 일치 여부
 */
function matchesKeyword(input: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => input === keyword || input.includes(keyword));
}

/**
 * 새 실행에서 사용할 초기 진행/자원 상태를 만든다.
 *
 * @returns 초기 플레이어 진행 정보와 시작 자원 상태
 */
function createInitialRunState(): RunState {
  const progress = createInitialPlayerProgress();
  const resources = getPlayerBaseResources(progress.baseStats);

  return {
    currentHp: resources.hp,
    currentMana: resources.mana,
    depth: 0,
    maxHpPenalty: 0,
    potionCharges: 1,
    progress,
  };
}

/**
 * 흉터 페널티까지 반영한 실제 현재 최대 체력을 계산한다.
 *
 * @param baseMaxHp 장비와 스탯이 반영된 기본 최대 체력
 * @param maxHpPenalty 이벤트로 누적된 최대 체력 감소량
 * @returns 실제 전투에서 적용할 최대 체력
 */
function getRunMaxHp(baseMaxHp: number, maxHpPenalty: number): number {
  return Math.max(1, baseMaxHp - Math.max(0, maxHpPenalty));
}

/**
 * ASCII 프레임에 맞게 문자열을 자르고 남는 칸을 공백으로 채운다.
 *
 * @param text 표시할 문자열
 * @param width 목표 폭
 * @returns 고정 폭 ASCII 문자열
 */
function fitAsciiPanelText(text: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (text.length <= width) {
    return text.padEnd(width, " ");
  }

  if (width <= 3) {
    return text.slice(0, width);
  }

  return `${text.slice(0, width - 3)}...`;
}

/**
 * 모닥불에 도착했을 때 현재 자원을 부분 회복한 새 실행 상태를 만든다.
 *
 * @param runState 현재 실행 상태
 * @param maxHp 현재 최대 체력
 * @param maxMana 현재 최대 마나
 * @returns 회복량과 함께 갱신된 실행 상태
 */
function recoverRunStateAtBonfire(
  runState: RunState,
  maxHp: number,
  maxMana: number,
): BonfireRecoveryResult {
  const nextPotionCharges = Math.max(1, Math.min(MAX_RUN_POTION_CHARGES, runState.potionCharges));
  const nextHp = recoverPlayerResourceAtBonfire(
    runState.currentHp,
    maxHp,
    BONFIRE_HP_RECOVERY_RATIO,
    4,
  );
  const nextMana = recoverPlayerResourceAtBonfire(
    runState.currentMana,
    maxMana,
    BONFIRE_MANA_RECOVERY_RATIO,
    3,
  );

  return {
    nextState: {
      ...runState,
      currentHp: nextHp,
      currentMana: nextMana,
      maxHpPenalty: 0,
      potionCharges: nextPotionCharges,
    },
    recoveredHp: Math.max(0, nextHp - runState.currentHp),
    recoveredMana: Math.max(0, nextMana - runState.currentMana),
    refilledPotions: Math.max(0, nextPotionCharges - runState.potionCharges),
  };
}

/**
 * 게임의 텍스트 장면, 전환 장면, 전투 장면을 관리하는 루트 컴포넌트다.
 */
export default function App() {
  /**
   * 현재 게임 진행 단계를 저장한다.
   */
  const [phase, setPhase] = useState<
    "text" | "transition" | "battle" | "post-battle-event"
  >("text");
  /**
   * 사용자 인터페이스의 현재 언어 모드다.
   */
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, language);
  }, [language]);
  /**
   * 플레이어가 입력창에 입력한 명령어를 저장한다.
   */
  const [input, setInput] = useState("");
  const [bonfireCommand, setBonfireCommand] = useState("");
  const [bonfireFeedback, setBonfireFeedback] = useState("");
  const [levelUpPopupOpen, setLevelUpPopupOpen] = useState(false);
  const [runState, setRunState] = useState<RunState>(() => createInitialRunState());
  /**
   * 현재 실행 동안 유지되는 장비 장착 상태다.
   */
  const [equippedItems, setEquippedItems] = useState<EquippedItems>({});
  /**
    * 첫 전투 뒤에 노출할 현재 이벤트 정의다.
   */
    const [activeRunEvent, setActiveRunEvent] = useState<RunEvent | null>(null);
  /**
   * 같은 장비가 연속 등장하는 빈도를 줄이기 위해 마지막 제시 장비 ID를 저장한다.
   */
  const [lastOfferedItemId, setLastOfferedItemId] = useState<string | null>(null);
  /**
   * 현재 실행 동안 해금된 사전 항목 목록이다.
   */
  const [learnedLexiconIds] = useState<string[]>(() => getDefaultUnlockedLexiconIds());

  const combatStats = applyEquipmentModifiers(runState.progress.baseStats, equippedItems);
  const currentMonster = pickMonsterForDepth(runState.depth, combatStats.stats);
  const currentBaseMaxHp = getMaxHp(combatStats.stats) + combatStats.maxHpBonus;
  const currentMaxHp = getRunMaxHp(currentBaseMaxHp, runState.maxHpPenalty);
  const currentMaxMana = getMaxMana(combatStats.stats) + combatStats.maxManaBonus;
  const statLabels: Record<PlayerStatKey, string> = {
    strength: pickText(language, CAMPFIRE_UI_TEXT.strengthLabel),
    agility: pickText(language, CAMPFIRE_UI_TEXT.agilityLabel),
    decipher: pickText(language, CAMPFIRE_UI_TEXT.decipherLabel),
    combination: pickText(language, CAMPFIRE_UI_TEXT.combinationLabel),
    stability: pickText(language, CAMPFIRE_UI_TEXT.stabilityLabel),
  };
  const journeyStatus = getJourneyStatus(
    runState.depth,
    phase === "battle"
      ? "battle"
      : phase === "post-battle-event"
        ? "event"
        : "bonfire",
  );
  const journeyTitle = pickText(language, CAMPFIRE_UI_TEXT.journeyTitle);
  const journeyHint = pickText(
    language,
    journeyStatus.currentScene === "battle-1"
      ? CAMPFIRE_UI_TEXT.journeyHintFirstBattle
      : journeyStatus.currentScene === "event"
        ? CAMPFIRE_UI_TEXT.journeyHintEvent
        : journeyStatus.currentScene === "battle-2"
          ? CAMPFIRE_UI_TEXT.journeyHintSecondBattle
          : CAMPFIRE_UI_TEXT.journeyHintBonfire,
  );
  const journeySteps: BonfireTrailStep[] = journeyStatus.nodes.map((node) => ({
    id: node.id,
    label:
      node.id === "event"
        ? pickText(language, CAMPFIRE_UI_TEXT.journeyEventLabel)
        : node.id === "bonfire"
          ? pickText(language, CAMPFIRE_UI_TEXT.journeyBonfireLabel)
          : pickText(language, CAMPFIRE_UI_TEXT.journeyBattleLabel),
    state: node.state,
  }));

  /**
   * 현재 실행을 초기 상태로 되돌린다.
   */
  const resetRun = useCallback(() => {
    const initialRunState = createInitialRunState();
    setRunState(initialRunState);
    setEquippedItems({});
    setActiveRunEvent(null);
    setLastOfferedItemId(null);
    setBonfireCommand("");
    setBonfireFeedback("");
    setLevelUpPopupOpen(false);
    setInput("");
    setPhase("text");
  }, []);

  /**
   * 모닥불 화면에 누적해서 보여 줄 피드백 줄을 덧붙인다.
   */
  const appendBonfireFeedback = useCallback((lines: string[]) => {
    if (lines.length === 0) {
      return;
    }

    setBonfireFeedback((current) => (current ? `${current}\n${lines.join("\n")}` : lines.join("\n")));
  }, []);

  /**
   * 전투 결과에 따라 다음 장면을 결정한다.
   *
   * @param result 전투 승패 정보
   */
  const handleBattleEnd = useCallback((result: BattleResult) => {
    if (!result.won) {
      resetRun();
      return;
    }

    const experienceGain = result.experienceReward ?? 0;
    const experienceResult = grantPlayerExperience(runState.progress, experienceGain);
    const nextRunState: RunState = {
      ...runState,
      currentHp: clampPlayerResource(result.remainingHp ?? runState.currentHp, currentMaxHp),
      currentMana: clampPlayerResource(result.remainingMana ?? runState.currentMana, currentMaxMana),
      depth: runState.depth + 1,
      potionCharges: Math.max(
        0,
        Math.min(MAX_RUN_POTION_CHARGES, result.remainingPotionCharges ?? runState.potionCharges),
      ),
      progress: experienceResult.progress,
    };
    const feedbackLines = [
      interpolateText(
        pickText(language, CAMPFIRE_UI_TEXT.victoryLine),
        {
          experience: experienceGain,
          monsterName: getLocalizedMonsterName(result.defeatedMonsterName ?? currentMonster.name, language),
        },
      ),
    ];

    if (experienceResult.leveledUp) {
      feedbackLines.push(
        interpolateText(
          pickText(language, CAMPFIRE_UI_TEXT.levelUpLine),
          {
            points: experienceResult.levelsGained * LEVEL_UP_STAT_POINT_GAIN,
          },
        ),
      );
    }

    if (nextRunState.depth % BATTLES_PER_BONFIRE === 1) {
      const rolledEvent = rollRunEvent({
        currentMaxHp,
        depth: nextRunState.depth,
        effectiveStats: combatStats.stats,
        equippedItems,
        previousOfferId: lastOfferedItemId,
      });

      setRunState(nextRunState);
      setBonfireFeedback(feedbackLines.join("\n"));
      setBonfireCommand("");
      setLevelUpPopupOpen(false);
      setActiveRunEvent(rolledEvent.event);
      setLastOfferedItemId(rolledEvent.offeredItemId);
      setPhase("post-battle-event");
      return;
    }

    const recovered = recoverRunStateAtBonfire(nextRunState, currentBaseMaxHp, currentMaxMana);
    if (recovered.recoveredHp > 0 || recovered.recoveredMana > 0) {
      feedbackLines.push(
        interpolateText(
          pickText(language, CAMPFIRE_UI_TEXT.recoveryLine),
          {
            hp: recovered.recoveredHp,
            mana: recovered.recoveredMana,
          },
        ),
      );
    }
    if (recovered.refilledPotions > 0) {
      feedbackLines.push(
        interpolateText(
          pickText(language, CAMPFIRE_UI_TEXT.potionRefillLine),
          { potions: recovered.nextState.potionCharges },
        ),
      );
    }

    setRunState(recovered.nextState);
    setBonfireFeedback(feedbackLines.join("\n"));
    setBonfireCommand("");
    setLevelUpPopupOpen(false);
    setActiveRunEvent(null);
    setPhase("transition");
  }, [combatStats.stats, currentBaseMaxHp, currentMaxHp, currentMaxMana, currentMonster.name, equippedItems, language, lastOfferedItemId, resetRun, runState]);

  /**
   * 첫 전투 뒤 이벤트 선택 결과를 실행 상태에 반영하고 두 번째 전투로 넘어간다.
   */
  const handleResolveRunEvent = useCallback((resolution: RunEventResolution) => {
    let nextRunState = runState;
    let nextEquippedItems = equippedItems;
    const feedbackLines: string[] = [];

    if (resolution.kind === "decline") {
      feedbackLines.push(pickText(language, POST_BATTLE_EVENT_TEXT.leaveLine));
    }

    if (resolution.kind === "equipment") {
      nextEquippedItems = {
        ...equippedItems,
        [resolution.item.slot]: resolution.item,
      };
      const nextCombatStats = applyEquipmentModifiers(runState.progress.baseStats, nextEquippedItems);
      const nextMaxHp = getRunMaxHp(
        getMaxHp(nextCombatStats.stats) + nextCombatStats.maxHpBonus,
        runState.maxHpPenalty,
      );
      const nextMaxMana = getMaxMana(nextCombatStats.stats) + nextCombatStats.maxManaBonus;
      nextRunState = {
        ...runState,
        currentHp: clampPlayerResource(runState.currentHp, nextMaxHp),
        currentMana: clampPlayerResource(runState.currentMana, nextMaxMana),
      };
      feedbackLines.push(
        interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.equipLine),
          { itemName: resolution.item.name[language] },
        ),
      );
    }

    if (resolution.kind === "experience" || resolution.kind === "choice-experience" || resolution.kind === "scar") {
      const gainedExperience = resolution.experience;
      const experienceResult = grantPlayerExperience(nextRunState.progress, gainedExperience);
      nextRunState = {
        ...nextRunState,
        progress: experienceResult.progress,
      };

      if (resolution.kind === "experience") {
        feedbackLines.push(
          interpolateText(
            pickText(language, POST_BATTLE_EVENT_TEXT.experienceGainLine),
            { experience: gainedExperience },
          ),
        );
      }

      if (resolution.kind === "choice-experience") {
        feedbackLines.push(
          interpolateText(
            pickText(language, POST_BATTLE_EVENT_TEXT.choiceExperienceGainLine),
            { experience: gainedExperience },
          ),
        );
      }

      if (resolution.kind === "scar") {
        const nextPenalty = Math.min(
          Math.max(0, currentBaseMaxHp - 1),
          nextRunState.maxHpPenalty + resolution.maxHpPenalty,
        );
        nextRunState = {
          ...nextRunState,
          currentHp: clampPlayerResource(
            nextRunState.currentHp,
            getRunMaxHp(currentBaseMaxHp, nextPenalty),
          ),
          maxHpPenalty: nextPenalty,
        };
        feedbackLines.push(
          interpolateText(
            pickText(language, POST_BATTLE_EVENT_TEXT.scarGainLine),
            { experience: gainedExperience, maxHpPenalty: resolution.maxHpPenalty },
          ),
        );
      }

      if (experienceResult.leveledUp) {
        feedbackLines.push(
          interpolateText(
            pickText(language, CAMPFIRE_UI_TEXT.levelUpLine),
            { points: experienceResult.levelsGained * LEVEL_UP_STAT_POINT_GAIN },
          ),
        );
      }
    }

    if (resolution.kind === "potion" || resolution.kind === "choice-potion" || resolution.kind === "ambush") {
      const gainedCharges = Math.max(
        0,
        Math.min(
          MAX_RUN_POTION_CHARGES,
          nextRunState.potionCharges + resolution.potionCharges,
        ) - nextRunState.potionCharges,
      );
      nextRunState = {
        ...nextRunState,
        potionCharges: nextRunState.potionCharges + gainedCharges,
      };

      if (resolution.kind === "potion") {
        feedbackLines.push(
          interpolateText(
            pickText(language, POST_BATTLE_EVENT_TEXT.potionGainLine),
            { potions: gainedCharges },
          ),
        );
      }

      if (resolution.kind === "choice-potion") {
        feedbackLines.push(
          interpolateText(
            pickText(language, POST_BATTLE_EVENT_TEXT.choicePotionGainLine),
            { potions: gainedCharges },
          ),
        );
      }

      if (resolution.kind === "ambush") {
        nextRunState = {
          ...nextRunState,
          currentHp: Math.max(1, nextRunState.currentHp - resolution.damage),
        };
        feedbackLines.push(
          interpolateText(
            pickText(language, POST_BATTLE_EVENT_TEXT.ambushGainLine),
            { damage: resolution.damage, potions: gainedCharges },
          ),
        );
      }
    }

    if (nextEquippedItems !== equippedItems) {
      setEquippedItems(nextEquippedItems);
    }
    setRunState(nextRunState);
    appendBonfireFeedback(feedbackLines);
    setActiveRunEvent(null);
    setBonfireCommand("");
    setPhase("battle");
  }, [appendBonfireFeedback, currentBaseMaxHp, equippedItems, language, runState]);

  const lexiconDecipher = combatStats.stats.decipher;

  /**
   * 모닥불 애니메이션 프레임을 취소하기 위해 최근 requestAnimationFrame ID를 보관한다.
   */
  const requestRef = useRef<number | null>(null);
  /**
   * 모닥불 ASCII 결과를 렌더링할 캔버스 요소를 참조한다.
   */
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (phase !== "transition") return;

    /**
     * 실제 사용자에게 보여 줄 ASCII 출력 캔버스다.
     */
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    /**
     * 화면용 캔버스 렌더링 컨텍스트다.
     */
    const displayContext = displayCanvas.getContext("2d");
    if (!displayContext) return;

    /**
     * 불꽃 시뮬레이션을 먼저 계산할 오프스크린 캔버스다.
     */
    const simCanvas = document.createElement("canvas");
    /**
     * 오프스크린 시뮬레이션에 그리기 위한 컨텍스트다.
     */
    const simContext = simCanvas.getContext("2d");
    if (!simContext) return;

    /**
     * 시뮬레이션용 가로 셀 수다.
     */
    const columns = 80;
    /**
     * 시뮬레이션용 세로 셀 수다.
     */
    const rows = 40;
    simCanvas.width = columns;
    simCanvas.height = rows;

    /**
     * ASCII 한 글자의 가로 픽셀 폭이다.
     */
    const charWidth = 10;
    /**
     * ASCII 한 글자의 세로 픽셀 높이다.
     */
    const charHeight = 14;
    displayCanvas.width = columns * charWidth;
    displayCanvas.height = rows * charHeight;

    /**
     * 애니메이션 시간축으로 사용하는 누적 프레임 값이다.
     */
    let time = 0;
    /**
     * 마우스의 현재 그리드 X 좌표다.
     */
    let mouseGridX = -1000;
    /**
     * 마우스의 현재 그리드 Y 좌표다.
     */
    let mouseGridY = -1000;

    /**
     * 마우스 위치를 ASCII 그리드 좌표로 변환해 저장한다.
     *
     * @param event 브라우저 마우스 이동 이벤트
     */
    const handleMouseMove = (event: MouseEvent) => {
      /**
       * 캔버스의 실제 화면 좌표 영역이다.
       */
      const rect = displayCanvas.getBoundingClientRect();
      /**
       * 마우스가 캔버스의 가로 영역 안에 있는지 여부다.
       */
      const withinX = event.clientX >= rect.left && event.clientX <= rect.right;
      /**
       * 마우스가 캔버스의 세로 영역 안에 있는지 여부다.
       */
      const withinY = event.clientY >= rect.top && event.clientY <= rect.bottom;

      if (withinX && withinY) {
        mouseGridX = ((event.clientX - rect.left) / rect.width) * columns;
        mouseGridY = ((event.clientY - rect.top) / rect.height) * rows;
        return;
      }

      mouseGridX = -1000;
      mouseGridY = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove);

    /**
     * 마우스 주변에서 효과를 줄 외곽 반경이다.
     */
    const outerRadius = 8;
    /**
     * 마우스 바로 근처에서 강한 소거 효과를 줄 내부 반경이다.
     */
    const innerRadius = 4;
    /**
     * 불티 파티클들의 현재 상태 목록이다.
     */
    const sparks: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
    }[] = [];

    /**
     * 모닥불 애니메이션 목표 FPS다.
     */
    const fps = 12;
    /**
     * 한 프레임이 유지되어야 하는 시간이다.
     */
    const frameDuration = 1000 / fps;
    /**
     * 직전에 실제 렌더링이 수행된 시각이다.
     */
    let lastFrameTime = 0;

    /**
     * 모닥불 시뮬레이션을 갱신하고 ASCII 캔버스에 출력한다.
     *
     * @param now 현재 requestAnimationFrame 타임스탬프
     */
    const animate = (now: number) => {
      if (now - lastFrameTime < frameDuration) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      lastFrameTime = now;
      time += 1;

      simContext.fillStyle = "rgb(255, 255, 255)";
      simContext.fillRect(0, 0, columns, rows);

      /**
       * 모닥불 중심의 X 좌표다.
       */
      const centerX = columns / 2;
      /**
       * 모닥불 바닥 기준 Y 좌표다.
       */
      const centerY = rows - 6;
      /**
       * 바람에 따라 불꽃이 좌우로 흔들리는 양이다.
       */
      const windSway = Math.sin(time * 0.07) * 2 + Math.sin(time * 0.13);

      simContext.fillStyle = "rgb(100, 180, 0)";

      simContext.save();
      simContext.translate(centerX, centerY + 2);
      simContext.rotate(-0.35);
      simContext.beginPath();
      simContext.ellipse(0, 0, 3, 16, 0, 0, Math.PI * 2);
      simContext.fill();
      simContext.restore();

      simContext.save();
      simContext.translate(centerX, centerY + 2);
      simContext.rotate(0.35);
      simContext.beginPath();
      simContext.ellipse(0, 0, 3, 16, 0, 0, Math.PI * 2);
      simContext.fill();
      simContext.restore();

      simContext.save();
      simContext.translate(centerX, centerY + 4);
      simContext.rotate(-0.25);
      simContext.beginPath();
      simContext.ellipse(0, 0, 2.5, 14, 0, 0, Math.PI * 2);
      simContext.fill();
      simContext.restore();

      simContext.save();
      simContext.translate(centerX, centerY + 4);
      simContext.rotate(0.25);
      simContext.beginPath();
      simContext.ellipse(0, 0, 2.5, 14, 0, 0, Math.PI * 2);
      simContext.fill();
      simContext.restore();

      /**
       * 숯불이 맥동하는 정도다.
       */
      const emberPulse =
        0.5 + 0.5 * Math.sin(time * 0.08 + 1.3) * Math.sin(time * 0.13);
      /**
       * 숯의 현재 밝기 값이다.
       */
      const emberBrightness = Math.floor(100 + emberPulse * 100);
      simContext.fillStyle = `rgb(120, ${emberBrightness}, 0)`;
      simContext.beginPath();
      simContext.ellipse(
        centerX + windSway * 0.3,
        centerY - 1,
        10,
        4,
        0,
        0,
        Math.PI * 2,
      );
      simContext.fill();

      for (let index = 0; index < 3; index += 1) {
        const emberX = centerX + Math.sin(index * 2.1 + time * 0.05) * 7;
        const emberT = 0.5 + 0.5 * Math.sin(time * 0.1 + index * 1.7);

        simContext.fillStyle = `rgb(120, ${Math.floor(80 + emberT * 150)}, 0)`;
        simContext.beginPath();
        simContext.arc(
          emberX,
          centerY + 0.5 + index * 0.3,
          2.5,
          0,
          Math.PI * 2,
        );
        simContext.fill();
      }

      /**
       * 전체 불꽃이 들숨과 날숨처럼 부풀었다 줄어드는 리듬값이다.
       */
      const breathe = Math.sin(time * 0.12) * 1.5 + Math.sin(time * 0.19);

      simContext.fillStyle = "rgb(80, 200, 0)";
      for (let index = 0; index < 4; index += 1) {
        const offset = index * 1.5;
        const sway = Math.sin(time * 0.08 + offset) * 4 + windSway;
        const flameHeight = 8 + breathe + Math.sin(time * 0.14 + offset) * 2;
        const flameWidth = 7 - (index % 2);

        simContext.beginPath();
        simContext.ellipse(
          centerX + Math.sin(offset) * 5 + sway,
          centerY - 3 - flameHeight / 2,
          flameWidth,
          flameHeight,
          0,
          0,
          Math.PI * 2,
        );
        simContext.fill();
      }

      simContext.fillStyle = "rgb(40, 160, 0)";
      for (let index = 0; index < 3; index += 1) {
        const offset = index * 2 + 0.5;
        const sway = Math.sin(time * 0.1 + offset) * 3 + windSway * 0.7;
        const flameHeight =
          6 + breathe * 0.7 + Math.sin(time * 0.16 + offset) * 1.5;

        simContext.beginPath();
        simContext.ellipse(
          centerX + Math.sin(offset) * 3 + sway,
          centerY - 3 - flameHeight / 2,
          5 - (index % 2) * 0.5,
          flameHeight,
          0,
          0,
          Math.PI * 2,
        );
        simContext.fill();
      }

      simContext.fillStyle = "rgb(0, 80, 0)";
      {
        const sway = Math.sin(time * 0.12) * 1.5 + windSway * 0.4;
        const flameHeight = 4 + breathe * 0.3 + Math.sin(time * 0.2);
        simContext.beginPath();
        simContext.ellipse(
          centerX + sway,
          centerY - 3 - flameHeight / 2,
          3.5,
          flameHeight,
          0,
          0,
          Math.PI * 2,
        );
        simContext.fill();
      }

      if (time % 4 === 0 && sparks.length < 15) {
        sparks.push({
          x: centerX + (Math.random() - 0.5) * 12 + windSway,
          y: centerY - 6 - Math.random() * 4,
          vx: (Math.random() - 0.5) * 0.8 + windSway * 0.1,
          vy: -(0.3 + Math.random() * 0.5),
          life: 0,
          maxLife: 20 + Math.random() * 30,
        });
      }

      for (let index = sparks.length - 1; index >= 0; index -= 1) {
        const spark = sparks[index];
        spark.x += spark.vx + Math.sin(time * 0.15 + index) * 0.2;
        spark.y += spark.vy;
        spark.life += 1;

        if (spark.life > spark.maxLife || spark.y < 0) {
          sparks.splice(index, 1);
          continue;
        }

        const fade = 1 - spark.life / spark.maxLife;
        const sparkRed = Math.floor(40 + fade * 40);

        simContext.fillStyle = `rgb(${sparkRed}, ${Math.floor(fade * 200)}, 0)`;
        simContext.beginPath();
        simContext.arc(spark.x, spark.y, 0.8 + fade * 0.5, 0, Math.PI * 2);
        simContext.fill();
      }

      /**
       * 시뮬레이션 결과를 픽셀 데이터로 읽어온 값이다.
       */
      const imageData = simContext.getImageData(0, 0, columns, rows);
      /**
       * 픽셀 RGBA 버퍼다.
       */
      const data = imageData.data;

      displayContext.fillStyle = "#0d0d0d";
      displayContext.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
      displayContext.textBaseline = "top";

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const offset = (y * columns + x) * 4;
          /**
           * 현재 셀의 R 채널 값으로 영역 타입을 판별한다.
           */
          const red = data[offset];
          /**
           * 현재 셀의 G 채널 값으로 밝기 보정을 계산한다.
           */
          const green = data[offset + 1];

          let type = "space";
          let zone = 0;

          if (red <= 10) {
            type = "fire";
            zone = 0;
          } else if (red <= 50) {
            type = "fire";
            zone = 1;
          } else if (red <= 90) {
            type = "fire";
            zone = 2;
          } else if (red <= 105) {
            type = "wood";
            zone = 3;
          } else if (red <= 130) {
            type = "ember";
            zone = 4;
          }

          const dx = x - mouseGridX;
          const dy = (y - mouseGridY) * 1.8;
          /**
           * 마우스와 현재 문자 셀 사이의 거리다.
           */
          const distance = Math.sqrt(dx * dx + dy * dy);

          let opacity = 1;
          let weight = 900;

          if (distance < innerRadius && type !== "space") {
            const innerT = distance / innerRadius;
            opacity = 0.05 + innerT * 0.35;
            weight = 100;
          } else if (distance < outerRadius && type !== "space") {
            const edgeT = Math.max(
              0,
              Math.min(
                1,
                (distance - innerRadius) / (outerRadius - innerRadius),
              ),
            );

            weight = Math.round(100 + edgeT * 800);
            weight = Math.round(weight / 100) * 100;
            weight = Math.max(100, Math.min(900, weight));
          }

          if (type === "space") continue;

          /**
           * G 채널을 기준으로 계산한 정규화 밝기 값이다.
           */
          const brightness = 1 - Math.min(green, 255) / 255;
          let rampIndex: number;

          if (type === "fire") {
            const zoneBase = zone === 0 ? 0.9 : zone === 1 ? 0.7 : 0.5;
            rampIndex = Math.floor(
              (zoneBase + brightness * 0.1) * (ASCII_RAMP.length - 1),
            );
          } else if (type === "ember") {
            rampIndex = Math.floor(
              (brightness * 0.4 + 0.4) * (ASCII_RAMP.length - 1),
            );
          } else {
            rampIndex = Math.floor(0.55 * (ASCII_RAMP.length - 1));
          }

          /**
           * 현재 셀에 출력할 ASCII 문자다.
           */
          const character =
            ASCII_RAMP[Math.max(1, Math.min(rampIndex, ASCII_RAMP.length - 1))];
          const fontWeight = weight >= 700 ? "bold" : "normal";
          const fontSize = weight >= 500 ? 13 : weight >= 300 ? 11 : 10;

          displayContext.font = `${fontWeight} ${fontSize}px monospace`;

          let color: string;
          if (zone === 0) {
            color = `rgba(255, 255, 200, ${opacity})`;
          } else if (zone === 1) {
            color = `rgba(255, 160, 30, ${opacity})`;
          } else if (zone === 2) {
            color = `rgba(220, 50, 20, ${opacity})`;
          } else if (zone === 4) {
            const emberT = Math.min(green / 255, 1);
            color = `rgba(${Math.floor(180 + emberT * 75)}, ${Math.floor(
              40 + emberT * 50,
            )}, 10, ${opacity})`;
          } else {
            color = `rgba(90, 55, 25, ${opacity})`;
          }

          displayContext.fillStyle = color;
          displayContext.fillText(character, x * charWidth, y * charHeight);

          if (type === "fire" && opacity > 0.4) {
            const glowAlpha = opacity * (zone === 0 ? 0.4 : 0.2);
            displayContext.fillStyle =
              zone === 0
                ? `rgba(255, 240, 150, ${glowAlpha})`
                : `rgba(255, 80, 10, ${glowAlpha})`;
            displayContext.fillText(
              character,
              x * charWidth + 0.5,
              y * charHeight + 0.5,
            );
          }
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [phase]);

  /**
   * 플레이어 입력값을 해석해 불을 피울지 판정한다.
   *
   * @param event 폼 제출 이벤트
   */
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const answer = input.trim().toLowerCase();

    if (BONFIRE_CONFIRM_KEYWORDS.some((keyword) => answer === keyword || answer.includes(keyword))) {
      setInput("");
      setBonfireCommand("");
      setBonfireFeedback("");
      setLevelUpPopupOpen(false);
      setPhase("transition");
    }
  };

  const handleBonfireActionSubmit = (event: FormEvent) => {
    event.preventDefault();
    const answer = bonfireCommand.trim().toLowerCase();

    if (!answer) {
      return;
    }

    if (matchesKeyword(answer, BONFIRE_VENTURE_KEYWORDS)) {
      setBonfireCommand("");
      setBonfireFeedback("");
      setLevelUpPopupOpen(false);
      setPhase("battle");
      return;
    }

    if (matchesKeyword(answer, BONFIRE_ALLOCATE_KEYWORDS)) {
      if (runState.progress.unspentStatPoints <= 0) {
        setBonfireFeedback(pickText(language, CAMPFIRE_UI_TEXT.noStatPoints));
      } else {
        setLevelUpPopupOpen(true);
      }
      setBonfireCommand("");
      return;
    }

    setBonfireFeedback(pickText(language, CAMPFIRE_UI_TEXT.invalidCommand));
  };

  const handleSpendStatPoint = useCallback((statKey: PlayerStatKey) => {
    setRunState((current) => ({
      ...current,
      currentHp: clampPlayerResource(
        current.currentHp,
        getMaxHp(applyEquipmentModifiers(spendPlayerStatPoint(current.progress, statKey).baseStats, equippedItems).stats)
          + applyEquipmentModifiers(spendPlayerStatPoint(current.progress, statKey).baseStats, equippedItems).maxHpBonus,
      ),
      currentMana: clampPlayerResource(
        current.currentMana,
        getMaxMana(applyEquipmentModifiers(spendPlayerStatPoint(current.progress, statKey).baseStats, equippedItems).stats)
          + applyEquipmentModifiers(spendPlayerStatPoint(current.progress, statKey).baseStats, equippedItems).maxManaBonus,
      ),
      progress: spendPlayerStatPoint(current.progress, statKey),
    }));
  }, [equippedItems]);

  const bonfireStatusLine = interpolateText(
    pickText(language, CAMPFIRE_UI_TEXT.statusLine),
    {
      hp: runState.currentHp,
      level: runState.progress.level,
      mana: runState.currentMana,
      maxHp: currentMaxHp,
      maxMana: currentMaxMana,
      potions: runState.potionCharges,
      points: runState.progress.unspentStatPoints,
    },
  );
  const bonfireProgressLine = interpolateText(
    pickText(language, CAMPFIRE_UI_TEXT.progressLine),
    {
      depth: runState.depth,
      experience: runState.progress.experience,
      nextExperience: runState.progress.nextLevelExperience,
    },
  );
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-void px-4 py-8 sm:px-8">
      <div className="absolute right-4 top-4 z-[80] flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-2 py-1 font-crt text-[0.68rem] tracking-[0.12em] text-white/70 backdrop-blur-sm">
        <span className="px-1">{pickText(language, CAMPFIRE_UI_TEXT.languageLabel)}</span>
        <button
          type="button"
          className={`cursor-pointer rounded-full border px-2 py-1 transition-colors ${
            language === "en"
              ? "border-ember/60 bg-ember/15 text-ember"
              : "border-white/12 bg-transparent text-white/50 hover:text-white/80"
          }`}
          onClick={() => setLanguage("en")}
        >
          {pickText(language, CAMPFIRE_UI_TEXT.languageEnglish)}
        </button>
        <button
          type="button"
          className={`cursor-pointer rounded-full border px-2 py-1 transition-colors ${
            language === "ko"
              ? "border-ember/60 bg-ember/15 text-ember"
              : "border-white/12 bg-transparent text-white/50 hover:text-white/80"
          }`}
          onClick={() => setLanguage("ko")}
        >
          {pickText(language, CAMPFIRE_UI_TEXT.languageKorean)}
        </button>
      </div>

      <svg className="absolute h-0 w-0">
        <filter id="noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      {phase !== "battle" ? (
        <div className="relative w-full max-w-[min(92vw,920px)] overflow-hidden rounded-[18px] px-4 py-8 shadow-[inset_0_0_60px_rgba(0,0,0,0.6),0_0_40px_rgba(0,0,0,0.8)] sm:px-8">
          {phase === "text" && (
            <div className="relative z-0 max-w-[600px] text-[1.05rem] leading-[1.8] sm:text-[1.2rem] [text-shadow:0_0_5px_rgba(255,255,255,0.2)]">
              {pickText(language, CAMPFIRE_STORY_TEXT).split("\n").map((line, index) => (
                <p key={index}>{line}</p>
              ))}
              <form
                onSubmit={handleSubmit}
                className="mt-4 flex items-center gap-2"
              >
                <span className="font-bold text-ember">{">"}</span>
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={pickText(language, CAMPFIRE_UI_TEXT.inputPlaceholder)}
                  autoFocus
                  className="w-[200px] border-0 border-b border-white/30 bg-transparent text-[1.05rem] text-ember outline-none placeholder:text-white/35 focus:border-ember sm:text-[1.2rem]"
                />
              </form>
            </div>
          )}

          {phase === "transition" && (
            <div className="relative z-0 flex w-full flex-col items-center gap-6">
              <BonfireTrailPanel
                hint={journeyHint}
                steps={journeySteps}
                title={journeyTitle}
              />

              <div className="relative z-0 flex flex-col items-center">
              <canvas
                ref={displayCanvasRef}
                className="h-auto w-full max-w-[800px] cursor-crosshair [image-rendering:pixelated] animate-fade-in-text"
              />
              <p
                className="mt-12 text-center text-[1.05rem] opacity-0 sm:text-[1.2rem] [animation:fade_3s_forwards] [animation-delay:2s] bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse 280px 100px at center -20px, #bfbfbf 0%, rgba(191, 191, 191, 0.8) 30%, rgba(191, 191, 191, 0.39) 55%, rgba(191, 191, 191, 0.23) 80%, rgba(191, 191, 191, 0.13) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {pickText(language, CAMPFIRE_UI_TEXT.bonfireLine)}
              </p>
              <div className="mt-8 w-full max-w-[680px] rounded-[18px] border border-white/10 bg-black/32 px-5 py-4 font-crt opacity-0 backdrop-blur-sm [animation:fade_1s_3s_forwards]">
                <p className="text-[0.82rem] tracking-[0.18em] text-white/42">
                  {pickText(language, CAMPFIRE_UI_TEXT.commandTitle)}
                </p>
                <p className="mt-3 text-[0.92rem] leading-[1.8] text-white/70">
                  {pickText(language, CAMPFIRE_UI_TEXT.bonfireActionLine)}
                </p>
                <pre className="mt-4 m-0 whitespace-pre-wrap text-[0.74rem] leading-[1.7] tracking-[0.12em] text-[rgba(214,204,188,0.78)]">
                  {bonfireStatusLine}
                  {"\n"}
                  {bonfireProgressLine}
                </pre>

                <div className="mt-4 space-y-1 text-[0.82rem] tracking-[0.14em] text-white/62">
                  <p>[1] {pickText(language, CAMPFIRE_UI_TEXT.ventureForth)}</p>
                  <p className={runState.progress.unspentStatPoints > 0 ? "text-white/62" : "text-white/28"}>
                    [2] {pickText(language, CAMPFIRE_UI_TEXT.allocateStats)}
                  </p>
                </div>

                {bonfireFeedback && (
                  <pre className="mt-4 m-0 whitespace-pre-wrap text-[0.76rem] leading-[1.7] text-ember/85">
                    {bonfireFeedback}
                  </pre>
                )}

                <form onSubmit={handleBonfireActionSubmit} className="mt-4 flex items-center gap-2">
                  <span className="font-bold text-ember">{">"}</span>
                  <input
                    type="text"
                    value={bonfireCommand}
                    onChange={(event) => setBonfireCommand(event.target.value)}
                    placeholder={pickText(language, CAMPFIRE_UI_TEXT.commandPlaceholder)}
                    autoFocus
                    className="w-full border-0 border-b border-white/20 bg-transparent text-[0.95rem] text-ember outline-none placeholder:text-white/28 focus:border-ember"
                  />
                </form>
              </div>

              {levelUpPopupOpen && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]">
                  <div className="w-full max-w-[420px] rounded-[18px] border border-white/12 bg-[#080808] px-6 py-6 font-crt shadow-[0_0_30px_rgba(0,0,0,0.45)]">
                    <div className="px-1 py-1">
                      <p className="text-[0.86rem] uppercase tracking-[0.2em] text-ember/90">
                        {pickText(language, CAMPFIRE_UI_TEXT.popupTitle)}
                      </p>
                      <p className="mt-3 text-[0.84rem] leading-[1.7] text-white/62">
                        {pickText(language, CAMPFIRE_UI_TEXT.popupHint)}
                      </p>
                      <pre className="mt-4 m-0 whitespace-pre-wrap text-[0.76rem] leading-[1.65] tracking-[0.12em] text-[rgba(214,204,188,0.74)]">
                        {`${pickText(language, CAMPFIRE_UI_TEXT.statPointsLabel)}: ${runState.progress.unspentStatPoints}`}
                      </pre>

                      <div className="mt-4 space-y-2">
                        {PLAYER_STAT_ORDER.map((statKey, index) => (
                          <button
                            key={statKey}
                            type="button"
                            className={`flex w-full items-center justify-between rounded-[12px] border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-[transform,border-color,color] duration-150 ${
                              runState.progress.unspentStatPoints > 0
                                ? "cursor-pointer hover:border-ember/40 hover:translate-x-[2px]"
                                : "cursor-default"
                            }`}
                            disabled={runState.progress.unspentStatPoints <= 0}
                            onClick={() => handleSpendStatPoint(statKey)}
                          >
                            <pre className="m-0 whitespace-pre text-[0.74rem] leading-[1.5] tracking-[0.12em] text-white/72">
                              {`[${String(index + 1).padStart(2, "0")}] ${fitAsciiPanelText(statLabels[statKey].toUpperCase(), 12)}  ${String(runState.progress.baseStats[statKey]).padStart(2, "0")}`}
                            </pre>
                            <span className={`text-[0.78rem] ${runState.progress.unspentStatPoints > 0 ? "text-ember/92" : "text-white/24"}`}>
                              [+]
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          className="rounded border border-white/15 px-3 py-2 text-[0.82rem] tracking-[0.12em] text-white/72 transition-colors hover:border-ember/55 hover:text-ember"
                          onClick={() => setLevelUpPopupOpen(false)}
                        >
                          {pickText(language, CAMPFIRE_UI_TEXT.popupDone)}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {phase === "post-battle-event" && activeRunEvent && (
            <div className="relative z-0 flex w-full flex-col items-center gap-6">
              <BonfireTrailPanel
                hint={journeyHint}
                steps={journeySteps}
                title={journeyTitle}
              />

              <PostBattleEvent
                key={activeRunEvent.id}
                language={language}
                runEvent={activeRunEvent}
                equippedItems={equippedItems}
                onResolve={handleResolveRunEvent}
              />
            </div>
          )}

          <CrtOverlay />
        </div>
      ) : (
        <BattlePage
          baseStats={runState.progress.baseStats}
          experience={runState.progress.experience}
          hasPostBattleEvent={runState.depth % BATTLES_PER_BONFIRE === 0}
          initialHp={runState.currentHp}
          initialMana={runState.currentMana}
          initialPotionCharges={runState.potionCharges}
          journeyHint={journeyHint}
          journeyNodes={journeySteps}
          journeyTitle={journeyTitle}
          language={language}
          level={runState.progress.level}
          equippedItems={equippedItems}
          monster={currentMonster}
          nextLevelExperience={runState.progress.nextLevelExperience}
          onBattleEnd={handleBattleEnd}
        />
      )}

      <VocaLexicon
        language={language}
        decipher={lexiconDecipher}
        learnedEntryIds={learnedLexiconIds}
      />
    </div>
  );
}
