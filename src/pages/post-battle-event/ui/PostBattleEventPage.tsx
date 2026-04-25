import { type FormEvent, useMemo, useState } from "react";
import {
  type EquippedItems,
  getEquipmentSlotLabel,
} from "@/entities/equipment";
import { interpolateText, pickText, type Language } from "@/entities/locale";
import type { RunEvent, RunEventResolution } from "@/entities/run";
import {
  POST_BATTLE_ACCEPT_KEYWORDS,
  POST_BATTLE_EVENT_TEXT,
  POST_BATTLE_EXPERIENCE_KEYWORDS,
  POST_BATTLE_INVESTIGATE_KEYWORDS,
  POST_BATTLE_LEAVE_KEYWORDS,
  POST_BATTLE_POTION_KEYWORDS,
  POST_BATTLE_TAKE_KEYWORDS,
} from "@/content/text/event/postBattle";

interface PostBattleEventProps {
  language: Language;
  equippedItems: EquippedItems;
  onResolve: (resolution: RunEventResolution) => void;
  runEvent: RunEvent;
}

type EventStage = "approach" | "offer";

interface EventCopy {
  approachDetail: string;
  approachLead: string;
  helperLabel?: string;
  offerLead: string;
  offerQuestion: string;
  previewAscii?: string[];
  previewDetail?: string;
  previewLabel?: string;
  previewTone?: string;
}

const POTION_ASCII = [
  "      __      ",
  "    .'  '.    ",
  "   / .--. \\   ",
  "   | |##| |   ",
  "   | |##| |   ",
  "   | '##' |   ",
  "    \\____/    ",
] as const;

const EXPERIENCE_ASCII = [
  "    .-^^-.    ",
  "  .'  ..  '.  ",
  " /  .::::.  \\",
  " |  ::::::  | ",
  " \\  '::'  /  ",
  "  '.__.__.'   ",
] as const;

const CHOICE_ASCII = [
  "   .--.  .--.   ",
  "  /##/\\/\\##\\  ",
  " |##| /\\ |##| ",
  "  \\##\\\\//##/  ",
  "   '--'  '--'   ",
] as const;

const SCAR_ASCII = [
  "    .-''-.    ",
  "  .'  /\\  '.  ",
  " /___/##\\___\\ ",
  " \\   \\/   // ",
  "  '._/\\_.'   ",
] as const;

const AMBUSH_ASCII = [
  "    __..__    ",
  " .-' .##. '-. ",
  "(   /####\\   )",
  " '. \\####// .' ",
  "   '-.__.-'   ",
] as const;

function matchesKeyword(input: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => input === keyword || input.includes(keyword));
}

/**
 * RGBA 문자열의 알파만 바꿔 이벤트 광원에 다시 사용한다.
 */
function withAlpha(color: string, alpha: number): string {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return color;
  }

  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}

/**
 * 현재 이벤트 종류에 맞는 문구와 미리보기 데이터를 만든다.
 */
