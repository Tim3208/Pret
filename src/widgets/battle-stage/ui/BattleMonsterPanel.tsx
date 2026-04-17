import type { CSSProperties, RefObject } from "react";

interface BattleMonsterPanelProps {
  monsterAsciiCanvasRef: RefObject<HTMLCanvasElement | null>;
  monsterAsciiPreRef: RefObject<HTMLPreElement | null>;
  monsterAsciiText: string;
  monsterDying: boolean;
  monsterHp: number;
  monsterImpactCanvasActive: boolean;
  monsterIntentOverlayRef: RefObject<HTMLCanvasElement | null>;
  monsterMaxHp: number;
  monsterOverlayRef: RefObject<HTMLCanvasElement | null>;
  monsterShield: number;
  monsterAsciiClassName: string;
  monsterAsciiStyle: CSSProperties;
  shakeMonster: boolean;
}

/**
 * 몬스터 스프라이트, 의도 오버레이, 체력 바를 함께 렌더링하는 패널이다.
 */
export default function BattleMonsterPanel({
  monsterAsciiCanvasRef,
  monsterAsciiPreRef,
  monsterAsciiText,
  monsterDying,
  monsterHp,
  monsterImpactCanvasActive,
  monsterIntentOverlayRef,
  monsterMaxHp,
  monsterOverlayRef,
  monsterShield,
  monsterAsciiClassName,
  monsterAsciiStyle,
  shakeMonster,
}: BattleMonsterPanelProps) {
  const enemyBarWidth = 10;
  const enemyHealthFill = Math.max(
    0,
    Math.min(
      enemyBarWidth,
      Math.round((monsterHp / Math.max(1, monsterMaxHp)) * enemyBarWidth),
    ),
  );
  const enemyTotalFill = Math.max(
    enemyHealthFill,
    Math.min(
      enemyBarWidth,
      Math.round(
        ((monsterHp + monsterShield) / Math.max(1, monsterMaxHp)) * enemyBarWidth,
      ),
    ),
  );
  const enemyShieldFill = Math.max(0, enemyTotalFill - enemyHealthFill);

  return (
    <div
      className={`absolute right-[12.5%] top-[2.8%] z-20 ${
        shakeMonster ? "animate-sprite-shake" : ""
      } ${monsterDying ? "animate-monster-sink" : ""}`}
    >
      <div className="relative">
        <canvas
          ref={monsterIntentOverlayRef}
          width={440}
          height={540}
          className="pointer-events-none absolute left-[calc(100%+0.45rem)] top-[2%] z-40 h-[92%] w-[150px] mix-blend-screen opacity-95 sm:w-[180px] lg:w-[220px]"
        />
        <div className="relative inline-block origin-bottom align-top animate-enemy-idle">
          <pre
            ref={monsterAsciiPreRef}
            className={monsterAsciiClassName}
            style={{
              ...monsterAsciiStyle,
              opacity: monsterImpactCanvasActive ? 0 : 1,
            }}
          >
            {monsterAsciiText}
          </pre>
          <canvas
            ref={monsterAsciiCanvasRef}
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
            style={{ opacity: monsterImpactCanvasActive ? 1 : 0 }}
          />
          <canvas
            ref={monsterOverlayRef}
            width={960}
            height={980}
            className="pointer-events-none absolute inset-[-7%] h-[114%] w-[114%] mix-blend-screen opacity-95"
          />
        </div>

        <div className="absolute left-1/2 top-[calc(100%+0.4rem)] z-30 -translate-x-1/2 font-crt text-[0.82rem] leading-[1.1] whitespace-nowrap">
          <span className="relative inline-block align-top">
            <span className="text-white/70">[</span>
            {Array.from({ length: enemyBarWidth }, (_, index) => {
              const toneClass =
                index < enemyHealthFill
                  ? "text-[rgba(224,130,118,0.9)]"
                  : index < enemyHealthFill + enemyShieldFill
                    ? "text-[rgba(118,176,255,0.92)]"
                    : "text-white/22";
              const char = index < enemyHealthFill + enemyShieldFill ? "#" : "-";
              return (
                <span key={`enemy-bar-${index}`} className={toneClass}>
                  {char}
                </span>
              );
            })}
            <span className="text-white/70">]</span>
          </span>
          <span className="ml-2 text-white/58">
            {monsterHp}/{monsterMaxHp}
          </span>
        </div>
      </div>
    </div>
  );
}
