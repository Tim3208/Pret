import type { FormEvent } from "react";
import { BONFIRE_RECIPE_TEXT, INVENTORY_ITEM_TEXT } from "@/content/catalog/inventory/inventoryText";
import { CAMPFIRE_UI_TEXT } from "@/content/text/app/campfire";
import {
  BONFIRE_RECIPES,
  type BonfireRecipeId,
  type InventoryRequirement,
  type RunInventory,
  getInventoryQuantity,
  getInventoryStacks,
} from "@/entities/inventory";
import {
  type Language,
  interpolateText,
  pickText,
} from "@/entities/locale";
import type { BonfireMealEffect } from "@/entities/run";
import PretextRitualPanel from "@/shared/ui/pretext-ritual-panel";

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

interface ActionButtonProps {
  disabled?: boolean;
  label: string;
  onClick: () => void;
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
 * 정비 행동 버튼을 공통 스타일로 렌더링한다.
 */
function ActionButton({
  disabled = false,
  label,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-[8px] border px-3 py-2 text-left text-[0.72rem] tracking-[0.12em] transition-[border-color,color,background-color,transform] ${
        disabled
          ? "cursor-not-allowed border-white/8 bg-white/[0.015] text-white/26"
          : "cursor-pointer border-white/12 bg-white/[0.035] text-white/66 hover:-translate-y-[1px] hover:border-ember/42 hover:text-ember"
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/**
 * 모닥불 정비 허브의 선택지, 인벤토리, Pretext 결과 패널을 렌더링한다.
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
  const inventoryStacks = getInventoryStacks(inventory);
  const ritualLines = [
    pickText(language, CAMPFIRE_UI_TEXT.bonfireActionLine),
    canRest && canMaintain
      ? pickText(language, CAMPFIRE_UI_TEXT.sessionIdleLine)
      : canMaintain
        ? pickText(language, CAMPFIRE_UI_TEXT.sessionMaintenanceLine)
        : pickText(language, CAMPFIRE_UI_TEXT.sessionRestedLine),
    statusLine,
    progressLine,
    activeMealEffect
      ? interpolateText(
        pickText(language, CAMPFIRE_UI_TEXT.mealEffectLine),
        {
          attack: activeMealEffect.attackDamageBonus,
          mealName: BONFIRE_RECIPE_TEXT[activeMealEffect.id].name[language],
          shield: activeMealEffect.shieldOnDefendBonus,
        },
      )
      : pickText(language, CAMPFIRE_UI_TEXT.noMealEffectLine),
  ];

  if (feedback) {
    ritualLines.push(...feedback.split("\n"));
  }

  return (
    <div className="mt-8 w-full max-w-[760px] rounded-[8px] border border-white/10 bg-black/32 px-5 py-4 font-crt opacity-0 backdrop-blur-sm [animation:fade_1s_3s_forwards]">
      <PretextRitualPanel
        lines={ritualLines}
        title={pickText(language, CAMPFIRE_UI_TEXT.commandTitle)}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.25fr]">
        <section className="rounded-[8px] border border-white/8 bg-white/[0.018] px-3 py-3">
          <p className="m-0 text-[0.68rem] tracking-[0.18em] text-white/42">
            {pickText(language, CAMPFIRE_UI_TEXT.inventoryTitle)}
          </p>
          <div className="mt-3 space-y-1 text-[0.72rem] leading-[1.6] tracking-[0.08em] text-white/62">
            {inventoryStacks.length > 0 ? (
              inventoryStacks.map((stack) => (
                <p key={stack.id} className="m-0 flex items-center justify-between gap-3">
                  <span>{INVENTORY_ITEM_TEXT[stack.id].name[language]}</span>
                  <span className="text-ember/80">x{stack.quantity}</span>
                </p>
              ))
            ) : (
              <p className="m-0 text-white/32">
                {pickText(language, CAMPFIRE_UI_TEXT.inventoryEmpty)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-white/8 bg-white/[0.018] px-3 py-3">
          <p className="m-0 text-[0.68rem] tracking-[0.18em] text-white/42">
            {pickText(language, CAMPFIRE_UI_TEXT.recipeTitle)}
          </p>
          <div className="mt-3 grid gap-2">
            {([
              ["field-forged-gear", canCraftGear, onCraftGear, pickText(language, CAMPFIRE_UI_TEXT.craftGear)],
              ["ashen-sigil", canCraftSigil, onCraftSigil, pickText(language, CAMPFIRE_UI_TEXT.craftSigil)],
              ["ember-stew", canCookStew, onCookStew, pickText(language, CAMPFIRE_UI_TEXT.cookStew)],
            ] as const).map(([recipeId, enabled, onClick, actionLabel]) => (
              <div key={recipeId} className="rounded-[8px] border border-white/7 bg-black/18 p-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="m-0 text-[0.74rem] tracking-[0.1em] text-white/70">
                      {actionLabel}
                    </p>
                    <p className="m-0 mt-1 text-[0.66rem] leading-[1.45] text-white/45">
                      {BONFIRE_RECIPE_TEXT[recipeId].description[language]}
                    </p>
                    <p className="m-0 mt-1 text-[0.62rem] leading-[1.45] text-white/38">
                      {BONFIRE_RECIPE_TEXT[recipeId].effect[language]}
                    </p>
                    <p className="m-0 mt-1 text-[0.62rem] leading-[1.45] text-ember/58">
                      {formatRequirements(language, BONFIRE_RECIPES[recipeId as BonfireRecipeId].requirements, inventory)}
                    </p>
                  </div>
                  <ActionButton
                    disabled={!canMaintain || !enabled}
                    label={BONFIRE_RECIPE_TEXT[recipeId].name[language]}
                    onClick={onClick}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ActionButton
          disabled={!canRest}
          label={`[1] ${pickText(language, CAMPFIRE_UI_TEXT.rest)}`}
          onClick={onRest}
        />
        <ActionButton
          disabled={!hasStatPoints}
          label={`[5] ${pickText(language, CAMPFIRE_UI_TEXT.allocateStats)}`}
          onClick={onOpenStats}
        />
        <ActionButton
          label={`[6] ${pickText(language, CAMPFIRE_UI_TEXT.ventureForth)}`}
          onClick={onVenture}
        />
      </div>

      <form onSubmit={onCommandSubmit} className="mt-4 flex items-center gap-2">
        <span className="font-bold text-ember">{">"}</span>
        <input
          type="text"
          value={command}
          onChange={(event) => onCommandChange(event.target.value)}
          placeholder={pickText(language, CAMPFIRE_UI_TEXT.commandPlaceholder)}
          autoFocus
          className="w-full border-0 border-b border-white/20 bg-transparent text-[0.95rem] text-ember outline-none placeholder:text-white/28 focus:border-ember"
        />
      </form>
    </div>
  );
}
