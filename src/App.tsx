import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import BattleScene from "./BattleScene";
import CrtOverlay from "./CrtOverlay";
import type { BattleResult } from "./BattleScene";
import { type Language, pickText } from "./language";

/**
 * 캠프파이어 장면에서 출력할 도입 내레이션이다.
 */
const STORY_TEXT = {
  en: `A bitter wind cuts through your coat, chilling you to the bone. Before you lies a crude fire pit with a few dry logs left behind by a forgotten traveler. Wolves howl in the surrounding darkness, their cries echoing closer with every passing moment. Without fire you will surely freeze to death or become prey to the beasts. Will you light the bonfire?`,
  ko: `매서운 바람이 코트를 파고들며 뼛속까지 식혀 온다. 눈앞에는 이름 모를 여행자가 남기고 간 듯한 조잡한 화덕과 마른 장작 몇 토막이 놓여 있다. 주변 어둠에서는 늑대 울음소리가 메아리치고, 그 소리는 점점 더 가까워진다. 불을 피우지 못하면 얼어 죽거나 짐승의 먹이가 될 것이다. 모닥불을 피우겠는가?`,
} as const;

const APP_TEXT = {
  inputPlaceholder: {
    en: "(light / Y)",
    ko: "(불을 켠다 / 예)",
  },
  bonfireLine: {
    en: "The bonfire crackles to life, its warmth wrapping around you...",
    ko: "모닥불이 타오르며, 그 온기가 당신을 감싼다...",
  },
  ventureForth: {
    en: "[ venture forth ]",
    ko: "[ 앞으로 나아간다 ]",
  },
  languageLabel: {
    en: "LANG",
    ko: "언어",
  },
  languageEnglish: {
    en: "EN",
    ko: "영어",
  },
  languageKorean: {
    en: "KR",
    ko: "한글",
  },
} as const;

const BONFIRE_CONFIRM_KEYWORDS = [
  "light",
  "ignite",
  "y",
  "yes",
  "bonfire",
  "불",
  "점화",
  "켜",
  "피워",
  "예",
  "네",
  "응",
] as const;

/**
 * 밝기에 따라 아스키 문자 밀도를 매핑할 때 사용하는 문자 램프다.
 */
const ASCII_RAMP = " .:-=+*#%@";

/**
 * 게임의 텍스트 장면, 전환 장면, 전투 장면을 관리하는 루트 컴포넌트다.
 */
