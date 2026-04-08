import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import CrtOverlay from "./CrtOverlay";

/**
 * 화면을 가로지르는 투사체의 렌더링 상태를 정의한다.
 */
interface Projectile {
  chars: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  fromPlayer: boolean;
  offsets: { dx: number; dy: number; rot: number }[];
}

/**
 * 전투 캔버스 컴포넌트가 받는 속성 목록이다.
 */
interface BattleCombatProps {
  monsterAscii: string[];
  playerAscii: string[];
  narratives: string[];
  attackPlaceholderFallback: string;
  monsterAttackWords: string[];
  onPlayerHit: (damage: number) => void;
  onMonsterHit: (damage: number) => void;
  retaliatesText: string;
  turn: "player" | "monster";
  onTurnEnd: () => void;
}

/**
 * 전투 내레이션을 렌더링할 때 사용할 캔버스 폰트다.
 */
const FONT = "500 15px 'Courier New', Courier, monospace";
/**
 * 한 줄의 텍스트가 차지하는 세로 간격이다.
 */
const LINE_HEIGHT = 24;
/**
 * Pretext 줄바꿈 계산에 사용할 최대 텍스트 폭이다.
 */
const TEXT_WIDTH = 380;

/**
 * 전투 텍스트, 입력, 투사체, CRT 효과를 모두 담당하는 컴포넌트다.
 *
 * @param props 전투 상태와 이벤트 핸들러 모음
 */
