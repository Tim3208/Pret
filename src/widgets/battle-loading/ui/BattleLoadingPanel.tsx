interface BattleLoadingPanelProps {
  /** 전투 준비 중 화면에 표시할 안내 문구 */
  message: string;
}

/**
 * 전투 화면 진입 직전에 ASCII 자산을 준비하는 동안 보여주는 로딩 화면이다.
 *
 * @param props 로딩 중 안내 문구
 */
export default function BattleLoadingPanel({
  message,
}: BattleLoadingPanelProps) {
  return (
    <p className="px-6 text-[1.15rem] leading-[1.9] text-ash [text-shadow:0_0_4px_rgba(255,255,255,0.1)]">
      {message}
    </p>
  );
}
