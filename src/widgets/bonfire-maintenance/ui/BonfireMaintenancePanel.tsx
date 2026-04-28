import { type FormEvent, useState } from "react";
import {
  BONFIRE_RECIPE_TEXT,
  INVENTORY_ITEM_TEXT,
} from "@/content/catalog/inventory/inventoryText";
import { CAMPFIRE_UI_TEXT } from "@/content/text/app/campfire";
import {
  BONFIRE_RECIPES,
  type BonfireRecipeId,
  type InventoryItemId,
  type InventoryRequirement,
  type RunInventory,
  getInventoryQuantity,
} from "@/entities/inventory";
import { type Language, interpolateText, pickText } from "@/entities/locale";
import type { BonfireMealEffect } from "@/entities/run";
import { useAsciiAsset } from "@/shared/lib/ascii";
import BonfireTypewriterMessage from "./BonfireTypewriterMessage";

interface BonfireMaintenancePanelProps {
  activeMealEffect: BonfireMealEffect | null;
  canCookStew: boolean;
  canCraftGear: boolean;
  canCraftSigil: boolean;
  canMaintain: boolean;
  canRest: boolean;
  command: string;
  feedback: string;
  hasStatPoints: boolean;
  inventory: RunInventory;
  language: Language;
  progressLine: string;
  statusLine: string;
  onCommandChange: (value: string) => void;
  onCommandSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCookStew: () => void;
  onCraftGear: () => void;
  onCraftSigil: () => void;
  onOpenStats: () => void;
  onRest: () => void;
  onVenture: () => void;
}

type ModalKind = "cook" | "craft" | "terminal";

type DockActionId =
  | "cook"
  | "craft"
  | "rest"
  | "stats"
  | "terminal"
  | "venture";

interface DockAction {
  assetHint: string;
  disabled: boolean;
  id: DockActionId;
  icon: readonly string[];
  iconClassName?: string;
  label: string;
  onClick: () => void;
  tooltip: string;
}

interface RecipeCard {
  assetHint: string;
  enabled: boolean;
  id: BonfireRecipeId;
  icon: readonly string[];
  onClick: () => void;
}

const ACTION_ICONS: Record<DockActionId, readonly string[]> = {
  cook: [" .-. ", "(   )", " ### "],
  craft: ["  /\\ ", " /==\\", "  ** "],
  rest: [" ___ ", "/___\\", " z z "],
  stats: [" /\\  ", "<  >", " \\/+ "],
  terminal: [">__ ", "|  |", "|__|"],
  venture: ["  ->", " /  ", "/___"],
};

const RECIPE_ICONS: Record<BonfireRecipeId, readonly string[]> = {
  "ashen-sigil": [" .-. ", "( # )", " '-' "],
  "ember-stew": [" .-. ", "(~~~)", " ### "],
  "field-forged-gear": [" /\\  ", "/==\\ ", " **  "],
};

const MATERIAL_ICONS: Record<InventoryItemId, readonly string[]> = {
  "ashen-sigil": ["(#)"],
  "beast-scrap": ["{#}"],
  "ember-shard": ["/*\\"],
  "wild-herb": ["// "],
};

const ACTION_ASSET_HINTS: Record<DockActionId, string> = {
  cook: "정식 에셋 후보: 작고 검은 냄비와 불꽃 실루엣.",
  craft: "정식 에셋 후보: 망치와 모루, 또는 불씨 위에 놓인 장비 실루엣.",
  rest: "정식 에셋 후보: 침낭, 눈감은 얼굴, 또는 모닥불 옆 담요.",
  stats: "정식 에셋 후보: 별 모양 능력치 표식 또는 룬 포인트.",
  terminal: "정식 에셋 후보: 작은 CRT 입력 프롬프트 아이콘.",
  venture: "정식 에셋 후보: 길 화살표, 지도 핀, 또는 발자국.",
};

const RECIPE_ASSET_HINTS: Record<BonfireRecipeId, string> = {
  "ashen-sigil": "정식 에셋 후보: 손바닥 크기의 재색 룬 인장.",
  "ember-stew": "정식 에셋 후보: 김이 나는 냄비와 불씨.",
  "field-forged-gear": "정식 에셋 후보: 제작 결과 장비의 실제 실루엣.",
};

