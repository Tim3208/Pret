import { type FormEvent, useState } from "react";
import {
  type EquipmentDefinition,
  type EquippedItems,
  getEquipmentSlotLabel,
} from "@/entities/equipment";
import {
  POST_BATTLE_EVENT_TEXT,
  POST_BATTLE_INVESTIGATE_KEYWORDS,
  POST_BATTLE_LEAVE_KEYWORDS,
  POST_BATTLE_TAKE_KEYWORDS,
} from "@/content/text/event/postBattle";
import { pickText, type Language } from "@/entities/locale";

interface PostBattleEventProps {
  language: Language;
  offeredItem: EquipmentDefinition;
  equippedItems: EquippedItems;
  onEquip: (item: EquipmentDefinition) => void;
  onDecline: () => void;
}

type EventStage = "approach" | "offer";

function matchesKeyword(input: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => input === keyword || input.includes(keyword));
}

export default function PostBattleEventPage({
  language,
  offeredItem,
  equippedItems,
  onEquip,
  onDecline,
}: PostBattleEventProps) {
  const [stage, setStage] = useState<EventStage>("approach");
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [itemHovered, setItemHovered] = useState(false);

  const currentItemInSlot = equippedItems[offeredItem.slot];
  const slotLabel = getEquipmentSlotLabel(offeredItem.slot, language);
  const replaceMode = Boolean(
    currentItemInSlot && currentItemInSlot.id !== offeredItem.id,
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
        onDecline();
        return;
      }

      setFeedback(pickText(language, POST_BATTLE_EVENT_TEXT.invalidApproach));
      return;
    }

    if (matchesKeyword(answer, POST_BATTLE_TAKE_KEYWORDS)) {
      onEquip(offeredItem);
      return;
    }

    if (matchesKeyword(answer, POST_BATTLE_LEAVE_KEYWORDS)) {
      onDecline();
      return;
    }

    setFeedback(pickText(language, POST_BATTLE_EVENT_TEXT.invalidOffer));
  };

  return (
    <div className="relative z-0 max-w-[600px] text-[1.05rem] leading-[1.8] sm:text-[1.2rem] [text-shadow:0_0_5px_rgba(255,255,255,0.2)]">
      {stage === "approach" && (
        <>
          <p>{pickText(language, POST_BATTLE_EVENT_TEXT.approachLead)}</p>
          <p className="mt-3">{pickText(language, POST_BATTLE_EVENT_TEXT.approachDetail)}</p>
          <p className="mt-5 text-ember/90">{pickText(language, POST_BATTLE_EVENT_TEXT.approachQuestion)}</p>
        </>
      )}

      {stage === "offer" && (
        <>
          <p>{pickText(language, POST_BATTLE_EVENT_TEXT.offerLead)}</p>
          <div className="relative mt-10 flex flex-col items-center">
            <div className="relative inline-flex items-center justify-center px-10 py-6">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-torch-glow"
                style={{
                  background:
                    `radial-gradient(circle, ${offeredItem.fragmentTone.replace("0.96", "0.28")} 0%, ${offeredItem.fragmentTone.replace("0.96", "0.12")} 34%, ${offeredItem.fragmentTone.replace("0.96", "0.03")} 62%, rgba(255,181,110,0) 100%)`,
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
                aria-label={`${offeredItem.name[language]} ${slotLabel}`}
              >
                <pre
                  className="m-0 whitespace-pre text-center font-crt text-[8.5px] leading-[8px] select-none sm:text-[10px] sm:leading-[9.6px]"
                  style={{
                    color: offeredItem.fragmentTone,
                    textShadow: `0 0 10px ${offeredItem.fragmentTone}, 0 0 22px rgba(255,181,110,0.18), 0 0 2px rgba(255,255,255,0.12)`,
                  }}
                >
                  {offeredItem.offerAscii.join("\n")}
                </pre>
                <span
                  className={`pointer-events-none absolute left-1/2 top-[calc(100%+0.75rem)] min-w-[220px] max-w-[280px] -translate-x-1/2 rounded-[14px] border border-white/12 bg-black/84 px-3 py-2 text-left font-crt text-[0.7rem] leading-[1.5] transition-opacity duration-150 ${
                    itemHovered ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="block text-[0.64rem] uppercase tracking-[0.18em] text-white/42">
                    {offeredItem.name[language]}
                  </span>
                  <span className="mt-1 block text-white/72">
                    {pickText(language, POST_BATTLE_EVENT_TEXT.effectLabel)} {offeredItem.effectText[language]}
                  </span>
                  <span className="mt-1 block text-white/36">
                    {pickText(language, POST_BATTLE_EVENT_TEXT.inactiveLabel)}
                  </span>
                </span>
              </button>
            </div>

            <p className="mt-2 text-center text-[0.82rem] uppercase tracking-[0.2em] text-white/42">
              {slotLabel} · {offeredItem.name[language]}
            </p>
            <p className="mt-3 max-w-[30rem] text-center text-[0.94rem] leading-[1.8] text-white/72 sm:text-[1rem]">
              {offeredItem.flavorText[language]}
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

          <p className="mt-8 text-ember/90">
            {pickText(
              language,
              replaceMode
                ? POST_BATTLE_EVENT_TEXT.offerReplaceQuestion
                : POST_BATTLE_EVENT_TEXT.offerQuestion,
            )}
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
          placeholder={pickText(
            language,
            stage === "approach"
              ? POST_BATTLE_EVENT_TEXT.approachPlaceholder
              : POST_BATTLE_EVENT_TEXT.offerPlaceholder,
          )}
          autoFocus
          className="w-[220px] border-0 border-b border-white/30 bg-transparent text-[1.05rem] text-ember outline-none placeholder:text-white/35 focus:border-ember sm:w-[260px] sm:text-[1.2rem]"
        />
      </form>
    </div>
  );
}