function getEventCopy(runEvent: RunEvent, language: Language): EventCopy {
  switch (runEvent.kind) {
    case "equipment":
      return {
        approachDetail: pickText(language, POST_BATTLE_EVENT_TEXT.equipmentApproachDetail),
        approachLead: pickText(language, POST_BATTLE_EVENT_TEXT.equipmentApproachLead),
        offerLead: pickText(language, POST_BATTLE_EVENT_TEXT.equipmentOfferLead),
        offerQuestion: pickText(language, POST_BATTLE_EVENT_TEXT.equipmentOfferQuestion),
      };
    case "potion":
      return {
        approachDetail: pickText(language, POST_BATTLE_EVENT_TEXT.potionApproachDetail),
        approachLead: pickText(language, POST_BATTLE_EVENT_TEXT.potionApproachLead),
        offerLead: pickText(language, POST_BATTLE_EVENT_TEXT.potionOfferLead),
        offerQuestion: pickText(language, POST_BATTLE_EVENT_TEXT.potionOfferQuestion),
        previewAscii: [...POTION_ASCII],
        previewDetail: interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.potionGainLine),
          { potions: runEvent.potionCharges },
        ),
        previewLabel: pickText(language, POST_BATTLE_EVENT_TEXT.choicePotionLabel),
        previewTone: "rgba(214, 120, 120, 0.88)",
      };
    case "experience":
      return {
        approachDetail: pickText(language, POST_BATTLE_EVENT_TEXT.experienceApproachDetail),
        approachLead: pickText(language, POST_BATTLE_EVENT_TEXT.experienceApproachLead),
        offerLead: pickText(language, POST_BATTLE_EVENT_TEXT.experienceOfferLead),
        offerQuestion: interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.experienceOfferQuestion),
          { experience: runEvent.experience },
        ),
        previewAscii: [...EXPERIENCE_ASCII],
        previewDetail: interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.experienceGainLine),
          { experience: runEvent.experience },
        ),
        previewLabel: pickText(language, POST_BATTLE_EVENT_TEXT.choiceExperienceLabel),
        previewTone: "rgba(217, 186, 120, 0.84)",
      };
    case "choice":
      return {
        approachDetail: pickText(language, POST_BATTLE_EVENT_TEXT.choiceApproachDetail),
        approachLead: pickText(language, POST_BATTLE_EVENT_TEXT.choiceApproachLead),
        helperLabel: `${pickText(language, POST_BATTLE_EVENT_TEXT.choiceExperienceLabel)} / ${pickText(language, POST_BATTLE_EVENT_TEXT.choicePotionLabel)}`,
        offerLead: pickText(language, POST_BATTLE_EVENT_TEXT.choiceOfferLead),
        offerQuestion: interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.choiceOfferQuestion),
          { experience: runEvent.experience, potions: runEvent.potionCharges },
        ),
        previewAscii: [...CHOICE_ASCII],
        previewDetail: `${interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.choiceExperienceGainLine),
          { experience: runEvent.experience },
        )}\n${interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.choicePotionGainLine),
          { potions: runEvent.potionCharges },
        )}`,
        previewLabel: pickText(language, POST_BATTLE_EVENT_TEXT.approachQuestion),
        previewTone: "rgba(190, 176, 138, 0.84)",
      };
    case "scar":
      return {
        approachDetail: pickText(language, POST_BATTLE_EVENT_TEXT.scarApproachDetail),
        approachLead: pickText(language, POST_BATTLE_EVENT_TEXT.scarApproachLead),
        helperLabel: pickText(language, POST_BATTLE_EVENT_TEXT.riskHelperLabel),
        offerLead: pickText(language, POST_BATTLE_EVENT_TEXT.scarOfferLead),
        offerQuestion: interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.scarOfferQuestion),
          { experience: runEvent.experience, maxHpPenalty: runEvent.maxHpPenalty },
        ),
        previewAscii: [...SCAR_ASCII],
        previewDetail: interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.scarGainLine),
          { experience: runEvent.experience, maxHpPenalty: runEvent.maxHpPenalty },
        ),
        previewLabel: pickText(language, POST_BATTLE_EVENT_TEXT.riskHelperLabel),
        previewTone: "rgba(244, 98, 80, 0.88)",
      };
    case "ambush":
      return {
        approachDetail: pickText(language, POST_BATTLE_EVENT_TEXT.ambushApproachDetail),
        approachLead: pickText(language, POST_BATTLE_EVENT_TEXT.ambushApproachLead),
        helperLabel: pickText(language, POST_BATTLE_EVENT_TEXT.riskHelperLabel),
        offerLead: pickText(language, POST_BATTLE_EVENT_TEXT.ambushOfferLead),
        offerQuestion: interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.ambushOfferQuestion),
          { damage: runEvent.damage },
        ),
        previewAscii: [...AMBUSH_ASCII],
        previewDetail: interpolateText(
          pickText(language, POST_BATTLE_EVENT_TEXT.ambushGainLine),
          { damage: runEvent.damage, potions: runEvent.potionCharges },
        ),
        previewLabel: pickText(language, POST_BATTLE_EVENT_TEXT.choicePotionLabel),
        previewTone: "rgba(196, 126, 126, 0.88)",
      };
  }
}

