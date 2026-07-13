import { RUN_RESULT_TEXT } from "@/content/text/run/result";
import { interpolateText, pickText, type Language } from "@/entities/locale";
import type { EquippedItems } from "@/entities/equipment";
import type { RunResult } from "@/entities/run";
import PretextRitualPanel from "@/shared/ui/pretext-ritual-panel";

interface RunResultPageProps {
  language: Language;
  onRestart: () => void;
  result: RunResult;
}

/**
 * 런 종료 화면에 표시할 장착 장비 이름을 한 줄로 정리한다.
 *
 * @param equippedItems 런 종료 시점의 장착 장비
 * @param language 현재 표시 언어
 * @returns 장착 장비 이름 목록 또는 빈 장비 안내 문구
 */
function getEquipmentSummary(equippedItems: EquippedItems, language: Language): string {
  const names = Object.values(equippedItems)
    .filter((item): item is NonNullable<typeof item> => item !== undefined)
    .map((item) => item.name[language]);

  return names.length > 0 ? names.join(" // ") : pickText(language, RUN_RESULT_TEXT.noEquipment);
}

/**
 * 승리 또는 패배한 런의 최종 기록과 재시작 행동을 보여준다.
 */
export default function RunResultPage({
  language,
  onRestart,
  result,
}: RunResultPageProps) {
  const won = result.outcome === "victory";
  const title = pickText(
    language,
    won ? RUN_RESULT_TEXT.victoryTitle : RUN_RESULT_TEXT.defeatTitle,
  );
  const narrative = won
    ? RUN_RESULT_TEXT.victoryNarrative[language]
    : RUN_RESULT_TEXT.defeatNarrative[language];
  const summaryLines = [
    interpolateText(pickText(language, RUN_RESULT_TEXT.clearedBattlesLine), {
      count: result.clearedBattles,
    }),
    interpolateText(pickText(language, RUN_RESULT_TEXT.levelLine), {
      experience: result.experience,
      level: result.level,
    }),
    interpolateText(pickText(language, RUN_RESULT_TEXT.equipmentLine), {
      items: getEquipmentSummary(result.equippedItems, language),
    }),
  ];

  return (
    <section className="relative z-0 flex min-h-[420px] w-full max-w-[620px] flex-col items-center justify-center px-3 py-8 text-center animate-fade-in-quick sm:px-6">
      <pre
        className={`m-0 whitespace-pre-wrap text-[0.92rem] tracking-[0.16em] sm:text-[1.08rem] ${
          won
            ? "text-ember [text-shadow:0_0_16px_rgba(255,170,0,0.42)]"
            : "text-red-200 [text-shadow:0_0_16px_rgba(220,38,38,0.34)]"
        }`}
      >
        {title}
      </pre>

      <div className="mt-6 w-full text-left">
        <PretextRitualPanel
          lines={[...narrative, ...summaryLines]}
          title={pickText(language, RUN_RESULT_TEXT.summaryTitle)}
        />
      </div>

      <button
        type="button"
        className="mt-8 rounded border border-ember/38 bg-ember/[0.06] px-5 py-3 font-crt text-[0.84rem] tracking-[0.14em] text-ember transition-[transform,border-color,background-color] hover:-translate-y-px hover:border-ember/80 hover:bg-ember/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
        onClick={onRestart}
      >
        {pickText(language, RUN_RESULT_TEXT.restartLabel)}
      </button>
    </section>
  );
}
