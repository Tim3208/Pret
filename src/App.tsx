import { type FormEvent, useEffect, useRef, useState } from "react";
import BattleScene from "./BattleScene";
import CrtOverlay from "./CrtOverlay";

const STORY_TEXT = `A bitter wind cuts through your coat, chilling you to the bone. Before you lies a crude fire pit with a few dry logs left behind by a forgotten traveler. Wolves howl in the surrounding darkness, their cries echoing closer with every passing moment. Without fire you will surely freeze to death or become prey to the beasts. Will you light the bonfire?`;

const ASCII_RAMP = " .:-=+*#%@";

export default function App() {
  const [phase, setPhase] = useState<"text" | "transition" | "battle">("text");
  const [input, setInput] = useState("");
  const requestRef = useRef<number | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (phase !== "transition") return;

    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    const displayContext = displayCanvas.getContext("2d");
    if (!displayContext) return;

    const simCanvas = document.createElement("canvas");
    const simContext = simCanvas.getContext("2d");
    if (!simContext) return;

    const columns = 80;
    const rows = 40;
    simCanvas.width = columns;
    simCanvas.height = rows;

    const charWidth = 10;
    const charHeight = 14;
    displayCanvas.width = columns * charWidth;
    displayCanvas.height = rows * charHeight;

    let time = 0;
    let mouseGridX = -1000;
    let mouseGridY = -1000;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = displayCanvas.getBoundingClientRect();
      const withinX = event.clientX >= rect.left && event.clientX <= rect.right;
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

    const outerRadius = 8;
    const innerRadius = 4;
    const sparks: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
    }[] = [];

    const fps = 12;
    const frameDuration = 1000 / fps;
    let lastFrameTime = 0;

    const animate = (now: number) => {
      if (now - lastFrameTime < frameDuration) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      lastFrameTime = now;
      time += 1;

      simContext.fillStyle = "rgb(255, 255, 255)";
      simContext.fillRect(0, 0, columns, rows);

      const centerX = columns / 2;
      const centerY = rows - 6;
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

      const emberPulse =
        0.5 + 0.5 * Math.sin(time * 0.08 + 1.3) * Math.sin(time * 0.13);
      const emberBrightness = Math.floor(100 + emberPulse * 100);
      simContext.fillStyle = `rgb(120, ${emberBrightness}, 0)`;
      simContext.beginPath();
      simContext.ellipse(centerX + windSway * 0.3, centerY - 1, 10, 4, 0, 0, Math.PI * 2);
      simContext.fill();

      for (let index = 0; index < 3; index += 1) {
        const emberX = centerX + Math.sin(index * 2.1 + time * 0.05) * 7;
        const emberT = 0.5 + 0.5 * Math.sin(time * 0.1 + index * 1.7);

        simContext.fillStyle = `rgb(120, ${Math.floor(80 + emberT * 150)}, 0)`;
        simContext.beginPath();
        simContext.arc(emberX, centerY + 0.5 + index * 0.3, 2.5, 0, Math.PI * 2);
        simContext.fill();
      }

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
          Math.PI * 2
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
          Math.PI * 2
        );
        simContext.fill();
      }

      simContext.fillStyle = "rgb(0, 80, 0)";
      {
        const sway = Math.sin(time * 0.12) * 1.5 + windSway * 0.4;
        const flameHeight = 4 + breathe * 0.3 + Math.sin(time * 0.2);
        simContext.beginPath();
        simContext.ellipse(centerX + sway, centerY - 3 - flameHeight / 2, 3.5, flameHeight, 0, 0, Math.PI * 2);
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

      const imageData = simContext.getImageData(0, 0, columns, rows);
      const data = imageData.data;

      displayContext.fillStyle = "#0d0d0d";
      displayContext.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
      displayContext.textBaseline = "top";

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const offset = (y * columns + x) * 4;
          const red = data[offset];
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
              Math.min(1, (distance - innerRadius) / (outerRadius - innerRadius))
            );

            weight = Math.round(100 + edgeT * 800);
            weight = Math.round(weight / 100) * 100;
            weight = Math.max(100, Math.min(900, weight));
          }

          if (type === "space") continue;

          const brightness = 1 - Math.min(green, 255) / 255;
          let rampIndex: number;

          if (type === "fire") {
            const zoneBase = zone === 0 ? 0.9 : zone === 1 ? 0.7 : 0.5;
            rampIndex = Math.floor((zoneBase + brightness * 0.1) * (ASCII_RAMP.length - 1));
          } else if (type === "ember") {
            rampIndex = Math.floor((brightness * 0.4 + 0.4) * (ASCII_RAMP.length - 1));
          } else {
            rampIndex = Math.floor(0.55 * (ASCII_RAMP.length - 1));
          }

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
              40 + emberT * 50
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
            displayContext.fillText(character, x * charWidth + 0.5, y * charHeight + 0.5);
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const answer = input.trim().toLowerCase();

    if (
      answer.includes("light") ||
      answer.includes("ignite") ||
      answer === "y" ||
      answer === "yes"
    ) {
      setPhase("transition");
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-void px-4 py-8 sm:px-8">
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
              {STORY_TEXT.split("\n").map((line, index) => (
                <p key={index}>{line}</p>
              ))}
              <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
                <span className="font-bold text-ember">{">"}</span>
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="(light / Y)"
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
              <p className="mt-12 text-center text-[1.05rem] opacity-0 sm:text-[1.2rem] [animation:fade_3s_forwards] [animation-delay:2s] [background:radial-gradient(ellipse_280px_100px_at_center_-20px,#bfbfbf_0%,rgba(191,191,191,0.8)_30%,rgba(191,191,191,0.39)_55%,rgba(191,191,191,0.23)_80%,rgba(191,191,191,0.13)_100%)] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]">
                The bonfire crackles to life, its warmth wrapping around you...
              </p>
              <button
                type="button"
                className="mt-8 cursor-pointer border border-white/30 bg-transparent px-6 py-2 text-[0.95rem] tracking-[0.1em] text-white/60 opacity-0 transition-colors duration-300 hover:border-ember hover:text-ember [animation:fade_1s_3s_forwards]"
                onClick={() => setPhase("battle")}
              >
                {"[ venture forth ]"}
              </button>
            </div>
          )}

          <CrtOverlay />
        </div>
      ) : (
        <BattleScene />
      )}
    </div>
  );
}
