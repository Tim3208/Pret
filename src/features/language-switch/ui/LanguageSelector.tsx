import { LOCALE_OPTIONS, type Language } from "@/entities/locale";

interface LanguageSelectorProps {
  currentLocale: Language;
  label: string;
  onChange: (locale: Language) => void;
}

/**
 * 화면 어디서든 언어를 전환할 수 있는 버튼 그룹이다.
 *
 * @param props 현재 언어와 변경 핸들러
 */
export default function LanguageSelector({
  currentLocale,
  label,
  onChange,
}: LanguageSelectorProps) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex items-center gap-1 rounded-full border border-white/10 bg-black/55 p-1 shadow-[0_0_24px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <span className="px-2 text-[0.65rem] tracking-[0.18em] text-white/35">
        {label}
      </span>
      {LOCALE_OPTIONS.map((option) => {
        const isActive = option.code === currentLocale;

        return (
          <button
            key={option.code}
            type="button"
            onClick={() => onChange(option.code)}
            className={`rounded-full px-3 py-1.5 text-[0.75rem] font-semibold tracking-[0.08em] transition-colors ${
              isActive
                ? "bg-ember text-void"
                : "text-white/60 hover:text-white"
            }`}
            aria-pressed={isActive}
            title={option.label}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