export default function PostBattleEventPage({
  language,
  equippedItems,
  onResolve,
  runEvent,
}: PostBattleEventProps) {
  const [stage, setStage] = useState<EventStage>("approach");
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [itemHovered, setItemHovered] = useState(false);
  const copy = useMemo(() => getEventCopy(runEvent, language), [language, runEvent]);

  const currentItemInSlot = runEvent.kind === "equipment"
    ? equippedItems[runEvent.item.slot]
    : undefined;
  const slotLabel = runEvent.kind === "equipment"
    ? getEquipmentSlotLabel(runEvent.item.slot, language)
    : "";
  const replaceMode = Boolean(
    runEvent.kind === "equipment"
      && currentItemInSlot
      && currentItemInSlot.id !== runEvent.item.id,
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const answer = input.trim().toLowerCase();

    if (!answer) {
      setFeedback(
        pickText(
          language,
          stage === "approach"
            ? POST_BATTLE_EVENT_TEXT.invalidApproach
            : POST_BATTLE_EVENT_TEXT.invalidOffer,
        ),
      );
      return;
    }

    if (stage === "approach") {
      if (matchesKeyword(answer, POST_BATTLE_INVESTIGATE_KEYWORDS)) {
        setStage("offer");
        setInput("");
        setFeedback("");
        return;
      }

      if (matchesKeyword(answer, POST_BATTLE_LEAVE_KEYWORDS)) {
        onResolve({ kind: "decline" });
        return;
      }

      setFeedback(pickText(language, POST_BATTLE_EVENT_TEXT.invalidApproach));
      return;
    }

    if (matchesKeyword(answer, POST_BATTLE_LEAVE_KEYWORDS)) {
      onResolve({ kind: "decline" });
      return;
    }

    if (runEvent.kind === "choice") {
      if (matchesKeyword(answer, POST_BATTLE_EXPERIENCE_KEYWORDS)) {
        onResolve({ kind: "choice-experience", experience: runEvent.experience });
        return;
      }

      if (matchesKeyword(answer, POST_BATTLE_POTION_KEYWORDS)) {
        onResolve({ kind: "choice-potion", potionCharges: runEvent.potionCharges });
        return;
      }

      setFeedback(pickText(language, POST_BATTLE_EVENT_TEXT.invalidOffer));
      return;
    }

    if (runEvent.kind === "scar") {
      if (matchesKeyword(answer, POST_BATTLE_ACCEPT_KEYWORDS)) {
        onResolve({
          kind: "scar",
          experience: runEvent.experience,
          maxHpPenalty: runEvent.maxHpPenalty,
        });
        return;
      }

      setFeedback(pickText(language, POST_BATTLE_EVENT_TEXT.invalidOffer));
      return;
    }

    if (runEvent.kind === "ambush") {
      if (matchesKeyword(answer, POST_BATTLE_ACCEPT_KEYWORDS)) {
        onResolve({
          kind: "ambush",
          damage: runEvent.damage,
          potionCharges: runEvent.potionCharges,
        });
        return;
      }

      setFeedback(pickText(language, POST_BATTLE_EVENT_TEXT.invalidOffer));
      return;
    }

    if (!matchesKeyword(answer, POST_BATTLE_TAKE_KEYWORDS)) {
      setFeedback(pickText(language, POST_BATTLE_EVENT_TEXT.invalidOffer));
      return;
    }

    switch (runEvent.kind) {
      case "equipment":
        onResolve({ kind: "equipment", item: runEvent.item });
        return;
      case "experience":
        onResolve({ kind: "experience", experience: runEvent.experience });
        return;
      case "potion":
        onResolve({ kind: "potion", potionCharges: runEvent.potionCharges });
        return;
      default:
        break;
    }

    setFeedback(pickText(language, POST_BATTLE_EVENT_TEXT.invalidOffer));
  };

  const offerPlaceholder = stage === "approach"
    ? pickText(language, POST_BATTLE_EVENT_TEXT.approachPlaceholder)
    : runEvent.kind === "choice"
      ? pickText(language, POST_BATTLE_EVENT_TEXT.choicePlaceholder)
      : runEvent.kind === "scar" || runEvent.kind === "ambush"
        ? pickText(language, POST_BATTLE_EVENT_TEXT.acceptPlaceholder)
        : pickText(language, POST_BATTLE_EVENT_TEXT.offerPlaceholder);

  return (
    <div className="relative z-0 max-w-[600px] text-[1.05rem] leading-[1.8] sm:text-[1.2rem] [text-shadow:0_0_5px_rgba(255,255,255,0.2)]">
      {stage === "approach" && (
        <>
          <p>{copy.approachLead}</p>
          <p className="mt-3">{copy.approachDetail}</p>
          <p className="mt-5 text-ember/90">{pickText(language, POST_BATTLE_EVENT_TEXT.approachQuestion)}</p>
        </>
      )}

      {stage === "offer" && (
        <>
          <p>{copy.offerLead}</p>

          {runEvent.kind === "equipment" ? (
            <div className="relative mt-10 flex flex-col items-center">
              <div className="relative inline-flex items-center justify-center px-10 py-6">
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-torch-glow"
                  style={{
                    background:
                      `radial-gradient(circle, ${withAlpha(runEvent.item.fragmentTone, 0.22)} 0%, ${withAlpha(runEvent.item.fragmentTone, 0.1)} 34%, ${withAlpha(runEvent.item.fragmentTone, 0.03)} 62%, rgba(255,181,110,0) 100%)`,
                  }}
                />
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 28%, rgba(255,255,255,0) 72%)",
                  }}
                />
                <button
                  type="button"
                  className="relative z-[1] cursor-help border-0 bg-transparent p-0"
                  onMouseEnter={() => setItemHovered(true)}
                  onMouseLeave={() => setItemHovered(false)}
                  onFocus={() => setItemHovered(true)}
                  onBlur={() => setItemHovered(false)}
                  aria-label={`${runEvent.item.name[language]} ${slotLabel}`}
                >
                  <pre
                    className="m-0 whitespace-pre text-center font-crt text-[8.5px] leading-[8px] select-none sm:text-[10px] sm:leading-[9.6px]"
                    style={{
                      color: runEvent.item.fragmentTone,
                      textShadow: `0 0 10px ${withAlpha(runEvent.item.fragmentTone, 0.78)}, 0 0 22px rgba(255,181,110,0.18), 0 0 2px rgba(255,255,255,0.12)`,
                    }}
                  >
                    {runEvent.item.offerAscii.join("\n")}
                  </pre>
                  <span
                    className={`pointer-events-none absolute left-1/2 top-[calc(100%+0.75rem)] min-w-[220px] max-w-[280px] -translate-x-1/2 rounded-[14px] border border-white/12 bg-black/84 px-3 py-2 text-left font-crt text-[0.7rem] leading-[1.5] transition-opacity duration-150 ${
                      itemHovered ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <span className="block text-[0.64rem] uppercase tracking-[0.18em] text-white/42">
                      {runEvent.item.name[language]}
                    </span>
                    <span className="mt-1 block text-white/72">
                      {pickText(language, POST_BATTLE_EVENT_TEXT.effectLabel)} {runEvent.item.effectText[language]}
                    </span>
                    <span className="mt-1 block text-white/36">
                      {pickText(language, POST_BATTLE_EVENT_TEXT.inactiveLabel)}
                    </span>
                  </span>
                </button>
              </div>

              <p className="mt-2 text-center text-[0.82rem] uppercase tracking-[0.2em] text-white/42">
                {slotLabel} · {runEvent.item.name[language]}
              </p>
              <p className="mt-3 max-w-[30rem] text-center text-[0.94rem] leading-[1.8] text-white/72 sm:text-[1rem]">
                {runEvent.item.flavorText[language]}
              </p>
              <p className="mt-2 text-center text-[0.74rem] uppercase tracking-[0.16em] text-white/34">
                {pickText(language, POST_BATTLE_EVENT_TEXT.itemHoverLabel)}
              </p>
              {replaceMode && currentItemInSlot && (
                <p className="mt-4 text-center text-[0.82rem] text-white/44">
                  {pickText(language, POST_BATTLE_EVENT_TEXT.currentSlotLabel)}: {currentItemInSlot.name[language]}
                </p>
              )}
            </div>
          ) : (
            <div className="relative mt-10 flex flex-col items-center">
              <div className="relative inline-flex items-center justify-center px-10 py-6">
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-torch-glow"
                  style={{
                    background:
                      `radial-gradient(circle, ${withAlpha(copy.previewTone ?? "rgba(214,204,188,0.82)", 0.24)} 0%, ${withAlpha(copy.previewTone ?? "rgba(214,204,188,0.82)", 0.08)} 34%, ${withAlpha(copy.previewTone ?? "rgba(214,204,188,0.82)", 0.02)} 62%, rgba(255,181,110,0) 100%)`,
                  }}
                />
                <pre
                  className="relative z-[1] m-0 whitespace-pre text-center font-crt text-[10px] leading-[9.6px] select-none sm:text-[11px] sm:leading-[10.4px]"
                  style={{
                    color: copy.previewTone,
                    textShadow: `0 0 10px ${withAlpha(copy.previewTone ?? "rgba(214,204,188,0.82)", 0.72)}, 0 0 18px rgba(255,181,110,0.12)`,
                  }}
                >
                  {copy.previewAscii?.join("\n")}
                </pre>
              </div>

              {copy.previewLabel && (
                <p className="mt-2 text-center text-[0.82rem] uppercase tracking-[0.2em] text-white/42">
                  {copy.previewLabel}
                </p>
              )}
              {copy.previewDetail && (
                <p className="mt-3 max-w-[30rem] whitespace-pre-line text-center text-[0.94rem] leading-[1.8] text-white/72 sm:text-[1rem]">
                  {copy.previewDetail}
                </p>
              )}
              {copy.helperLabel && (
                <p className="mt-2 text-center text-[0.74rem] uppercase tracking-[0.16em] text-white/34">
                  {copy.helperLabel}
                </p>
              )}
            </div>
          )}

          <p className="mt-8 text-ember/90">
            {runEvent.kind === "equipment"
              ? pickText(
                language,
                replaceMode
                  ? POST_BATTLE_EVENT_TEXT.equipmentOfferReplaceQuestion
                  : POST_BATTLE_EVENT_TEXT.equipmentOfferQuestion,
              )
              : copy.offerQuestion}
          </p>
        </>
      )}

      {feedback && (
        <p className="mt-6 text-[0.86rem] text-white/44 sm:text-[0.92rem]">{feedback}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
        <span className="font-bold text-ember">{">"}</span>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={offerPlaceholder}
          autoFocus
          className="w-[220px] border-0 border-b border-white/30 bg-transparent text-[1.05rem] text-ember outline-none placeholder:text-white/35 focus:border-ember sm:w-[260px] sm:text-[1.2rem]"
        />
      </form>
    </div>
  );
}
