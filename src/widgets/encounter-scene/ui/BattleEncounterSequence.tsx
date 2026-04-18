import { useEffect, useState } from "react";
import { BATTLE_ENCOUNTER_TEXT, BATTLE_SCENE_TEXT } from "@/content/text/battle/scene";
import { type Language, pickText } from "@/entities/locale";
import SkullEncounter from "./SkullEncounter";

/**
 * 전투 진입 전 시퀀스에서 사용할 단계 타입이다.
 */
export type BattleEncounterSequencePhase = "encounter" | "intro";

interface BattleEncounterSequenceProps {
  language: Language;
  phase: BattleEncounterSequencePhase;
  onEncounterComplete: () => void;
  onIntroComplete: () => void;
}

/**
 * 전투 시작 전의 조우 연출과 인트로 문구 단계를 한 묶음으로 조합한다.
 *
 * @param props 프리컴뱃 단계 정보와 단계별 완료 콜백
 */
export default function BattleEncounterSequence({
  language,
  phase,
  onEncounterComplete,
  onIntroComplete,
}: BattleEncounterSequenceProps) {
  const encounterText = pickText(language, BATTLE_ENCOUNTER_TEXT);

  if (phase === "encounter") {
    return <SkullEncounter onComplete={onEncounterComplete} />;
  }

  const sceneText = BATTLE_SCENE_TEXT[language];

  return (
    <div
      className="max-w-[500px] cursor-pointer px-6 py-8 animate-fade-in-quick"
      onClick={onIntroComplete}
    >
      <TypewriterText key={encounterText} text={encounterText} speed={30} />
      <p className="mt-6 text-center text-[0.9rem] tracking-[0.15em] text-white/40 opacity-0 [animation:fade_1s_4s_forwards]">
        {sceneText.clickToFight}
      </p>
    </div>
  );
}

/**
 * 소개 문장을 한 글자씩 출력하는 타이프라이터 텍스트 컴포넌트다.
 *
 * @param props 출력할 문장과 타이핑 속도
 */
function TypewriterText({
  text,
  speed = 30,
}: {
  text: string;
  speed?: number;
}) {
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCharCount((value) => {
        const nextValue = Math.min(value + 1, text.length);
        if (nextValue >= text.length) {
          window.clearInterval(intervalId);
        }
        return nextValue;
      });
    }, speed);

    return () => window.clearInterval(intervalId);
  }, [text, speed]);

  return (
    <p className="text-[1.05rem] leading-[1.9] text-ash sm:text-[1.15rem] [text-shadow:0_0_4px_rgba(255,255,255,0.1)]">
      {text.slice(0, charCount)}
      <span className="ml-[2px] inline-block animate-cursor-blink text-ember">
        |
      </span>
    </p>
  );
}
