interface BattleOutcomePanelProps {
  /** 전투 결과 종류 */
  variant: "victory" | "defeat";
  /** 결과 화면의 메인 문구 */
  title: string;
  /** 결과 화면의 보조 안내 문구 */
  subtitle: string;
}

/**
 * 전투 종료 후 승리 또는 패배 결과 화면의 시각 표현을 담당한다.
 *
 * @param props 결과 종류와 출력 문구
 */
export default function BattleOutcomePanel({
  variant,
  title,
  subtitle,
}: BattleOutcomePanelProps) {
  const titleClassName =
    variant === "victory"
      ? "text-[1.3rem] text-ember tracking-wider [text-shadow:0_0_12px_rgba(255,170,0,0.4)]"
      : "text-[1.3rem] tracking-wider text-red-300 [text-shadow:0_0_12px_rgba(220,38,38,0.35)]";

  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in-quick">
      <p className={titleClassName}>{title}</p>
      <p className="text-[0.85rem] text-white/40 tracking-[0.15em]">
        {subtitle}
      </p>
    </div>
  );
}
