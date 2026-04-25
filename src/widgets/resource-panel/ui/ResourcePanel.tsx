import HeartHP from "./HeartHP";
import ManaFlask from "./ManaFlask";

interface ResourcePanelProps {
  experienceAnimating?: boolean;
  hpCurrent: number;
  hpMax: number;
  level?: number;
  levelUpHighlight?: boolean;
  manaCurrent: number;
  manaMax: number;
  nextLevelExperience?: number;
  shield: number;
  experience?: number;
  hpLabel: string;
  manaLabel: string;
  shieldLabel: string;
}

/**
 * 전투 HUD에 표시할 단순 ASCII 레벨/경험치 바 문자열을 만든다.
 *
 * @param level 현재 레벨
 * @param experience 현재 레벨 구간 경험치
 * @param nextLevelExperience 다음 레벨까지 필요한 경험치
 * @returns 두 줄짜리 ASCII 진행 문자열
 */
function buildExperienceMeter(
  level: number,
  experience: number,
  nextLevelExperience: number,
): string {
  const width = 18;
  const safeNext = Math.max(1, nextLevelExperience);
  const safeExperience = Math.max(0, Math.min(experience, safeNext));
  const filled = Math.round((safeExperience / safeNext) * width);
  const bar = `${"=".repeat(filled)}${".".repeat(Math.max(0, width - filled))}`;

  return `LV ${String(level).padStart(2, "0")} [${bar}]\nXP ${String(safeExperience).padStart(2, "0")} / ${String(safeNext).padStart(2, "0")}`;
}

/**
 * 전투 장면에서 체력과 마나 위젯을 한 덩어리로 배치하는 자원 패널이다.
 */
export default function ResourcePanel({
  experienceAnimating = false,
  hpCurrent,
  hpMax,
  level = 1,
  levelUpHighlight = false,
  manaCurrent,
  manaMax,
  nextLevelExperience = 10,
  shield,
  experience = 0,
  hpLabel,
  manaLabel,
  shieldLabel,
}: ResourcePanelProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative rounded-[12px] border border-[rgba(214,204,188,0.22)] bg-[rgba(10,10,10,0.46)] px-3 py-2 ${experienceAnimating ? "animate-xp-gain-pulse" : ""}`}
      >
        {levelUpHighlight && (
          <div className="pointer-events-none absolute inset-[-3px] rounded-[14px] border border-[rgba(255,220,120,0.95)] animate-xp-level-ring" />
        )}
        <pre className="m-0 whitespace-pre text-center font-crt text-[0.66rem] leading-[1.45] tracking-[0.08em] text-[rgba(214,204,188,0.72)]">
          {buildExperienceMeter(level, experience, nextLevelExperience)}
        </pre>
      </div>
      <div className="flex items-end gap-6">
        <HeartHP
          current={hpCurrent}
          max={hpMax}
          shield={shield}
          label={hpLabel}
          shieldLabel={shieldLabel}
        />
        <ManaFlask current={manaCurrent} max={manaMax} label={manaLabel} />
      </div>
    </div>
  );
}
