import type { PointerEventHandler } from "react";

import HealthPotion from "./HealthPotion";

export const POTION_USE_BUTTON_WIDTH = 56;
export const POTION_USE_BUTTON_HEIGHT = 92;

interface PotionUseButtonProps {
  /** 포션 버튼 접근성 라벨 */
  ariaLabel: string;
  /** 포션 위에 표시되는 짧은 라벨 */
  label: string;
  /** 포션 아래 툴팁 문구 */
  tooltip: string;
  /** 전투 프레임 내부 기준 포션 중심 좌표 */
  position: { x: number; y: number };
  /** 드래그 중 여부 */
  dragging: boolean;
  /** 마우스 hover 상태 */
  hovered: boolean;
  /** 플레이어 본체 위에 올라간 상태 */
  hoveringPlayer: boolean;
  /** 포인터 입력 시작 핸들러 */
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  /** 포인터 이동 핸들러 */
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  /** 포인터 입력 종료 핸들러 */
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  /** 포인터 입력 취소 핸들러 */
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  /** hover 진입 핸들러 */
  onHoverStart: () => void;
  /** hover 이탈 핸들러 */
  onHoverEnd: () => void;
}

/**
 * 전투 중 드래그 가능한 포션 버튼의 시각 표현과 툴팁 표시를 담당한다.
 * 실제 좌표 계산과 사용 판정은 상위 전투 위젯에서 유지한다.
 */
export default function PotionUseButton({
  ariaLabel,
  label,
  tooltip,
  position,
  dragging,
  hovered,
  hoveringPlayer,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onHoverStart,
  onHoverEnd,
}: PotionUseButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="absolute z-[44] border-0 bg-transparent p-0"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(-50%, -50%) scale(${dragging ? 1.06 : hoveringPlayer ? 1.08 : 1})`,
        animation: dragging
          ? "none"
          : "potion-orbit 5.2s cubic-bezier(0.37, 0, 0.18, 1) infinite, potion-spin 7.8s linear infinite",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div
        className={`relative flex h-[92px] w-[56px] items-start justify-center transition-[filter,transform] duration-150 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          filter: hoveringPlayer
            ? "drop-shadow(0 0 22px rgba(255, 76, 76, 0.36)) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.36))"
            : "drop-shadow(0 0 14px rgba(255, 92, 92, 0.22)) drop-shadow(0 10px 18px rgba(0, 0, 0, 0.32))",
        }}
      >
        <span className="pointer-events-none absolute left-1/2 top-[-0.9rem] -translate-x-1/2 whitespace-nowrap font-crt text-[0.52rem] tracking-[0.18em] text-[rgba(255,156,156,0.82)] [text-shadow:0_0_6px_rgba(184,28,44,0.26)]">
          {label}
        </span>
        <div className="pointer-events-none absolute left-1/2 top-[66px] h-[15px] w-[34px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,102,102,0.34)_0%,rgba(255,102,102,0.06)_58%,rgba(255,102,102,0)_100%)] blur-[4px]" />
        <div className="pointer-events-none absolute left-1/2 top-[7px] -translate-x-1/2">
          <HealthPotion />
        </div>
        <span
          className={`pointer-events-none absolute left-1/2 top-[calc(100%+0.15rem)] -translate-x-1/2 whitespace-nowrap font-crt text-[0.5rem] tracking-[0.06em] text-[rgba(255,186,186,0.78)] transition-opacity duration-150 ${
            hovered && !dragging ? "opacity-100" : "opacity-0"
          }`}
        >
          {tooltip}
        </span>
      </div>
    </button>
  );
}
