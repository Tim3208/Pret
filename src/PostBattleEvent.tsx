import { type FormEvent, useState } from "react";
import { pickText, type Language } from "./language";
import {
  type EquipmentDefinition,
  type EquippedItems,
  getEquipmentSlotLabel,
} from "./battleTypes";

interface PostBattleEventProps {
  language: Language;
  offeredItem: EquipmentDefinition;
  equippedItems: EquippedItems;
  onEquip: (item: EquipmentDefinition) => void;
  onDecline: () => void;
}

type EventStage = "approach" | "offer";

const INVESTIGATE_KEYWORDS = [
  "investigate",
  "inspect",
  "approach",
  "continue",
  "yes",
  "y",
  "look",
  "살핀다",
  "조사",
  "다가간다",
  "예",
  "응",
  "진행",
] as const;

const LEAVE_KEYWORDS = [
  "leave",
  "pass",
  "skip",
  "no",
  "n",
  "walk away",
  "떠난다",
  "지나친다",
  "거절",
  "아니오",
  "아니",
  "넘긴다",
] as const;

const TAKE_KEYWORDS = [
  "take",
  "keep",
  "equip",
  "bind",
  "yes",
  "y",
  "가져간다",
  "줍는다",
  "장착",
  "결속",
  "예",
  "응",
] as const;

const EVENT_TEXT = {
  approachLead: {
    en: "At the cliff's lip, just beyond the bonfire path, something catches in the cinders and shale.",
    ko: "모닥불로 돌아가는 길목의 절벽 끝, 재와 혈암 사이에서 무언가 희미하게 걸린다.",
  },
  approachDetail: {
    en: "It looks like a half-buried helm, faintly warm, as though it has been waiting for the next survivor to notice it.",
    ko: "반쯤 묻힌 투구처럼 보인다. 방금까지 누군가 기다리고 있던 것처럼 희미한 온기가 남아 있다.",
  },
  approachQuestion: {
    en: "Will you draw closer?",
    ko: "가까이 다가가겠는가?",
  },
  offerLead: {
    en: "You brush the ash aside. A dark half-dome helm rises from the embers, catching the firelight along its curve.",
    ko: "재를 걷어내자 어두운 반구형 투구가 불씨 사이에서 모습을 드러낸다. 둥근 곡면을 따라 불빛이 번진다.",
  },
  offerQuestion: {
    en: "Will you take it with you?",
    ko: "이것을 가져가겠는가?",
  },
  offerReplaceQuestion: {
    en: "It will replace what already rests on that part of you. Will you take it anyway?",
    ko: "이미 그 자리에 있는 것을 밀어내게 된다. 그래도 가져가겠는가?",
  },
  currentSlotLabel: {
    en: "Currently worn",
    ko: "현재 장착 중",
  },
  itemHoverLabel: {
    en: "hover the helm to read its effect",
    ko: "효과를 보려면 투구에 마우스를 올린다",
  },
  inactiveLabel: {
    en: "Tooltip only for now. Combat values stay unchanged in this build.",
    ko: "지금은 툴팁 전용이다. 이 빌드에서는 전투 수치가 바뀌지 않는다.",
  },
  invalidApproach: {
    en: "The ash waits for a clearer answer.",
    ko: "재가 더 또렷한 대답을 기다린다.",
  },
  invalidOffer: {
    en: "The helm keeps watching. Take it or leave it.",
    ko: "투구는 여전히 당신을 바라본다. 가져가거나 남겨 두어라.",
  },
  approachPlaceholder: {
    en: "(investigate / leave)",
    ko: "(살핀다 / 떠난다)",
  },
  offerPlaceholder: {
    en: "(take / leave)",
    ko: "(가져간다 / 남긴다)",
  },
  effectLabel: {
    en: "effect:",
    ko: "효과:",
  },
} as const;

function matchesKeyword(input: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => input === keyword || input.includes(keyword));
}

export default function PostBattleEvent({
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
          stage === "approach" ? EVENT_TEXT.invalidApproach : EVENT_TEXT.invalidOffer,
        ),
      );
      return;
    }

    if (stage === "approach") {
      if (matchesKeyword(answer, INVESTIGATE_KEYWORDS)) {
        setStage("offer");
        setInput("");
        setFeedback("");
        return;
      }

      if (matchesKeyword(answer, LEAVE_KEYWORDS)) {
        onDecline();
        return;
      }

      setFeedback(pickText(language, EVENT_TEXT.invalidApproach));
      return;
    }

    if (matchesKeyword(answer, TAKE_KEYWORDS)) {
      onEquip(offeredItem);
      return;
    }

    if (matchesKeyword(answer, LEAVE_KEYWORDS)) {
      onDecline();
      return;
    }

    setFeedback(pickText(language, EVENT_TEXT.invalidOffer));
  };

  return (
    <div className="relative z-0 max-w-[600px] text-[1.05rem] leading-[1.8] sm:text-[1.2rem] [text-shadow:0_0_5px_rgba(255,255,255,0.2)]">
      {stage === "approach" && (
        <>
          <p>{pickText(language, EVENT_TEXT.approachLead)}</p>
          <p className="mt-3">{pickText(language, EVENT_TEXT.approachDetail)}</p>
          <p className="mt-5 text-ember/90">{pickText(language, EVENT_TEXT.approachQuestion)}</p>
        </>
      )}

      {stage === "offer" && (
        <>
          <p>{pickText(language, EVENT_TEXT.offerLead)}</p>
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
                    {pickText(language, EVENT_TEXT.effectLabel)} {offeredItem.effectText[language]}
                  </span>
                  <span className="mt-1 block text-white/36">
                    {pickText(language, EVENT_TEXT.inactiveLabel)}
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
              {pickText(language, EVENT_TEXT.itemHoverLabel)}
            </p>
            {replaceMode && currentItemInSlot && (
              <p className="mt-4 text-center text-[0.82rem] text-white/44">
                {pickText(language, EVENT_TEXT.currentSlotLabel)}: {currentItemInSlot.name[language]}
              </p>
            )}
          </div>

          <p className="mt-8 text-ember/90">
            {pickText(
              language,
              replaceMode ? EVENT_TEXT.offerReplaceQuestion : EVENT_TEXT.offerQuestion,
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
              ? EVENT_TEXT.approachPlaceholder
              : EVENT_TEXT.offerPlaceholder,
          )}
          autoFocus
          className="w-[220px] border-0 border-b border-white/30 bg-transparent text-[1.05rem] text-ember outline-none placeholder:text-white/35 focus:border-ember sm:w-[260px] sm:text-[1.2rem]"
        />
      </form>
    </div>
  );
}