export default function BattleCombat({
  monsterAscii,
  playerAscii,
  narratives,
  attackPlaceholderFallback,
  monsterAttackWords,
  onPlayerHit,
  onMonsterHit,
  retaliatesText,
  turn,
  onTurnEnd,
}: BattleCombatProps) {
  /**
   * 현재 출력 중인 내레이션 인덱스다.
   */
  const [narrativeIndex, setNarrativeIndex] = useState(0);
  /**
   * 플레이어가 입력창에 입력 중인 공격 단어다.
   */
  const [input, setInput] = useState("");
  /**
   * 플레이어 스프라이트 흔들림 애니메이션 활성 여부다.
   */
  const [shakePlayer, setShakePlayer] = useState(false);
  /**
   * 몬스터 스프라이트 흔들림 애니메이션 활성 여부다.
   */
  const [shakeMonster, setShakeMonster] = useState(false);
  /**
   * CRT 글리치 효과 활성 여부다.
   */
  const [glitchActive, setGlitchActive] = useState(false);
  /**
   * 전투 캔버스 DOM 요소를 참조한다.
   */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * 현재 애니메이션 루프의 requestAnimationFrame ID를 저장한다.
   */
  const rafRef = useRef<number>(0);
  /**
   * 화면 위에 존재하는 투사체 목록을 보관한다.
   */
  const projectilesRef = useRef<Projectile[]>([]);
  /**
   * 이전 프레임의 글리치 활성 상태를 기억한다.
   */
  const glitchStateRef = useRef(false);

  /**
   * 현재 순번에 해당하는 원본 내레이션 문장이다.
   */
  const rawNarrative = narratives[narrativeIndex % narratives.length];
  /**
   * 대괄호로 감싼 입력 키워드만 추출한 목록이다.
   */
  const keywords = [...rawNarrative.matchAll(/\[([^[\]]+)\]/g)].map(
    (match) => match[1],
  );
  /**
   * 키워드용 대괄호를 제거한 실제 표시용 내레이션 문장이다.
   */
  const cleanNarrative = rawNarrative.replace(/\[|\]/g, "");

  /**
   * Pretext로 줄바꿈 계산을 마친 내레이션 레이아웃 결과다.
   */
  const layoutLines = useMemo(() => {
    try {
      const prepared = prepareWithSegments(cleanNarrative, FONT);
      const result = layoutWithLines(prepared, TEXT_WIDTH, LINE_HEIGHT);
      return result.lines.map((line) => ({
        text: line.text,
        width: line.width,
      }));
    } catch {
      return [{ text: cleanNarrative, width: TEXT_WIDTH }];
    }
  }, [cleanNarrative]);

  useEffect(() => {
    /**
     * 전투 텍스트와 투사체를 매 프레임 다시 그린다.
     */
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    /**
     * 전투 캔버스의 실제 픽셀 너비다.
     */
    const width = 480;
    /**
     * 전투 캔버스의 실제 픽셀 높이다.
     */
    const height = 320;
    canvas.width = width;
    canvas.height = height;

    /**
     * 전투 텍스트, 투사체, 피격 효과를 한 프레임 단위로 그린다.
     */
    const animate = () => {
      context.clearRect(0, 0, width, height);
      /**
       * 현재 프레임에 살아 있는 투사체 목록이다.
       */
      const projectiles = projectilesRef.current;

      context.font = FONT;
      context.textBaseline = "alphabetic";

      /**
       * 전체 내레이션 블록의 총 높이다.
       */
      const totalTextHeight = layoutLines.length * LINE_HEIGHT;
      /**
       * 내레이션을 세로 중앙에 배치하기 위한 시작 Y 좌표다.
       */
      const textStartY = Math.max(40, (height - totalTextHeight) / 2);

      for (let lineIndex = 0; lineIndex < layoutLines.length; lineIndex += 1) {
        const line = layoutLines[lineIndex];
        const baseY = textStartY + lineIndex * LINE_HEIGHT;
        const lineStartX = (width - line.width) / 2;
        let currentX = lineStartX;

        for (let charIndex = 0; charIndex < line.text.length; charIndex += 1) {
          const char = line.text[charIndex];
          const charWidth = context.measureText(char).width;
          let offsetX = 0;
          let offsetY = 0;
          let alpha = 0.75;

          for (const projectile of projectiles) {
            if (!projectile.alive) continue;

            const dx = currentX - projectile.x;
            const dy = baseY - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 90) {
              const force = (90 - distance) / 90;
              offsetY += (dy > 0 ? 1 : -1) * force * 20;
              offsetX += (dx > 0 ? 1 : -1) * force * 12;
              alpha = Math.max(0.1, alpha - force * 0.5);
            }
          }

          const isKeyword = keywords.some((keyword) => {
            const keywordIndex = cleanNarrative.indexOf(keyword);
            let characterCount = 0;

            for (let prevLine = 0; prevLine < lineIndex; prevLine += 1) {
              characterCount += layoutLines[prevLine].text.length;
            }

            characterCount += charIndex;
            return (
              characterCount >= keywordIndex &&
              characterCount < keywordIndex + keyword.length
            );
          });

          context.fillStyle = isKeyword
            ? `rgba(255, 200, 60, ${alpha})`
            : `rgba(190, 190, 190, ${alpha})`;
          context.fillText(char, currentX + offsetX, baseY + offsetY);
          currentX += charWidth;
        }
      }

      /**
       * 현재 프레임에 투사체가 CRT 영역 내부를 지나는지 여부다.
       */
      let anyProjectileCrossing = false;

      for (const projectile of projectiles) {
        if (!projectile.alive) continue;

        projectile.x += projectile.vx;
        projectile.y += projectile.vy;

        projectile.offsets.forEach((offset) => {
          offset.dx += (Math.random() - 0.5) * 0.4;
          offset.dy += (Math.random() - 0.5) * 0.4;
          offset.rot += (Math.random() - 0.5) * 0.03;
        });

        if (projectile.x > 0 && projectile.x < width) {
          anyProjectileCrossing = true;
        }

        context.save();
        context.font = "bold 18px 'Courier New', monospace";
        context.fillStyle = projectile.fromPlayer
          ? "rgba(100, 220, 255, 0.9)"
          : "rgba(255, 80, 60, 0.9)";
        context.shadowColor = projectile.fromPlayer
          ? "rgba(100, 220, 255, 0.4)"
          : "rgba(255, 80, 60, 0.4)";
        context.shadowBlur = 16;

        for (
          let charIndex = 0;
          charIndex < projectile.chars.length;
          charIndex += 1
        ) {
          const offset = projectile.offsets[charIndex];
          const charX = projectile.x + charIndex * 14 + offset.dx;
          const charY = projectile.y + offset.dy;

          context.save();
          context.translate(charX, charY);
          context.rotate(offset.rot);
          context.fillText(projectile.chars[charIndex], 0, 0);
          context.restore();
        }

        context.restore();

        if (projectile.fromPlayer && projectile.x > width + 20) {
          projectile.alive = false;
          onMonsterHit(3 + Math.floor(Math.random() * 3));
          setShakeMonster(true);
          window.setTimeout(() => setShakeMonster(false), 300);
        } else if (!projectile.fromPlayer && projectile.x < -20) {
          projectile.alive = false;
          onPlayerHit(2 + Math.floor(Math.random() * 3));
          setShakePlayer(true);
          window.setTimeout(() => setShakePlayer(false), 300);
        }

        if (projectile.x < -200 || projectile.x > width + 200) {
          projectile.alive = false;
        }
      }

      if (glitchStateRef.current !== anyProjectileCrossing) {
        glitchStateRef.current = anyProjectileCrossing;
        setGlitchActive(anyProjectileCrossing);
      }

      projectilesRef.current = projectiles.filter(
        (projectile) => projectile.alive,
      );
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cleanNarrative, keywords, layoutLines, onMonsterHit, onPlayerHit]);

  useEffect(() => {
    /**
     * 몬스터 차례일 때 자동 공격을 예약한다.
     */
    if (turn !== "monster") return;

    const timeoutId = window.setTimeout(() => {
      /**
       * 이번 공격에 선택된 단어다.
       */
      const word =
        monsterAttackWords[
          Math.floor(Math.random() * monsterAttackWords.length)
        ];
      const canvas = canvasRef.current;
      const width = canvas?.width ?? 480;
      const height = canvas?.height ?? 320;

      projectilesRef.current.push({
        chars: word.split(""),
        x: width + 40,
        y: height / 2 + (Math.random() - 0.5) * 80,
        vx: -5 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        alive: true,
        fromPlayer: false,
        offsets: word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
      });

      window.setTimeout(() => {
        setNarrativeIndex((value) => value + 1);
        onTurnEnd();
      }, 1400);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [monsterAttackWords, turn, onTurnEnd]);

  /**
   * 플레이어가 입력한 단어를 투사체로 발사한다.
   *
   * @param event 폼 제출 이벤트
   */
  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (turn !== "player") return;

      const word = input.trim().toUpperCase();
      if (!word) return;

      const canvas = canvasRef.current;
      const height = canvas?.height ?? 320;

      projectilesRef.current.push({
        chars: word.split(""),
        x: -40,
        y: height / 2 + (Math.random() - 0.5) * 80,
        vx: 5 + Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        alive: true,
        fromPlayer: true,
        offsets: word.split("").map(() => ({ dx: 0, dy: 0, rot: 0 })),
      });

      setInput("");

      window.setTimeout(() => {
        setNarrativeIndex((value) => value + 1);
        onTurnEnd();
      }, 1400);
    },
    [input, onTurnEnd, turn],
  );

  return (
    <div className="flex w-full max-w-[1200px] flex-col items-center justify-center gap-8 px-4 animate-fade-in-quick lg:flex-row lg:gap-8">
      <div
        className={`flex shrink-0 items-end transition-transform duration-100 ${
          shakePlayer ? "animate-sprite-shake" : ""
        }`}
      >
        <pre
          className={`m-0 whitespace-pre text-[4px] leading-[5px] select-none sm:text-[5px] sm:leading-[6px] ${
            shakePlayer
              ? "text-[rgba(255,80,80,0.9)]"
              : "text-[rgba(200,200,200,0.85)]"
          }`}
        >
          {playerAscii.join("\n")}
        </pre>
      </div>

      <div className="flex min-w-0 flex-col items-center gap-5">
        <div
          className={`relative overflow-hidden rounded-xl shadow-[inset_0_0_40px_rgba(0,0,0,0.5),0_0_30px_rgba(0,0,0,0.6)] ${
            glitchActive ? "animate-crt-glitch" : ""
          }`}
        >
          <canvas
            ref={canvasRef}
            className="block h-auto w-[min(92vw,480px)] max-w-full"
          />
          <CrtOverlay glitchActive={glitchActive} />
        </div>

        {turn === "player" && (
          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-[480px] items-center gap-2"
          >
            <span className="font-bold text-ember">{">"}</span>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                keywords.length > 0
                  ? `${keywords.join(", ")}...`
                  : attackPlaceholderFallback
              }
              autoFocus
              className="min-w-0 flex-1 border-0 border-b border-white/30 bg-transparent text-[1.05rem] text-ember outline-none placeholder:text-white/35 focus:border-ember sm:text-[1.2rem]"
            />
          </form>
        )}

        {turn === "monster" && (
          <p className="m-0 text-center text-[0.95rem] tracking-[0.1em] text-[rgba(255,100,80,0.5)] animate-wait-blink">
            {retaliatesText}
          </p>
        )}
      </div>

      <div
        className={`flex shrink-0 items-end transition-transform duration-100 ${
          shakeMonster ? "animate-sprite-shake" : ""
        }`}
      >
        <pre
          className={`m-0 whitespace-pre text-[4px] leading-[5px] select-none sm:text-[5px] sm:leading-[6px] ${
            shakeMonster
              ? "text-[rgba(255,80,80,0.9)]"
              : "text-[rgba(200,200,200,0.85)]"
          }`}
        >
          {monsterAscii.join("\n")}
        </pre>
      </div>
    </div>
  );
}
