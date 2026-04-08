import { useState, useRef, useEffect, FormEvent } from "react";
import "./App.css";
import "./Battle.css";
import BattleScene from "./BattleScene";

const STORY_TEXT = `A bitter wind cuts through your coat, chilling you to the bone. Before you lies a crude fire pit with a few dry logs left behind by a forgotten traveler. Wolves howl in the surrounding darkness, their cries echoing closer with every passing moment. Without fire you will surely freeze to death or become prey to the beasts. Will you light the bonfire?`;

// ASCII density ramp: sparse -> dense
const ASCII_RAMP = " .:-=+*#%@";

function App() {
  const [phase, setPhase] = useState<"text" | "transition" | "battle">("text");
  const [input, setInput] = useState("");
  const requestRef = useRef<number>();
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (phase === "transition") {
      const displayCanvas = displayCanvasRef.current;
      if (!displayCanvas) return;
      const displayCtx = displayCanvas.getContext("2d");
      if (!displayCtx) return;

      // 오프스크린 캔버스 (불꽃 시뮬레이션용)
      const simCanvas = document.createElement("canvas");
      const simCtx = simCanvas.getContext("2d");
      if (!simCtx) return;

      const cw = 80;
      const ch = 40;
      simCanvas.width = cw;
      simCanvas.height = ch;

      // 디스플레이 캔버스 크기 설정
      const charW = 10;
      const charH = 14;
      displayCanvas.width = cw * charW;
      displayCanvas.height = ch * charH;

      let time = 0;
      let mouseGridX = -1000;
      let mouseGridY = -1000;

      const handleMouseMove = (e: MouseEvent) => {
        const rect = displayCanvas.getBoundingClientRect();
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        ) {
          mouseGridX = ((e.clientX - rect.left) / rect.width) * cw;
          mouseGridY = ((e.clientY - rect.top) / rect.height) * ch;
        } else {
          mouseGridX = -1000;
          mouseGridY = -1000;
        }
      };

      window.addEventListener("mousemove", handleMouseMove);

      const outerRadius = 8;
      const innerRadius = 4;

      // 불티(Sparks) 파티클 시스템
      const sparks: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];

      const FPS = 12;
      const frameDuration = 1000 / FPS;
      let lastFrameTime = 0;

      const animate = (now: number) => {
        if (now - lastFrameTime < frameDuration) {
          requestRef.current = requestAnimationFrame(animate);
          return;
        }
        lastFrameTime = now;

        time += 1;

        // --- 시뮬레이션 캔버스: RGB 채널로 영역 인코딩 ---
        // R 채널: 0=불 중심, 40=불 중간, 80=불 외곽, 100=나무, 120=달아오른 숯, 255=빈공간
        // G 채널: 밝기 힌트 (0=가장 밝음, 255=어두움)
        simCtx.fillStyle = "rgb(255, 255, 255)";
        simCtx.fillRect(0, 0, cw, ch);

        const cx = cw / 2;
        const cy = ch - 6;

        // 전체 바람 흔들림 (유기적인 좌우 흔들림)
        const windSway = Math.sin(time * 0.07) * 2 + Math.sin(time * 0.13) * 1;

        // ===== 1. 장작 (X자 교차, 이미지처럼 크고 굵은 통나무) =====
        simCtx.fillStyle = "rgb(100, 180, 0)"; // R=100 → wood
        
        // 뒤쪽 X자 장작 (큰 통나무 2개)
        simCtx.save();
        simCtx.translate(cx, cy + 2);
        simCtx.rotate(-0.35);
        simCtx.beginPath();
        simCtx.ellipse(0, 0, 3, 16, 0, 0, Math.PI * 2);
        simCtx.fill();
        simCtx.restore();

        simCtx.save();
        simCtx.translate(cx, cy + 2);
        simCtx.rotate(0.35);
        simCtx.beginPath();
        simCtx.ellipse(0, 0, 3, 16, 0, 0, Math.PI * 2);
        simCtx.fill();
        simCtx.restore();

        // 앞쪽 X자 장작 (약간 아래쪽, 2개)
        simCtx.save();
        simCtx.translate(cx, cy + 4);
        simCtx.rotate(-0.25);
        simCtx.beginPath();
        simCtx.ellipse(0, 0, 2.5, 14, 0, 0, Math.PI * 2);
        simCtx.fill();
        simCtx.restore();

        simCtx.save();
        simCtx.translate(cx, cy + 4);
        simCtx.rotate(0.25);
        simCtx.beginPath();
        simCtx.ellipse(0, 0, 2.5, 14, 0, 0, Math.PI * 2);
        simCtx.fill();
        simCtx.restore();

        // ===== 1b. 장작 밑동의 달아오른 숯 (Embers / Pulsing) =====
        const emberPulse = 0.5 + 0.5 * Math.sin(time * 0.08 + 1.3) * Math.sin(time * 0.13);
        const emberBright = Math.floor(100 + emberPulse * 100);
        simCtx.fillStyle = `rgb(120, ${emberBright}, 0)`;
        simCtx.beginPath();
        simCtx.ellipse(cx + windSway * 0.3, cy - 1, 10, 4, 0, 0, Math.PI * 2);
        simCtx.fill();
        for (let i = 0; i < 3; i++) {
          const ex = cx + Math.sin(i * 2.1 + time * 0.05) * 7;
          const ep = 0.5 + 0.5 * Math.sin(time * 0.1 + i * 1.7);
          simCtx.fillStyle = `rgb(120, ${Math.floor(80 + ep * 150)}, 0)`;
          simCtx.beginPath();
          simCtx.arc(ex, cy + 0.5 + i * 0.3, 2.5, 0, Math.PI * 2);
          simCtx.fill();
        }

        // ===== 2. 불꽃 — 3층 (낮고 넓게, 아늑한 모닥불) =====
        const breathe = Math.sin(time * 0.12) * 1.5 + Math.sin(time * 0.19) * 1;

        // --- 외곽부 (짙은 붉은색, R=80) — 넓고 낮게 ---
        simCtx.fillStyle = "rgb(80, 200, 0)";
        for (let i = 0; i < 4; i++) {
          const phase = i * 1.5;
          const sw = Math.sin(time * 0.08 + phase) * 4 + windSway;
          const h = 8 + breathe + Math.sin(time * 0.14 + phase) * 2;
          const w = 7 - (i % 2);
          simCtx.beginPath();
          simCtx.ellipse(
            cx + Math.sin(phase) * 5 + sw,
            cy - 3 - h / 2,
            w,
            h,
            0, 0, Math.PI * 2
          );
          simCtx.fill();
        }

        // --- 중간부 (주황색, R=40) ---
        simCtx.fillStyle = "rgb(40, 160, 0)";
        for (let i = 0; i < 3; i++) {
          const phase = i * 2.0 + 0.5;
          const sw = Math.sin(time * 0.1 + phase) * 3 + windSway * 0.7;
          const h = 6 + breathe * 0.7 + Math.sin(time * 0.16 + phase) * 1.5;
          simCtx.beginPath();
          simCtx.ellipse(
            cx + Math.sin(phase) * 3 + sw,
            cy - 3 - h / 2,
            5 - (i % 2) * 0.5,
            h,
            0, 0, Math.PI * 2
          );
          simCtx.fill();
        }

        // --- 중심부 (밝은 흰노랑, R=0) ---
        simCtx.fillStyle = "rgb(0, 80, 0)";
        {
          const sw = Math.sin(time * 0.12) * 1.5 + windSway * 0.4;
          const h = 4 + breathe * 0.3 + Math.sin(time * 0.2) * 1;
          simCtx.beginPath();
          simCtx.ellipse(cx + sw, cy - 3 - h / 2, 3.5, h, 0, 0, Math.PI * 2);
          simCtx.fill();
        }

        // ===== 3. 불티 (Sparks) 파티클 =====
        if (time % 4 === 0 && sparks.length < 15) {
          sparks.push({
            x: cx + (Math.random() - 0.5) * 12 + windSway,
            y: cy - 6 - Math.random() * 4,
            vx: (Math.random() - 0.5) * 0.8 + windSway * 0.1,
            vy: -(0.3 + Math.random() * 0.5),
            life: 0,
            maxLife: 20 + Math.random() * 30,
          });
        }
        // 불티 업데이트 & 그리기
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.x += s.vx + Math.sin(time * 0.15 + i) * 0.2;
          s.y += s.vy;
          s.life += 1;
          if (s.life > s.maxLife || s.y < 0) {
            sparks.splice(i, 1);
            continue;
          }
          const sparkFade = 1 - s.life / s.maxLife;
          const sparkR = Math.floor(40 + sparkFade * 40); // 40~80 범위
          simCtx.fillStyle = `rgb(${sparkR}, ${Math.floor(sparkFade * 200)}, 0)`;
          simCtx.beginPath();
          simCtx.arc(s.x, s.y, 0.8 + sparkFade * 0.5, 0, Math.PI * 2);
          simCtx.fill();
        }

        // --- 디스플레이 캔버스: ASCII 문자 직접 그리기 ---
        const imgData = simCtx.getImageData(0, 0, cw, ch);
        const data = imgData.data;

        displayCtx.fillStyle = "#0d0d0d";
        displayCtx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.textBaseline = "top";

        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const offset = (y * cw + x) * 4;
            const r = data[offset];
            const g = data[offset + 1];

            // R 채널로 영역 판별
            let type = "space";
            let zone = 0; // 0=core, 1=mid, 2=outer, 3=wood, 4=ember
            if (r <= 10) { type = "fire"; zone = 0; }       // 중심 (흰노랑)
            else if (r <= 50) { type = "fire"; zone = 1; }   // 중간 (주황)
            else if (r <= 90) { type = "fire"; zone = 2; }   // 외곽 (붉은색)
            else if (r <= 105) { type = "wood"; zone = 3; }  // 장작
            else if (r <= 130) { type = "ember"; zone = 4; } // 숯/달아오른 부분
            // r > 130 → space

            // 마우스 인터랙션
            const dx = x - mouseGridX;
            const dy = (y - mouseGridY) * 1.8;
            const dist = Math.sqrt(dx * dx + dy * dy);

            let opacity = 1;
            let weight = 900;

            if (dist < innerRadius && type !== "space") {
              const innerT = dist / innerRadius;
              opacity = 0.05 + innerT * 0.35;
              weight = 100;
            } else if (dist < outerRadius && type !== "space") {
              const t = Math.max(0, Math.min(1, (dist - innerRadius) / (outerRadius - innerRadius)));
              weight = Math.round(100 + t * 800);
              weight = Math.round(weight / 100) * 100;
              weight = Math.max(100, Math.min(900, weight));
            }

            if (type === "space") continue;

            // ASCII ramp 문자 선택 (밝기 기반)
            const gNorm = 1 - Math.min(g, 255) / 255; // G 채널로 밝기 보정
            let rampIdx: number;
            if (type === "fire") {
              // 불: zone에 따라 밀도 차등
              const zoneBase = zone === 0 ? 0.9 : zone === 1 ? 0.7 : 0.5;
              rampIdx = Math.floor((zoneBase + gNorm * 0.1) * (ASCII_RAMP.length - 1));
            } else if (type === "ember") {
              // 숯: G채널 맥박에 따라
              rampIdx = Math.floor((gNorm * 0.4 + 0.4) * (ASCII_RAMP.length - 1));
            } else {
              // 나무: 중간 밀도
              rampIdx = Math.floor(0.55 * (ASCII_RAMP.length - 1));
            }
            const asciiChar = ASCII_RAMP[Math.max(1, Math.min(rampIdx, ASCII_RAMP.length - 1))];

            // 색상 & font 설정
            const fontWeight = weight >= 700 ? "bold" : "normal";
            const fontSize = weight >= 500 ? 13 : weight >= 300 ? 11 : 10;
            displayCtx.font = `${fontWeight} ${fontSize}px monospace`;

            let color: string;
            if (zone === 0) {
              // 중심: 밝은 흰노랑
              color = `rgba(255, 255, 200, ${opacity})`;
            } else if (zone === 1) {
              // 중간: 선명한 주황
              color = `rgba(255, 160, 30, ${opacity})`;
            } else if (zone === 2) {
              // 외곽: 짙은 붉은색
              color = `rgba(220, 50, 20, ${opacity})`;
            } else if (zone === 4) {
              // 숯/달아오른 부분: 은은한 붉은 + 맥박
              const ep = Math.min(g / 255, 1);
              color = `rgba(${Math.floor(180 + ep * 75)}, ${Math.floor(40 + ep * 50)}, 10, ${opacity})`;
            } else {
              // 나무: 짙은 갈색~검은색
              color = `rgba(90, 55, 25, ${opacity})`;
            }
            displayCtx.fillStyle = color;
            displayCtx.fillText(asciiChar, x * charW, y * charH);

            // glow 효과 (불 영역만)
            if (type === "fire" && opacity > 0.4) {
              const glowAlpha = opacity * (zone === 0 ? 0.4 : 0.2);
              displayCtx.fillStyle = zone === 0
                ? `rgba(255, 240, 150, ${glowAlpha})`
                : `rgba(255, 80, 10, ${glowAlpha})`;
              displayCtx.fillText(asciiChar, x * charW + 0.5, y * charH + 0.5);
            }
          }
        }

        requestRef.current = requestAnimationFrame(animate);
      };

      requestRef.current = requestAnimationFrame(animate);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
    }
  }, [phase]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ans = input.trim().toLowerCase();
    if (ans.includes("light") || ans.includes("피운다") || ans === "y" || ans === "yes") {
      setPhase("transition");
    }
  };

  return (
    <div className="game-container">
      {/* SVG noise filter (shared) */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      {phase !== "battle" && (
        <div className="crt">
          {phase === "text" && (
            <div className="scene-text">
              {STORY_TEXT.split("\n").map((line, i) => <p key={i}>{line}</p>)}
              <form onSubmit={handleSubmit} className="input-form">
                <span className="prompt">{">"}</span>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="(light / Y)"
                  autoFocus
                />
              </form>
            </div>
          )}

          {phase === "transition" && (
            <div className="ascii-wrapper">
              <canvas
                className="ascii-canvas"
                ref={displayCanvasRef}
              />
              <p className="after-text fadeIn">
                The bonfire crackles to life, its warmth wrapping around you...
              </p>
              <button
                className="proceed-btn fadeIn"
                onClick={() => setPhase("battle")}
              >
                {"[ venture forth ]"}
              </button>
            </div>
          )}

          {/* CRT overlay layers */}
          <div className="crt-scanlines" />
          <div className="crt-noise" />
          <div className="crt-vignette" />
        </div>
      )}

      {phase === "battle" && <BattleScene />}
    </div>
  );
}

export default App;