export default function App() {
  /**
   * 현재 게임 진행 단계를 저장한다.
   */
  const [phase, setPhase] = useState<"text" | "transition" | "battle">("text");
  /**
   * 사용자 인터페이스의 현재 언어 모드다.
   */
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof navigator === "undefined") {
      return "en";
    }

    return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
  });
  /**
   * 플레이어가 입력창에 입력한 명령어를 저장한다.
   */
  const [input, setInput] = useState("");

  /**
   * 전투 결과에 따라 다음 장면을 결정한다.
   *
   * @param result 전투 승패 정보
   */
  const handleBattleEnd = useCallback((result: BattleResult) => {
    if (result.won) {
      setPhase("transition");
      return;
    }

    setInput("");
    setPhase("text");
  }, []);

  /**
   * 모닥불 애니메이션 프레임을 취소하기 위해 최근 requestAnimationFrame ID를 보관한다.
   */
  const requestRef = useRef<number | null>(null);
  /**
   * 모닥불 ASCII 결과를 렌더링할 캔버스 요소를 참조한다.
   */
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (phase !== "transition") return;

    /**
     * 실제 사용자에게 보여 줄 ASCII 출력 캔버스다.
     */
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    /**
     * 화면용 캔버스 렌더링 컨텍스트다.
     */
    const displayContext = displayCanvas.getContext("2d");
    if (!displayContext) return;

    /**
     * 불꽃 시뮬레이션을 먼저 계산할 오프스크린 캔버스다.
     */
    const simCanvas = document.createElement("canvas");
    /**
     * 오프스크린 시뮬레이션에 그리기 위한 컨텍스트다.
     */
    const simContext = simCanvas.getContext("2d");
    if (!simContext) return;

    /**
     * 시뮬레이션용 가로 셀 수다.
     */
    const columns = 80;
    /**
     * 시뮬레이션용 세로 셀 수다.
     */
    const rows = 40;
    simCanvas.width = columns;
    simCanvas.height = rows;

    /**
     * ASCII 한 글자의 가로 픽셀 폭이다.
     */
    const charWidth = 10;
    /**
     * ASCII 한 글자의 세로 픽셀 높이다.
     */
    const charHeight = 14;
    displayCanvas.width = columns * charWidth;
    displayCanvas.height = rows * charHeight;

    /**
     * 애니메이션 시간축으로 사용하는 누적 프레임 값이다.
     */
    let time = 0;
    /**
     * 마우스의 현재 그리드 X 좌표다.
     */
    let mouseGridX = -1000;
    /**
     * 마우스의 현재 그리드 Y 좌표다.
     */
    let mouseGridY = -1000;

    /**
     * 마우스 위치를 ASCII 그리드 좌표로 변환해 저장한다.
     *
     * @param event 브라우저 마우스 이동 이벤트
     */
    const handleMouseMove = (event: MouseEvent) => {
      /**
       * 캔버스의 실제 화면 좌표 영역이다.
       */
      const rect = displayCanvas.getBoundingClientRect();
      /**
       * 마우스가 캔버스의 가로 영역 안에 있는지 여부다.
       */
      const withinX = event.clientX >= rect.left && event.clientX <= rect.right;
      /**
       * 마우스가 캔버스의 세로 영역 안에 있는지 여부다.
       */
      const withinY = event.clientY >= rect.top && event.clientY <= rect.bottom;

      if (withinX && withinY) {
        mouseGridX = ((event.clientX - rect.left) / rect.width) * columns;
        mouseGridY = ((event.clientY - rect.top) / rect.height) * rows;
        return;
      }

      mouseGridX = -1000;
      mouseGridY = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove);

    /**
     * 마우스 주변에서 효과를 줄 외곽 반경이다.
     */
    const outerRadius = 8;
    /**
     * 마우스 바로 근처에서 강한 소거 효과를 줄 내부 반경이다.
     */
    const innerRadius = 4;
    /**
     * 불티 파티클들의 현재 상태 목록이다.
     */
    const sparks: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
    }[] = [];

    /**
     * 모닥불 애니메이션 목표 FPS다.
     */
    const fps = 12;
    /**
     * 한 프레임이 유지되어야 하는 시간이다.
     */
    const frameDuration = 1000 / fps;
    /**
     * 직전에 실제 렌더링이 수행된 시각이다.
     */
    let lastFrameTime = 0;

    /**
     * 모닥불 시뮬레이션을 갱신하고 ASCII 캔버스에 출력한다.
     *
     * @param now 현재 requestAnimationFrame 타임스탬프
     */
    const animate = (now: number) => {
      if (now - lastFrameTime < frameDuration) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      lastFrameTime = now;
      time += 1;

      simContext.fillStyle = "rgb(255, 255, 255)";
      simContext.fillRect(0, 0, columns, rows);

      /**
       * 모닥불 중심의 X 좌표다.
       */
      const centerX = columns / 2;
      /**
       * 모닥불 바닥 기준 Y 좌표다.
       */
      const centerY = rows - 6;
      /**
       * 바람에 따라 불꽃이 좌우로 흔들리는 양이다.
       */
      const windSway = Math.sin(time * 0.07) * 2 + Math.sin(time * 0.13);

      simContext.fillStyle = "rgb(100, 180, 0)";

      simContext.save();
      simContext.translate(centerX, centerY + 2);
      simContext.rotate(-0.35);
      simContext.beginPath();
      simContext.ellipse(0, 0, 3, 16, 0, 0, Math.PI * 2);
      simContext.fill();
      simContext.restore();

      simContext.save();
      simContext.translate(centerX, centerY + 2);
      simContext.rotate(0.35);
      simContext.beginPath();
      simContext.ellipse(0, 0, 3, 16, 0, 0, Math.PI * 2);
      simContext.fill();
      simContext.restore();

      simContext.save();
      simContext.translate(centerX, centerY + 4);
      simContext.rotate(-0.25);
      simContext.beginPath();
      simContext.ellipse(0, 0, 2.5, 14, 0, 0, Math.PI * 2);
      simContext.fill();
      simContext.restore();

      simContext.save();
      simContext.translate(centerX, centerY + 4);
      simContext.rotate(0.25);
      simContext.beginPath();
      simContext.ellipse(0, 0, 2.5, 14, 0, 0, Math.PI * 2);
      simContext.fill();
      simContext.restore();

      /**
       * 숯불이 맥동하는 정도다.
       */
      const emberPulse =
        0.5 + 0.5 * Math.sin(time * 0.08 + 1.3) * Math.sin(time * 0.13);
      /**
       * 숯의 현재 밝기 값이다.
       */
      const emberBrightness = Math.floor(100 + emberPulse * 100);
      simContext.fillStyle = `rgb(120, ${emberBrightness}, 0)`;
      simContext.beginPath();
      simContext.ellipse(
        centerX + windSway * 0.3,
        centerY - 1,
        10,
        4,
        0,
        0,
        Math.PI * 2,
      );
      simContext.fill();

      for (let index = 0; index < 3; index += 1) {
        const emberX = centerX + Math.sin(index * 2.1 + time * 0.05) * 7;
        const emberT = 0.5 + 0.5 * Math.sin(time * 0.1 + index * 1.7);

        simContext.fillStyle = `rgb(120, ${Math.floor(80 + emberT * 150)}, 0)`;
        simContext.beginPath();
        simContext.arc(
          emberX,
          centerY + 0.5 + index * 0.3,
          2.5,
          0,
          Math.PI * 2,
        );
        simContext.fill();
      }

      /**
       * 전체 불꽃이 들숨과 날숨처럼 부풀었다 줄어드는 리듬값이다.
       */
      const breathe = Math.sin(time * 0.12) * 1.5 + Math.sin(time * 0.19);

      simContext.fillStyle = "rgb(80, 200, 0)";
      for (let index = 0; index < 4; index += 1) {
        const offset = index * 1.5;
        const sway = Math.sin(time * 0.08 + offset) * 4 + windSway;
        const flameHeight = 8 + breathe + Math.sin(time * 0.14 + offset) * 2;
        const flameWidth = 7 - (index % 2);

        simContext.beginPath();
        simContext.ellipse(
          centerX + Math.sin(offset) * 5 + sway,
          centerY - 3 - flameHeight / 2,
          flameWidth,
          flameHeight,
          0,
          0,
          Math.PI * 2,
        );
        simContext.fill();
      }

      simContext.fillStyle = "rgb(40, 160, 0)";
      for (let index = 0; index < 3; index += 1) {
        const offset = index * 2 + 0.5;
        const sway = Math.sin(time * 0.1 + offset) * 3 + windSway * 0.7;
        const flameHeight =
          6 + breathe * 0.7 + Math.sin(time * 0.16 + offset) * 1.5;

        simContext.beginPath();
        simContext.ellipse(
          centerX + Math.sin(offset) * 3 + sway,
          centerY - 3 - flameHeight / 2,
          5 - (index % 2) * 0.5,
          flameHeight,
          0,
          0,
          Math.PI * 2,
        );
        simContext.fill();
      }

      simContext.fillStyle = "rgb(0, 80, 0)";
      {
        const sway = Math.sin(time * 0.12) * 1.5 + windSway * 0.4;
        const flameHeight = 4 + breathe * 0.3 + Math.sin(time * 0.2);
        simContext.beginPath();
        simContext.ellipse(
          centerX + sway,
          centerY - 3 - flameHeight / 2,
          3.5,
          flameHeight,
          0,
          0,
          Math.PI * 2,
        );
        simContext.fill();
      }

      if (time % 4 === 0 && sparks.length < 15) {
        sparks.push({
          x: centerX + (Math.random() - 0.5) * 12 + windSway,
          y: centerY - 6 - Math.random() * 4,
          vx: (Math.random() - 0.5) * 0.8 + windSway * 0.1,
          vy: -(0.3 + Math.random() * 0.5),
          life: 0,
          maxLife: 20 + Math.random() * 30,
        });
      }

      for (let index = sparks.length - 1; index >= 0; index -= 1) {
        const spark = sparks[index];
        spark.x += spark.vx + Math.sin(time * 0.15 + index) * 0.2;
        spark.y += spark.vy;
        spark.life += 1;

        if (spark.life > spark.maxLife || spark.y < 0) {
          sparks.splice(index, 1);
          continue;
        }

        const fade = 1 - spark.life / spark.maxLife;
        const sparkRed = Math.floor(40 + fade * 40);

        simContext.fillStyle = `rgb(${sparkRed}, ${Math.floor(fade * 200)}, 0)`;
        simContext.beginPath();
        simContext.arc(spark.x, spark.y, 0.8 + fade * 0.5, 0, Math.PI * 2);
        simContext.fill();
      }

      /**
       * 시뮬레이션 결과를 픽셀 데이터로 읽어온 값이다.
       */
      const imageData = simContext.getImageData(0, 0, columns, rows);
      /**
       * 픽셀 RGBA 버퍼다.
       */
      const data = imageData.data;

      displayContext.fillStyle = "#0d0d0d";
      displayContext.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
      displayContext.textBaseline = "top";

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const offset = (y * columns + x) * 4;
          /**
           * 현재 셀의 R 채널 값으로 영역 타입을 판별한다.
           */
          const red = data[offset];
          /**
           * 현재 셀의 G 채널 값으로 밝기 보정을 계산한다.
           */
          const green = data[offset + 1];

          let type = "space";
          let zone = 0;

          if (red <= 10) {
            type = "fire";
            zone = 0;
          } else if (red <= 50) {
            type = "fire";
            zone = 1;
          } else if (red <= 90) {
            type = "fire";
            zone = 2;
          } else if (red <= 105) {
            type = "wood";
            zone = 3;
          } else if (red <= 130) {
            type = "ember";
            zone = 4;
          }

          const dx = x - mouseGridX;
          const dy = (y - mouseGridY) * 1.8;
          /**
           * 마우스와 현재 문자 셀 사이의 거리다.
           */
          const distance = Math.sqrt(dx * dx + dy * dy);

          let opacity = 1;
          let weight = 900;

          if (distance < innerRadius && type !== "space") {
            const innerT = distance / innerRadius;
            opacity = 0.05 + innerT * 0.35;
            weight = 100;
          } else if (distance < outerRadius && type !== "space") {
            const edgeT = Math.max(
              0,
              Math.min(
                1,
                (distance - innerRadius) / (outerRadius - innerRadius),
              ),
            );

            weight = Math.round(100 + edgeT * 800);
            weight = Math.round(weight / 100) * 100;
            weight = Math.max(100, Math.min(900, weight));
          }

          if (type === "space") continue;

          /**
           * G 채널을 기준으로 계산한 정규화 밝기 값이다.
           */
          const brightness = 1 - Math.min(green, 255) / 255;
          let rampIndex: number;

          if (type === "fire") {
            const zoneBase = zone === 0 ? 0.9 : zone === 1 ? 0.7 : 0.5;
            rampIndex = Math.floor(
              (zoneBase + brightness * 0.1) * (ASCII_RAMP.length - 1),
            );
          } else if (type === "ember") {
            rampIndex = Math.floor(
              (brightness * 0.4 + 0.4) * (ASCII_RAMP.length - 1),
            );
          } else {
            rampIndex = Math.floor(0.55 * (ASCII_RAMP.length - 1));
          }

          /**
           * 현재 셀에 출력할 ASCII 문자다.
           */
          const character =
            ASCII_RAMP[Math.max(1, Math.min(rampIndex, ASCII_RAMP.length - 1))];
          const fontWeight = weight >= 700 ? "bold" : "normal";
          const fontSize = weight >= 500 ? 13 : weight >= 300 ? 11 : 10;

          displayContext.font = `${fontWeight} ${fontSize}px monospace`;

          let color: string;
          if (zone === 0) {
            color = `rgba(255, 255, 200, ${opacity})`;
          } else if (zone === 1) {
            color = `rgba(255, 160, 30, ${opacity})`;
          } else if (zone === 2) {
            color = `rgba(220, 50, 20, ${opacity})`;
          } else if (zone === 4) {
            const emberT = Math.min(green / 255, 1);
            color = `rgba(${Math.floor(180 + emberT * 75)}, ${Math.floor(
              40 + emberT * 50,
            )}, 10, ${opacity})`;
          } else {
            color = `rgba(90, 55, 25, ${opacity})`;
          }

          displayContext.fillStyle = color;
          displayContext.fillText(character, x * charWidth, y * charHeight);

          if (type === "fire" && opacity > 0.4) {
            const glowAlpha = opacity * (zone === 0 ? 0.4 : 0.2);
            displayContext.fillStyle =
              zone === 0
                ? `rgba(255, 240, 150, ${glowAlpha})`
                : `rgba(255, 80, 10, ${glowAlpha})`;
            displayContext.fillText(
              character,
              x * charWidth + 0.5,
              y * charHeight + 0.5,
            );
          }
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [phase]);

  /**
   * 플레이어 입력값을 해석해 불을 피울지 판정한다.
   *
   * @param event 폼 제출 이벤트
   */
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const answer = input.trim().toLowerCase();

    if (BONFIRE_CONFIRM_KEYWORDS.some((keyword) => answer === keyword || answer.includes(keyword))) {
      setPhase("transition");
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-void px-4 py-8 sm:px-8">
      <div className="absolute right-4 top-4 z-[80] flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-2 py-1 font-crt text-[0.68rem] tracking-[0.12em] text-white/70 backdrop-blur-sm">
        <span className="px-1">{pickText(language, APP_TEXT.languageLabel)}</span>
        <button
          type="button"
          className={`cursor-pointer rounded-full border px-2 py-1 transition-colors ${
            language === "en"
              ? "border-ember/60 bg-ember/15 text-ember"
              : "border-white/12 bg-transparent text-white/50 hover:text-white/80"
          }`}
          onClick={() => setLanguage("en")}
        >
          {pickText(language, APP_TEXT.languageEnglish)}
        </button>
        <button
          type="button"
          className={`cursor-pointer rounded-full border px-2 py-1 transition-colors ${
            language === "ko"
              ? "border-ember/60 bg-ember/15 text-ember"
              : "border-white/12 bg-transparent text-white/50 hover:text-white/80"
          }`}
          onClick={() => setLanguage("ko")}
        >
          {pickText(language, APP_TEXT.languageKorean)}
        </button>
      </div>

      <svg className="absolute h-0 w-0">
        <filter id="noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      {phase !== "battle" ? (
        <div className="relative w-full max-w-[min(92vw,920px)] overflow-hidden rounded-[18px] px-4 py-8 shadow-[inset_0_0_60px_rgba(0,0,0,0.6),0_0_40px_rgba(0,0,0,0.8)] sm:px-8">
          {phase === "text" && (
            <div className="relative z-0 max-w-[600px] text-[1.05rem] leading-[1.8] sm:text-[1.2rem] [text-shadow:0_0_5px_rgba(255,255,255,0.2)]">
              {pickText(language, STORY_TEXT).split("\n").map((line, index) => (
                <p key={index}>{line}</p>
              ))}
              <form
                onSubmit={handleSubmit}
                className="mt-4 flex items-center gap-2"
              >
                <span className="font-bold text-ember">{">"}</span>
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={pickText(language, APP_TEXT.inputPlaceholder)}
                  autoFocus
                  className="w-[200px] border-0 border-b border-white/30 bg-transparent text-[1.05rem] text-ember outline-none placeholder:text-white/35 focus:border-ember sm:text-[1.2rem]"
                />
              </form>
            </div>
          )}

          {phase === "transition" && (
            <div className="relative z-0 flex flex-col items-center">
              <canvas
                ref={displayCanvasRef}
                className="h-auto w-full max-w-[800px] cursor-crosshair [image-rendering:pixelated] animate-fade-in-text"
              />
              <p
                className="mt-12 text-center text-[1.05rem] opacity-0 sm:text-[1.2rem] [animation:fade_3s_forwards] [animation-delay:2s] bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse 280px 100px at center -20px, #bfbfbf 0%, rgba(191, 191, 191, 0.8) 30%, rgba(191, 191, 191, 0.39) 55%, rgba(191, 191, 191, 0.23) 80%, rgba(191, 191, 191, 0.13) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {pickText(language, APP_TEXT.bonfireLine)}
              </p>
              <button
                type="button"
                className="mt-8 cursor-pointer border border-white/30 bg-transparent px-6 py-2 text-[0.95rem] tracking-[0.1em] text-white/60 opacity-0 transition-colors duration-300 hover:border-ember hover:text-ember [animation:fade_1s_3s_forwards]"
                onClick={() => setPhase("battle")}
              >
                {pickText(language, APP_TEXT.ventureForth)}
              </button>
            </div>
          )}

          <CrtOverlay />
        </div>
      ) : (
        <BattleScene language={language} onBattleEnd={handleBattleEnd} />
      )}
    </div>
  );
}
