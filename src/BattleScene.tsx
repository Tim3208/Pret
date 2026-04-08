import { useCallback, useEffect, useState } from "react";
import BattleCombat from "./BattleCombat";
import HeartHP from "./HeartHP";
import SkullEncounter from "./SkullEncounter";
import { type BattleCopy } from "./i18n";
import { useImageToAscii } from "./useImageToAscii";

/**
 * 전투 씬 내부의 단계 상태를 정의한다.
 */
type BattlePhase = "encounter" | "intro" | "combat";

/**
 * 전투 씬의 단계 전환과 HP 상태를 관리하는 컴포넌트다.
 */
export default function BattleScene({ copy }: { copy: BattleCopy }) {
  /**
   * 플레이어 스프라이트를 ASCII로 변환한 결과와 로딩 상태다.
   */
  const { lines: playerAscii, loading: playerLoading } = useImageToAscii(
    "/assets/hero.png",
    55,
    { flip: true, brightnessThreshold: 40 },
  );
  /**
   * 몬스터 스프라이트를 ASCII로 변환한 결과와 로딩 상태다.
   */
  const { lines: monsterAscii, loading: monsterLoading } = useImageToAscii(
    "/assets/enemy.png",
    55,
    { flip: true, brightnessThreshold: 40 },
  );

  /**
   * 현재 전투 장면의 단계를 저장한다.
   */
  const [phase, setPhase] = useState<BattlePhase>("encounter");
  /**
   * 플레이어 현재 HP를 저장한다.
   */
  const [playerHp, setPlayerHp] = useState(24);
  /**
   * 몬스터 현재 HP를 저장한다.
   */
  const [, setMonsterHp] = useState(30);
  /**
   * 현재 행동 주체가 누구인지 저장한다.
   */
  const [turn, setTurn] = useState<"player" | "monster">("player");
  /**
   * 플레이어 최대 HP다.
   */
  const maxHp = 24;

  /**
   * 조우 애니메이션 종료 후 소개 단계로 이동한다.
   */
  const handleEncounterDone = useCallback(() => {
    setPhase("intro");
  }, []);

  /**
   * 소개 문구를 닫고 전투 단계로 이동한다.
   */
  const handleIntroDone = useCallback(() => {
    setPhase("combat");
  }, []);

  /**
   * 플레이어가 피해를 입었을 때 HP를 감소시킨다.
   *
   * @param damage 적용할 피해량
   */
  const handlePlayerHit = useCallback((damage: number) => {
    setPlayerHp((value) => Math.max(0, value - damage));
  }, []);

  /**
   * 몬스터가 피해를 입었을 때 HP를 감소시킨다.
   *
   * @param damage 적용할 피해량
   */
  const handleMonsterHit = useCallback((damage: number) => {
    setMonsterHp((value) => Math.max(0, value - damage));
  }, []);

  /**
   * 플레이어 턴과 몬스터 턴을 번갈아 전환한다.
   */
  const handleTurnEnd = useCallback(() => {
    setTurn((value) => (value === "player" ? "monster" : "player"));
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6">
      <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
        <HeartHP current={playerHp} max={maxHp} />
      </div>

      <div className="flex w-full flex-1 items-center justify-center">
        {phase === "encounter" && (
          <SkullEncounter onComplete={handleEncounterDone} />
        )}

        {phase === "intro" && (
          <div
            className="max-w-[500px] cursor-pointer px-6 py-8 animate-fade-in-quick"
            onClick={handleIntroDone}
          >
            <TypewriterText key={copy.encounterText} text={copy.encounterText} speed={30} />
            <p className="mt-6 text-center text-[0.9rem] tracking-[0.15em] text-white/40 opacity-0 [animation:fade_1s_4s_forwards]">
              {copy.introHint}
            </p>
          </div>
        )}

        {phase === "combat" && !playerLoading && !monsterLoading && (
          <BattleCombat
            monsterAscii={monsterAscii}
            playerAscii={playerAscii}
            narratives={copy.narratives}
            monsterAttackWords={copy.monsterAttackWords}
            onPlayerHit={handlePlayerHit}
            onMonsterHit={handleMonsterHit}
            turn={turn}
            onTurnEnd={handleTurnEnd}
            attackPlaceholderFallback={copy.attackPlaceholderFallback}
            retaliatesText={copy.retaliates(copy.monsterName)}
          />
        )}

        {phase === "combat" && (playerLoading || monsterLoading) && (
          <p className="px-6 text-[1.15rem] leading-[1.9] text-ash [text-shadow:0_0_4px_rgba(255,255,255,0.1)]">
            {copy.loadingCombatants}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 텍스트를 한 글자씩 출력하는 간단한 타이프라이터 컴포넌트다.
 *
 * @param props 출력할 텍스트와 속도
 */
function TypewriterText({
  text,
  speed = 30,
}: {
  text: string;
  speed?: number;
}) {
  /**
   * 현재 화면에 노출할 문자 수를 저장한다.
   */
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
