import { useEffect, useRef, useState } from "react";

/**
 * 교차한 검 모양을 표현하는 ASCII 아트다.
 */
const CROSSED = [
  "         /|    |\\         ",
  "        / |    | \\        ",
  "       /  |    |  \\       ",
  "      /   |    |   \\      ",
  "     / ___\\_/\\_/___  \\    ",
  "    /_/    \\ /     \\_  \\  ",
  "       \\   X   /         ",
  "        \\ / \\ /          ",
  "         X   X           ",
  "        / \\ / \\          ",
  "       /   X   \\         ",
  "      /   / \\   \\        ",
  "     /   /   \\   \\       ",
  "         |   |           ",
  "         |   |           ",
  "        _|   |_          ",
  "       |___|___|         ",
];

/**
 * 검 조우 연출 종료 후 호출할 콜백이다.
 */
interface SwordEncounterProps {
  onComplete: () => void;
}

/**
 * 간단한 검 조우 ASCII 연출을 출력하는 컴포넌트다.
 *
 * @param props 종료 콜백
 */
export default function SwordEncounter({ onComplete }: SwordEncounterProps) {
  /**
   * 연출의 현재 단계를 저장한다.
   */
  const [phase, setPhase] = useState<"clash" | "sparks" | "idle">("clash");
  /**
   * 불꽃 프레임 번호를 저장한다.
   */
  const [sparkFrame, setSparkFrame] = useState(0);
  /**
   * 연출 컨테이너의 투명도 값을 저장한다.
   */
  const [opacity, setOpacity] = useState(0);
  /**
   * 페이드아웃 진행 여부를 저장한다.
   */
  const [fadingOut, setFadingOut] = useState(false);
  /**
   * 불꽃 점멸용 interval ID를 저장한다.
   */
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();

    const fadeIn = (now: number) => {
      const progress = Math.min((now - start) / 800, 1);
      setOpacity(progress);

      if (progress < 1) {
        requestAnimationFrame(fadeIn);
      } else {
        setPhase("sparks");
      }
    };

    requestAnimationFrame(fadeIn);
  }, []);

  useEffect(() => {
    if (phase !== "sparks") return;

    let frame = 0;
    intervalRef.current = window.setInterval(() => {
      frame += 1;
      setSparkFrame(frame);

      if (frame > 12) {
        setPhase("idle");
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
        }
      }
    }, 120);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [phase]);

  /**
   * 충돌 불꽃에 순환 적용할 문자 목록이다.
   */
  const sparkChars = ["*", "+", "x", ".", "o", "#"];
  /**
   * 현재 프레임에서 보여 줄 불꽃 문자다.
   */
  const sparkOverlay =
    phase === "sparks" || phase === "idle"
      ? sparkFrame % 2 === 0
        ? sparkChars[sparkFrame % sparkChars.length]
        : ""
      : "";

  /**
   * idle 단계에서 클릭되면 연출을 닫고 부모에게 완료를 알린다.
   */
  const handleClick = () => {
    if (phase !== "idle") return;
    setFadingOut(true);
    window.setTimeout(onComplete, 650);
  };

  return (
    <div
      className={`flex flex-col items-center transition-[opacity,filter] duration-700 ${
        fadingOut ? "opacity-0 blur-[4px]" : ""
      }`}
      style={{ opacity, cursor: phase === "idle" ? "pointer" : "default" }}
      onClick={handleClick}
    >
      <pre className="m-0 whitespace-pre text-center text-[0.95rem] leading-[1.1] text-ash [text-shadow:0_0_6px_rgba(255,255,255,0.12)]">
        {CROSSED.map((line, index) => (
          <span key={index}>
            {line}
            {index === 6 && sparkOverlay ? (
              <span className="text-ember">{` ${sparkOverlay}`}</span>
            ) : null}
            {"\n"}
          </span>
        ))}
      </pre>
      {phase === "idle" && (
        <p className="mt-4 text-sm tracking-[0.12em] text-white/50 opacity-0 [animation:fade_1s_0.6s_forwards]">
          {"[ click to engage ]"}
        </p>
      )}
    </div>
  );
}
