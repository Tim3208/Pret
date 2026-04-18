import { useState } from "react";
import {
  type EquipmentDefinition,
  getEquipmentSlotLabel,
} from "@/entities/equipment";
import type { Language } from "@/entities/locale";

interface BattleEquipmentOverlayProps {
  effectLabel: string;
  items: EquipmentDefinition[];
  language: Language;
}

/**
 * 플레이어 ASCII 위에 장비 핫스팟과 툴팁을 겹쳐 그리는 오버레이다.
 */
export default function BattleEquipmentOverlay({
  effectLabel,
  items,
  language,
}: BattleEquipmentOverlayProps) {
  const [hoveredEquipmentId, setHoveredEquipmentId] = useState<string | null>(null);

  return (
    <>
      {items.map((item) => {
        const isHovered = hoveredEquipmentId === item.id;
        const slotLabel = getEquipmentSlotLabel(item.slot, language);

        return (
          <button
            key={item.id}
            type="button"
            aria-label={`${slotLabel}: ${item.name[language]}`}
            className="absolute z-[4] h-[34px] w-[48px] cursor-help border-0 bg-transparent p-0"
            style={{
              left: `calc(${item.anchor.leftPercent}% + ${item.anchor.offsetX}px)`,
              top: `calc(${item.anchor.topPercent}% + ${item.anchor.offsetY}px)`,
              transform: `translate(-50%, -50%) rotate(${item.anchor.rotationDeg}deg) scale(${item.anchor.scale})`,
            }}
            onMouseEnter={() => setHoveredEquipmentId(item.id)}
            onMouseLeave={() =>
              setHoveredEquipmentId((current) => (current === item.id ? null : current))
            }
            onFocus={() => setHoveredEquipmentId(item.id)}
            onBlur={() =>
              setHoveredEquipmentId((current) => (current === item.id ? null : current))
            }
          >
            <span className="relative block">
              <span className="sr-only">{item.fragment}</span>
              <span
                className={`pointer-events-none absolute min-w-[180px] max-w-[220px] rounded-[14px] border border-white/12 bg-black/84 px-3 py-2 text-left font-crt transition-opacity duration-150 ${getTooltipPositionClassName(
                  item.anchor.tooltipSide,
                )} ${isHovered ? "opacity-100" : "opacity-0"}`}
              >
                <span className="block text-[0.62rem] uppercase tracking-[0.18em] text-white/42">
                  {slotLabel}
                </span>
                <span className="mt-1 block text-[0.74rem] tracking-[0.08em] text-ember">
                  {item.name[language]}
                </span>
                <span className="mt-2 block text-[0.68rem] leading-[1.45] text-white/72">
                  {effectLabel} {item.effectText[language]}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </>
  );
}

/**
 * 장비 툴팁이 장비 조각 주변 어느 방향에 붙어야 하는지 Tailwind 클래스로 변환한다.
 */
function getTooltipPositionClassName(
  tooltipSide: EquipmentDefinition["anchor"]["tooltipSide"],
): string {
  if (tooltipSide === "left") {
    return "right-[calc(100%+0.55rem)] top-1/2 -translate-y-1/2";
  }

  if (tooltipSide === "right") {
    return "left-[calc(100%+0.55rem)] top-1/2 -translate-y-1/2";
  }

  return "bottom-[calc(100%+0.55rem)] left-1/2 -translate-x-1/2";
}
