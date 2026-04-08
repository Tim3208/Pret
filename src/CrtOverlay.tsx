interface CrtOverlayProps {
  glitchActive?: boolean;
}

/**
 * CRT 스캔라인, 노이즈, 비네트, 깜빡임 효과를 겹쳐 그리는 오버레이 컴포넌트다.
 *
 * @param props 글리치 활성 여부
 */
export default function CrtOverlay({
  glitchActive = false,
}: CrtOverlayProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={
          glitchActive
            ? "pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(to_bottom,transparent_0px,transparent_1px,rgba(0,0,0,0.3)_1px,rgba(0,0,0,0.3)_3px)]"
            : "pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(to_bottom,transparent_0px,transparent_2px,rgba(0,0,0,0.15)_2px,rgba(0,0,0,0.15)_4px)]"
        }
      />
      <div
        aria-hidden="true"
        className={
          glitchActive
            ? "pointer-events-none absolute inset-[-50%] z-20 h-[200%] w-[200%] animate-noise-shift opacity-[0.15]"
            : "pointer-events-none absolute inset-[-50%] z-20 h-[200%] w-[200%] animate-noise-shift opacity-[0.04]"
        }
        style={{ filter: "url(#noise)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.55)_85%,rgba(0,0,0,0.85)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-40 animate-crt-flicker bg-transparent"
      />
    </>
  );
}