const LARGE_DOCK_ASCII_CLASSNAME =
  "scale-x-[0.56] scale-y-[0.69] text-[0.35rem] leading-[0.78] tracking-[0] [transform-origin:center]";

/**
 * 공식 에셋이 생기기 전까지 쓰는 ASCII 임시 아이콘이다.
 * 각 메타의 assetHint는 추후 그래픽 에셋 제작자가 참고할 후보 설명이다.
 */
function AsciiIcon({
  className = "text-[0.66rem] leading-[0.95] tracking-[0.02em]",
  lines,
}: {
  className?: string;
  lines: readonly string[];
}) {
  return (
    <pre className={`m-0 whitespace-pre text-center ${className}`}>
      {lines.join("\n")}
    </pre>
  );
}

/**
 * 재료 요구량을 현재 보유량과 함께 표시할 문장으로 만든다.
 *
 * @param language 현재 언어
 * @param requirements 레시피 요구 재료
 * @param inventory 현재 런 인벤토리
 * @returns 보유량이 포함된 재료 문장
 */
function formatRequirements(
  language: Language,
  requirements: readonly InventoryRequirement[],
  inventory: RunInventory,
): string {
  return requirements
    .map((requirement) => {
      const itemText = INVENTORY_ITEM_TEXT[requirement.id];
      const owned = getInventoryQuantity(inventory, requirement.id);
      return `${itemText.name[language]} ${owned}/${requirement.quantity}`;
    })
    .join(" // ");
}

/**
 * 레시피가 요구하는 재료를 작은 아이콘 배지로 표시한다.
 */
function MaterialBadges({
  inventory,
  language,
  requirements,
}: {
  inventory: RunInventory;
  language: Language;
  requirements: readonly InventoryRequirement[];
}) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
      {requirements.map((requirement) => {
        const owned = getInventoryQuantity(inventory, requirement.id);
        const hasEnough = owned >= requirement.quantity;
        return (
          <span
            key={requirement.id}
            className={`group/material relative flex min-w-[2.7rem] items-center justify-center gap-1 rounded-[6px] border px-1.5 py-1 ${
              hasEnough
                ? "border-ember/24 bg-ember/[0.045] text-ember/84"
                : "border-white/8 bg-white/[0.018] text-white/28"
            }`}
          >
            <AsciiIcon lines={MATERIAL_ICONS[requirement.id]} />
            <span className="text-[0.58rem] leading-none">
              {owned}/{requirement.quantity}
            </span>
            <span className="pointer-events-none absolute bottom-[calc(100%+0.35rem)] left-1/2 z-30 w-max max-w-[11rem] -translate-x-1/2 rounded-[6px] border border-white/12 bg-black/90 px-2 py-1 text-[0.58rem] leading-[1.35] text-white/72 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.32)] transition-opacity group-hover/material:opacity-100 group-focus-within/material:opacity-100">
              {INVENTORY_ITEM_TEXT[requirement.id].name[language]}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * 도크 아이콘 버튼과 hover 설명을 렌더링한다.
 */
function DockActionButton({ action }: { action: DockAction }) {
  return (
    <button
      type="button"
      aria-disabled={action.disabled}
      aria-label={action.label}
      className={`group relative flex h-[3.4rem] w-[3.65rem] shrink-0 flex-col items-center justify-center rounded-[8px] border transition-[border-color,color,background-color,transform,filter] ${
        action.disabled
          ? "border-white/8 bg-white/[0.012] text-white/24"
          : "border-white/12 bg-white/[0.035] text-white/66 hover:-translate-y-[2px] hover:border-ember/45 hover:text-ember hover:drop-shadow-[0_0_12px_rgba(255,170,0,0.18)]"
      }`}
      onClick={action.onClick}
    >
      <AsciiIcon className={action.iconClassName} lines={action.icon} />
      <span className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-40 w-[13rem] -translate-x-1/2 rounded-[8px] border border-white/12 bg-black/92 px-3 py-2 text-left font-crt opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.38)] transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        <span className="block text-[0.68rem] tracking-[0.14em] text-ember/86">
          {action.label}
        </span>
        <span className="mt-1 block text-[0.62rem] leading-[1.45] tracking-[0.04em] text-white/66">
          {action.tooltip}
        </span>
        <span className="sr-only">{action.assetHint}</span>
      </span>
    </button>
  );
}

/**
 * 제작/요리 팝업 안에서 레시피 하나를 아이콘 카드로 렌더링한다.
 */
function RecipeIconCard({
  inventory,
  language,
  recipe,
}: {
  inventory: RunInventory;
  language: Language;
  recipe: RecipeCard;
}) {
  const recipeText = BONFIRE_RECIPE_TEXT[recipe.id];
  const requirements = BONFIRE_RECIPES[recipe.id].requirements;

  return (
    <button
      type="button"
      aria-disabled={!recipe.enabled}
      aria-label={recipeText.name[language]}
      className={`group/card relative rounded-[8px] border px-3 py-3 transition-[border-color,color,background-color,transform] ${
        recipe.enabled
          ? "border-white/12 bg-white/[0.035] text-white/72 hover:-translate-y-[1px] hover:border-ember/45 hover:text-ember"
          : "border-white/8 bg-white/[0.012] text-white/28"
      }`}
      onClick={() => {
        if (recipe.enabled) {
          recipe.onClick();
        }
      }}
    >
      <div className="flex min-h-[4.9rem] flex-col items-center justify-center gap-2">
        <AsciiIcon lines={recipe.icon} />
        <MaterialBadges
          inventory={inventory}
          language={language}
          requirements={requirements}
        />
      </div>
      <span className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-40 w-[15rem] -translate-x-1/2 rounded-[8px] border border-white/12 bg-black/92 px-3 py-2 text-left font-crt opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.38)] transition-opacity group-hover/card:opacity-100 group-focus/card:opacity-100">
        <span className="block text-[0.7rem] tracking-[0.12em] text-ember/86">
          {recipeText.name[language]}
        </span>
        <span className="mt-1 block text-[0.62rem] leading-[1.45] text-white/62">
          {recipeText.description[language]}
        </span>
        <span className="mt-1 block text-[0.6rem] leading-[1.45] text-white/44">
          {recipeText.effect[language]}
        </span>
        <span className="mt-1 block text-[0.6rem] leading-[1.45] text-ember/62">
          {formatRequirements(language, requirements, inventory)}
        </span>
        <span className="sr-only">{recipe.assetHint}</span>
      </span>
    </button>
  );
}

