import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  POTION_USE_BUTTON_HEIGHT,
  POTION_USE_BUTTON_WIDTH,
} from "../ui/PotionUseButton";

interface PotionPoint {
  x: number;
  y: number;
}

interface PotionHoverDisplacement {
  direction: -1 | 1;
  strength: number;
  centerRatio: number;
  columnRatio: number;
  radiusRatio: number;
}

interface UsePotionUseInteractionParams {
  /** 전투 프레임 DOM ref */
  battleFrameRef: RefObject<HTMLDivElement | null>;
  /** 플레이어 ASCII DOM ref */
  playerAsciiPreRef: RefObject<HTMLPreElement | null>;
  /** 플레이어 ASCII 본문. 스프라이트 크기 변경 시 홈 위치 재계산에 사용한다. */
  playerAsciiText: string;
  /** 포션 사용 가능 여부 */
  potionAvailable: boolean;
  /** 현재 플레이어 체력 */
  playerHp: number;
  /** 현재 플레이어 최대 체력 */
  playerMaxHp: number;
  /** 포션 사용 시 회복량을 반환하는 콜백 */
  onPotionUse: () => number;
  /** 포션이 실제로 소비되었을 때 후속 연출을 트리거한다. */
  onConsumeSuccess: (framePoint: PotionPoint) => void;
  /** 플레이어 hover 시 ASCII 흔들림과 캔버스 활성 상태를 동기화한다. */
  onHoverVisualChange: (payload: {
    hovering: boolean;
    displacement: PotionHoverDisplacement | null;
  }) => void;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pointInsideDomRect(point: PotionPoint, rect: DOMRect, padding = 0): boolean {
  return (
    point.x >= rect.left - padding &&
    point.x <= rect.right + padding &&
    point.y >= rect.top - padding &&
    point.y <= rect.bottom + padding
  );
}

/**
 * 전투 화면의 포션 드래그, hover 판정, drop 후 정착 위치를 관리한다.
 * 시각 연출 자체는 외부 콜백으로 남기고, 포션 상호작용 상태만 feature에서 소유한다.
 */
export function usePotionUseInteraction({
  battleFrameRef,
  playerAsciiPreRef,
  playerAsciiText,
  potionAvailable,
  playerHp,
  playerMaxHp,
  onPotionUse,
  onConsumeSuccess,
  onHoverVisualChange,
}: UsePotionUseInteractionParams) {
  const [potionHomePosition, setPotionHomePosition] = useState<PotionPoint | null>(null);
  const [potionRestPosition, setPotionRestPosition] = useState<PotionPoint | null>(null);
  const [potionDragPosition, setPotionDragPosition] = useState<PotionPoint | null>(null);
  const [potionDragging, setPotionDragging] = useState(false);
  const [potionHovered, setPotionHovered] = useState(false);
  const [potionHoveringPlayer, setPotionHoveringPlayer] = useState(false);

  const potionPointerOffsetRef = useRef<PotionPoint>({ x: 0, y: 0 });
  const potionRestModeRef = useRef<"home" | "dropped">("home");
  const activePotionPointerIdRef = useRef<number | null>(null);

  const pushHoverVisualState = useCallback(
    (hovering: boolean, displacement: PotionHoverDisplacement | null) => {
      setPotionHoveringPlayer((current) => (current === hovering ? current : hovering));
      onHoverVisualChange({
        hovering,
        displacement,
      });
    },
    [onHoverVisualChange],
  );

  const syncPotionHomePosition = useCallback(() => {
    const frame = battleFrameRef.current;
    const playerPre = playerAsciiPreRef.current;
    if (!frame || !playerPre) {
      return;
    }

    const frameRect = frame.getBoundingClientRect();
    const playerRect = playerPre.getBoundingClientRect();
    if (frameRect.width < 1 || frameRect.height < 1 || playerRect.width < 1 || playerRect.height < 1) {
      return;
    }

    const nextHome = {
      x: playerRect.left - frameRect.left + playerRect.width * 0.55 - 50,
      y: playerRect.top - frameRect.top - 150,
    };

    setPotionHomePosition((current) => {
      if (
        current &&
        Math.abs(current.x - nextHome.x) < 0.5 &&
        Math.abs(current.y - nextHome.y) < 0.5
      ) {
        return current;
      }
      return nextHome;
    });

    setPotionRestPosition((current) => {
      if (potionRestModeRef.current === "dropped" && current) {
        return current;
      }
      if (
        current &&
        Math.abs(current.x - nextHome.x) < 0.5 &&
        Math.abs(current.y - nextHome.y) < 0.5
      ) {
        return current;
      }
      return nextHome;
    });
  }, [battleFrameRef, playerAsciiPreRef]);

  useEffect(() => {
    syncPotionHomePosition();

    const frame = window.requestAnimationFrame(syncPotionHomePosition);
    const playerPre = playerAsciiPreRef.current;
    const battleFrame = battleFrameRef.current;
    let observer: ResizeObserver | null = null;

    if ((playerPre || battleFrame) && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        syncPotionHomePosition();
      });
      if (playerPre) {
        observer.observe(playerPre);
      }
      if (battleFrame) {
        observer.observe(battleFrame);
      }
    }

    window.addEventListener("resize", syncPotionHomePosition);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", syncPotionHomePosition);
    };
  }, [battleFrameRef, playerAsciiPreRef, playerAsciiText, potionAvailable, syncPotionHomePosition]);

  const updatePotionHoverState = useCallback(
    (framePoint: PotionPoint) => {
      const frameRect = battleFrameRef.current?.getBoundingClientRect();
      const playerRect = playerAsciiPreRef.current?.getBoundingClientRect();
      if (!frameRect || !playerRect || playerRect.width < 1 || playerRect.height < 1) {
        pushHoverVisualState(false, null);
        return false;
      }

      const viewportPoint = {
        x: frameRect.left + framePoint.x,
        y: frameRect.top + framePoint.y,
      };
      const hovering = pointInsideDomRect(viewportPoint, playerRect, 18);

      if (!hovering) {
        pushHoverVisualState(false, null);
        return false;
      }

      const columnRatio = clamp01((viewportPoint.x - playerRect.left) / playerRect.width);
      const centerRatio = clamp01((viewportPoint.y - playerRect.top) / playerRect.height);
      const centeredX = columnRatio - 0.5;
      const centeredY = centerRatio - 0.44;
      const distance = Math.min(1, Math.hypot(centeredX * 1.45, centeredY * 1.28));

      pushHoverVisualState(true, {
        direction: centeredX <= 0 ? -1 : 1,
        strength: 1.12 + (1 - distance) * 1.06,
        centerRatio,
        columnRatio,
        radiusRatio: 0.22 + (1 - distance) * 0.08,
      });

      return true;
    },
    [battleFrameRef, playerAsciiPreRef, pushHoverVisualState],
  );

  const getClampedPotionFramePoint = useCallback((clientX: number, clientY: number) => {
    const frameRect = battleFrameRef.current?.getBoundingClientRect();
    if (!frameRect) {
      return null;
    }

    const rawX = clientX - frameRect.left - potionPointerOffsetRef.current.x;
    const rawY = clientY - frameRect.top - potionPointerOffsetRef.current.y;

    return {
      x: Math.max(
        POTION_USE_BUTTON_WIDTH * 0.5,
        Math.min(frameRect.width - POTION_USE_BUTTON_WIDTH * 0.5, rawX),
      ),
      y: Math.max(
        POTION_USE_BUTTON_HEIGHT * 0.5,
        Math.min(frameRect.height - POTION_USE_BUTTON_HEIGHT * 0.5, rawY),
      ),
    };
  }, [battleFrameRef]);

  const handlePotionPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!potionAvailable) {
      return;
    }

    const targetRect = event.currentTarget.getBoundingClientRect();
    activePotionPointerIdRef.current = event.pointerId;
    potionPointerOffsetRef.current = {
      x: event.clientX - (targetRect.left + targetRect.width * 0.5),
      y: event.clientY - (targetRect.top + targetRect.height * 0.5),
    };

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPotionDragging(true);

    const nextPoint = getClampedPotionFramePoint(event.clientX, event.clientY);
    if (!nextPoint) {
      return;
    }

    setPotionDragPosition(nextPoint);
    updatePotionHoverState(nextPoint);
  }, [getClampedPotionFramePoint, potionAvailable, updatePotionHoverState]);

  const handlePotionPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!potionDragging || activePotionPointerIdRef.current !== event.pointerId) {
      return;
    }

    const nextPoint = getClampedPotionFramePoint(event.clientX, event.clientY);
    if (!nextPoint) {
      return;
    }

    event.preventDefault();
    setPotionDragPosition(nextPoint);
    updatePotionHoverState(nextPoint);
  }, [getClampedPotionFramePoint, potionDragging, updatePotionHoverState]);

  const finishPotionDrag = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    if (activePotionPointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePotionPointerIdRef.current = null;

    const nextPoint = getClampedPotionFramePoint(event.clientX, event.clientY);
    const hoveringPlayer = cancelled || !nextPoint ? false : updatePotionHoverState(nextPoint);
    let potionConsumed = false;

    if (!cancelled && hoveringPlayer && nextPoint) {
      const healedAmount = onPotionUse();
      if (healedAmount > 0) {
        potionConsumed = true;
        onConsumeSuccess(nextPoint);
      } else if (playerHp >= playerMaxHp && potionHomePosition) {
        potionRestModeRef.current = "home";
        setPotionRestPosition(potionHomePosition);
      }
    }

    if (!potionConsumed && nextPoint) {
      if (!(hoveringPlayer && playerHp >= playerMaxHp && potionHomePosition)) {
        potionRestModeRef.current = "dropped";
        setPotionRestPosition(nextPoint);
      }
    }

    pushHoverVisualState(false, null);
    setPotionHovered(false);
    setPotionDragging(false);
    setPotionDragPosition(null);
  }, [
    getClampedPotionFramePoint,
    onConsumeSuccess,
    onPotionUse,
    playerHp,
    playerMaxHp,
    potionHomePosition,
    pushHoverVisualState,
    updatePotionHoverState,
  ]);

  const handlePotionPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    finishPotionDrag(event, false);
  }, [finishPotionDrag]);

  const handlePotionPointerCancel = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    finishPotionDrag(event, true);
  }, [finishPotionDrag]);

  const activePotionPosition = useMemo(() => (
    potionDragging
      ? potionDragPosition ?? potionRestPosition ?? potionHomePosition
      : potionRestPosition ?? potionHomePosition
  ), [potionDragPosition, potionDragging, potionHomePosition, potionRestPosition]);

  return {
    activePotionPosition,
    handlePotionHoverEnd: () => setPotionHovered(false),
    handlePotionHoverStart: () => setPotionHovered(true),
    handlePotionPointerCancel,
    handlePotionPointerDown,
    handlePotionPointerMove,
    handlePotionPointerUp,
    potionDragging,
    potionHovered,
    potionHoveringPlayer,
  };
}
