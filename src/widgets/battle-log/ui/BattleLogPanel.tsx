import type { ReactNode, RefObject } from "react";

interface BattleLogPanelProps {
  /** 전투 로그를 그리는 중앙 CRT 캔버스 ref */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** CRT 글리치 애니메이션 활성화 여부 */
  glitchActive: boolean;
  children?: ReactNode;
}

/**
 * 전투 로그 캔버스의 외곽 프레임과 CRT 패널 레이아웃을 담당한다.
 * 실제 로그 렌더링과 이펙트 계산은 상위 전투 위젯에서 계속 처리한다.
 */
export default function BattleLogPanel({
  canvasRef,
  glitchActive,
  children,
}: BattleLogPanelProps) {
  return (
    <div
      className="absolute left-1/2 top-[48%] z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ width: "min(82vw, 520px)" }}
    >
      <div
        className={`relative rounded-[24px] bg-black/18 ${
          glitchActive ? "animate-crt-glitch" : ""
        }`}
      >
        <canvas ref={canvasRef} className="relative block h-auto w-full" />
        {children}
      </div>
    </div>
  );
}