/**
 * 모닥불 정비 허브의 아이콘 도크, 팝업, 짧은 Pretext 토스트를 렌더링한다.
 */
export default function BonfireMaintenancePanel({
  activeMealEffect,
  canCookStew,
  canCraftGear,
  canCraftSigil,
  canMaintain,
  canRest,
  command,
  feedback,
  hasStatPoints,
  inventory,
  language,
  progressLine,
  statusLine,
  onCommandChange,
  onCommandSubmit,
  onCookStew,
  onCraftGear,
  onCraftSigil,
  onOpenStats,
  onRest,
  onVenture,
}: BonfireMaintenancePanelProps) {
  const assetBase = import.meta.env.BASE_URL;
  const { lines: campingIconLines } = useAsciiAsset(
    `${assetBase}assets/icons/camping_ascii.md`,
  );
  const { lines: anvilIconLines } = useAsciiAsset(
    `${assetBase}assets/icons/anvil_ascii.md`,
  );
  const { lines: potIconLines } = useAsciiAsset(
    `${assetBase}assets/icons/pot_ascii.md`,
  );
  const { lines: starIconLines } = useAsciiAsset(
    `${assetBase}assets/icons/star_ascii.md`,
  );
  const restIcon =
    campingIconLines.length > 0 ? campingIconLines : ACTION_ICONS.rest;
  const craftIcon =
    anvilIconLines.length > 0 ? anvilIconLines : ACTION_ICONS.craft;
  const cookIcon = potIconLines.length > 0 ? potIconLines : ACTION_ICONS.cook;
  const statsIcon =
    starIconLines.length > 0 ? starIconLines : ACTION_ICONS.stats;
  const [activeModal, setActiveModal] = useState<ModalKind | null>(null);
  const sessionLine =
    canRest && canMaintain
      ? pickText(language, CAMPFIRE_UI_TEXT.sessionIdleLine)
      : canMaintain
        ? pickText(language, CAMPFIRE_UI_TEXT.sessionMaintenanceLine)
        : pickText(language, CAMPFIRE_UI_TEXT.sessionRestedLine);
  const dockActions: DockAction[] = [
    {
      assetHint: ACTION_ASSET_HINTS.rest,
      disabled: !canRest,
      icon: restIcon,
      iconClassName: LARGE_DOCK_ASCII_CLASSNAME,
      id: "rest",
      label: pickText(language, CAMPFIRE_UI_TEXT.rest),
      onClick: onRest,
      tooltip: canRest
        ? sessionLine
        : pickText(language, CAMPFIRE_UI_TEXT.restLockedByMaintenance),
    },
    {
      assetHint: ACTION_ASSET_HINTS.craft,
      disabled: !canMaintain,
      icon: craftIcon,
      iconClassName: LARGE_DOCK_ASCII_CLASSNAME,
      id: "craft",
      label: pickText(language, CAMPFIRE_UI_TEXT.craftGear),
      onClick: () => {
        if (!canMaintain) {
          onCraftGear();
          return;
        }
        setActiveModal("craft");
      },
      tooltip: canMaintain
        ? pickText(language, CAMPFIRE_UI_TEXT.recipeTitle)
        : pickText(language, CAMPFIRE_UI_TEXT.maintenanceLockedByRest),
    },
    {
      assetHint: ACTION_ASSET_HINTS.cook,
      disabled: !canMaintain,
      icon: cookIcon,
      iconClassName: LARGE_DOCK_ASCII_CLASSNAME,
      id: "cook",
      label: pickText(language, CAMPFIRE_UI_TEXT.cookStew),
      onClick: () => {
        if (!canMaintain) {
          onCookStew();
          return;
        }
        setActiveModal("cook");
      },
      tooltip: canMaintain
        ? BONFIRE_RECIPE_TEXT["ember-stew"].effect[language]
        : pickText(language, CAMPFIRE_UI_TEXT.maintenanceLockedByRest),
    },
    {
      assetHint: ACTION_ASSET_HINTS.stats,
      disabled: !hasStatPoints,
      icon: statsIcon,
      iconClassName: LARGE_DOCK_ASCII_CLASSNAME,
      id: "stats",
      label: pickText(language, CAMPFIRE_UI_TEXT.allocateStats),
      onClick: onOpenStats,
      tooltip: hasStatPoints
        ? pickText(language, CAMPFIRE_UI_TEXT.popupHint)
        : pickText(language, CAMPFIRE_UI_TEXT.noStatPoints),
    },
    {
      assetHint: ACTION_ASSET_HINTS.venture,
      disabled: false,
      icon: ACTION_ICONS.venture,
      id: "venture",
      label: pickText(language, CAMPFIRE_UI_TEXT.ventureForth),
      onClick: onVenture,
      tooltip: pickText(language, CAMPFIRE_UI_TEXT.journeyHintSecondBattle),
    },
    {
      assetHint: ACTION_ASSET_HINTS.terminal,
      disabled: false,
      icon: ACTION_ICONS.terminal,
      id: "terminal",
      label: pickText(language, CAMPFIRE_UI_TEXT.commandTitle),
      onClick: () => setActiveModal("terminal"),
      tooltip: pickText(language, CAMPFIRE_UI_TEXT.commandPlaceholder),
    },
  ];
  const recipeCards: RecipeCard[] =
    activeModal === "cook"
      ? [
          {
            assetHint: RECIPE_ASSET_HINTS["ember-stew"],
            enabled: canMaintain && canCookStew,
            icon: RECIPE_ICONS["ember-stew"],
            id: "ember-stew",
            onClick: () => {
              onCookStew();
              setActiveModal(null);
            },
          },
        ]
      : [
          {
            assetHint: RECIPE_ASSET_HINTS["field-forged-gear"],
            enabled: canMaintain && canCraftGear,
            icon: RECIPE_ICONS["field-forged-gear"],
            id: "field-forged-gear",
            onClick: () => {
              onCraftGear();
              setActiveModal(null);
            },
          },
          {
            assetHint: RECIPE_ASSET_HINTS["ashen-sigil"],
            enabled: canMaintain && canCraftSigil,
            icon: RECIPE_ICONS["ashen-sigil"],
            id: "ashen-sigil",
            onClick: () => {
              onCraftSigil();
              setActiveModal(null);
            },
          },
        ];

  return (
    <div className="relative mt-3 w-full max-w-[740px] font-crt opacity-0 [animation:fade_1s_2.65s_forwards]">
      <BonfireTypewriterMessage key={feedback} message={feedback} />

      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-black/38 px-3 py-2 shadow-[inset_0_0_28px_rgba(0,0,0,0.32)] backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <pre className="m-0 truncate text-[0.62rem] leading-[1.45] tracking-[0.08em] text-white/55">
            {statusLine}
          </pre>
          <pre className="m-0 hidden truncate text-[0.58rem] leading-[1.35] tracking-[0.08em] text-white/32 sm:block">
            {progressLine}
          </pre>
        </div>

        {activeMealEffect && (
          <div className="group/meal relative flex h-[3.15rem] w-[3.25rem] shrink-0 items-center justify-center rounded-[8px] border border-ember/22 bg-ember/[0.045] text-ember/78">
            <AsciiIcon lines={ACTION_ICONS.cook} />
            <span className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-40 w-[13rem] -translate-x-1/2 rounded-[8px] border border-white/12 bg-black/92 px-3 py-2 text-left opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.38)] transition-opacity group-hover/meal:opacity-100">
              <span className="block text-[0.68rem] tracking-[0.12em] text-ember/86">
                {BONFIRE_RECIPE_TEXT[activeMealEffect.id].name[language]}
              </span>
              <span className="mt-1 block text-[0.6rem] leading-[1.45] text-white/62">
                {interpolateText(
                  pickText(language, CAMPFIRE_UI_TEXT.mealEffectLine),
                  {
                    attack: activeMealEffect.attackDamageBonus,
                    mealName:
                      BONFIRE_RECIPE_TEXT[activeMealEffect.id].name[language],
                    shield: activeMealEffect.shieldOnDefendBonus,
                  },
                )}
              </span>
            </span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {dockActions.map((action) => (
            <DockActionButton key={action.id} action={action} />
          ))}
        </div>
      </div>

      {activeModal && (
        <div className="absolute bottom-[calc(100%+0.8rem)] left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-[10px] border border-white/12 bg-[#070604]/95 px-4 py-4 shadow-[0_22px_70px_rgba(0,0,0,0.62)] backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="m-0 text-[0.7rem] uppercase tracking-[0.22em] text-ember/82">
              {activeModal === "craft"
                ? pickText(language, CAMPFIRE_UI_TEXT.recipeTitle)
                : activeModal === "cook"
                  ? pickText(language, CAMPFIRE_UI_TEXT.cookStew)
                  : pickText(language, CAMPFIRE_UI_TEXT.commandTitle)}
            </p>
            <button
              type="button"
              className="h-7 w-7 rounded-[6px] border border-white/12 text-[0.76rem] text-white/54 transition-colors hover:border-ember/40 hover:text-ember"
              onClick={() => setActiveModal(null)}
            >
              x
            </button>
          </div>

          {activeModal === "terminal" ? (
            <form
              onSubmit={(event) => {
                onCommandSubmit(event);
                setActiveModal(null);
              }}
              className="flex items-center gap-2"
            >
              <span className="font-bold text-ember">{">"}</span>
              <input
                type="text"
                value={command}
                onChange={(event) => onCommandChange(event.target.value)}
                placeholder={pickText(
                  language,
                  CAMPFIRE_UI_TEXT.commandPlaceholder,
                )}
                autoFocus
                className="w-full border-0 border-b border-white/20 bg-transparent text-[0.92rem] text-ember outline-none placeholder:text-white/28 focus:border-ember"
              />
            </form>
          ) : (
            <div className="grid max-h-[min(42vh,340px)] gap-3 overflow-y-auto px-1 py-1 sm:grid-cols-2">
              {recipeCards.map((recipe) => (
                <RecipeIconCard
                  key={recipe.id}
                  inventory={inventory}
                  language={language}
                  recipe={recipe}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
