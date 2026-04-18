import type { PlayerStats } from "@/entities/player";

interface PromptLexiconBadgeProps {
  agilityLabel: string;
  combinationLabel: string;
  decipherLabel: string;
  lexiconLabel: string;
  playerStats: PlayerStats;
  stabilityLabel: string;
  strengthLabel: string;
}

export default function PromptLexiconBadge({
  agilityLabel,
  combinationLabel,
  decipherLabel,
  lexiconLabel,
  playerStats,
  stabilityLabel,
  strengthLabel,
}: PromptLexiconBadgeProps) {
  return (
    <div className="group absolute right-[7.2%] top-[71.3%] z-30 flex flex-col items-end font-crt">
      <button
        type="button"
        aria-label={lexiconLabel}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(148,255,173,0.22)] bg-black/52 text-[0.92rem] text-[rgba(176,255,188,0.86)] shadow-[0_0_18px_rgba(68,255,150,0.08),inset_0_0_12px_rgba(0,0,0,0.42)] transition-[transform,border-color,color,box-shadow] duration-150 hover:scale-[1.04] hover:border-[rgba(148,255,173,0.42)] hover:text-[rgba(210,255,218,0.98)] focus-visible:scale-[1.04] focus-visible:border-[rgba(148,255,173,0.42)] focus-visible:text-[rgba(210,255,218,0.98)] animate-equipment-rune"
      >
        ?
      </button>
      <div className="pointer-events-none absolute right-0 top-[calc(100%+0.7rem)] w-[236px] translate-y-2 rounded-[18px] border border-[rgba(138,255,176,0.16)] bg-black/82 px-4 py-3 opacity-0 shadow-[0_0_28px_rgba(0,0,0,0.38),inset_0_0_22px_rgba(0,0,0,0.46)] transition-[opacity,transform] duration-180 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 backdrop-blur-[4px]">
        <p className="text-[0.62rem] uppercase tracking-[0.2em] text-white/36">
          {lexiconLabel}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[0.72rem]">
          <div className="rounded-[12px] border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
            <p className="text-white/38">{decipherLabel}</p>
            <p className="mt-1 text-[0.88rem] text-[rgba(222,222,222,0.92)]">{playerStats.decipher}</p>
          </div>
          <div className="rounded-[12px] border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
            <p className="text-white/38">{combinationLabel}</p>
            <p className="mt-1 text-[0.88rem] text-[rgba(144,210,255,0.92)]">{playerStats.combination}</p>
          </div>
          <div className="rounded-[12px] border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
            <p className="text-white/38">{stabilityLabel}</p>
            <p className="mt-1 text-[0.88rem] text-[rgba(255,188,132,0.94)]">{playerStats.stability}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-[0.64rem] tracking-[0.08em] text-white/44">
          <span>{strengthLabel} {playerStats.strength}</span>
          <span>{agilityLabel} {playerStats.agility}</span>
        </div>
      </div>
    </div>
  );
}
