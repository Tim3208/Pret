import { type MutableRefObject, useEffect } from "react";
import type { BattleLogEntry } from "@/entities/combat";
import type { MonsterIntent } from "@/entities/monster";
import type {
  LiveAsciiDisplacementState,
  MonsterAsciiCanvasMetrics,
} from "../lib/core";
import {
  BASE_FONT_SIZE,
  DISPLACE_RADIUS,
  H,
  LINE_H,
  SCENE_H,
  SCENE_W,
  W,
  clamp01,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  mapScenePointToConsolePoint,
  sampleQuadraticPoint,
  sampleQuadraticTangent,
} from "../lib/core";
import {
  CRT_FONT,
  classToCanvasColor,
  drawAsciiConsoleFrame,
  drawAsciiConsoleRule,
  getProjectileTone,
  getProjectileVisual,
  makeFont,
  renderConsolePulse,
  renderIntentSparks,
  renderLiveAsciiDisplacementCanvas,
  renderMonsterAsciiImpactCanvas,
  renderOverlayEffects,
  renderTextBlockPhysics,
} from "../lib/visuals";
import type {
  ConsolePulse,
  EffectParticle,
  ForceField,
  MonsterAsciiImpactState,
  MonsterAsciiRenderState,
  PlayerAsciiRenderState,
  Projectile,
  SlashSample,
  SlashWave,
  SpriteEffect,
} from "./battleStageScene.types";

interface SlashField {
  points: SlashSample[];
  intensity: number;
  thickness: number;
  strength: number;
  alphaLoss: number;
}

interface BattleStageTextSnapshot {
  nextIntent: MonsterIntent;
  nextIntentLabel: string;
  monsterShield: number;
  ambientText: string;
  battleLog: BattleLogEntry[];
  monsterHp: number;
  turn: "player" | "monster";
  shieldLabel: string;
}

interface UseBattleStageCanvasLoopParams {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  sceneFxCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  monsterAsciiCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  monsterIntentOverlayRef: MutableRefObject<HTMLCanvasElement | null>;
  monsterOverlayRef: MutableRefObject<HTMLCanvasElement | null>;
  playerAsciiCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  playerOverlayRef: MutableRefObject<HTMLCanvasElement | null>;
  effectsRef: MutableRefObject<SpriteEffect[]>;
  forceFieldsRef: MutableRefObject<ForceField[]>;
  intentSparksRef: MutableRefObject<EffectParticle[]>;
  lastIntentSparkFrameRef: MutableRefObject<number>;
  monsterAsciiMetricsRef: MutableRefObject<MonsterAsciiCanvasMetrics | null>;
  monsterAsciiRenderRef: MutableRefObject<MonsterAsciiRenderState>;
  monsterImpactRef: MutableRefObject<MonsterAsciiImpactState | null>;
  playerAsciiMetricsRef: MutableRefObject<MonsterAsciiCanvasMetrics | null>;
  playerAsciiRenderRef: MutableRefObject<PlayerAsciiRenderState>;
  playerPotionDisplacementRef: MutableRefObject<LiveAsciiDisplacementState | null>;
  projectilesRef: MutableRefObject<Projectile[]>;
  rafRef: MutableRefObject<number>;
  sceneScatterRef: MutableRefObject<EffectParticle[]>;
  slashesRef: MutableRefObject<SlashWave[]>;
  textRef: MutableRefObject<BattleStageTextSnapshot>;
  consolePulsesRef: MutableRefObject<ConsolePulse[]>;
}

/**
 * 전투 장면의 RAF 기반 canvas 렌더 루프를 관리한다.
 * `BattleStage`에는 상태와 DOM 배치만 남기고, 반복 렌더링과 입자/투사체 오케스트레이션은 이 훅으로 분리한다.
 */
export function useBattleStageCanvasLoop({
  canvasRef,
  sceneFxCanvasRef,
  monsterAsciiCanvasRef,
  monsterIntentOverlayRef,
  monsterOverlayRef,
  playerAsciiCanvasRef,
  playerOverlayRef,
  effectsRef,
  forceFieldsRef,
  intentSparksRef,
  lastIntentSparkFrameRef,
  monsterAsciiMetricsRef,
  monsterAsciiRenderRef,
  monsterImpactRef,
  playerAsciiMetricsRef,
  playerAsciiRenderRef,
  playerPotionDisplacementRef,
  projectilesRef,
  rafRef,
  sceneScatterRef,
  slashesRef,
  textRef,
  consolePulsesRef,
}: UseBattleStageCanvasLoopParams) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const sceneFxCanvas = sceneFxCanvasRef.current;
    const sceneFxCtx = sceneFxCanvas?.getContext("2d") ?? null;

    canvas.width = W;
    canvas.height = H;
    if (sceneFxCanvas) {
      sceneFxCanvas.width = SCENE_W;
      sceneFxCanvas.height = SCENE_H;
    }

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      sceneFxCtx?.clearRect(0, 0, SCENE_W, SCENE_H);

      const sceneRect = sceneFxCanvas?.getBoundingClientRect() ?? null;
      const consoleRect = canvas.getBoundingClientRect();
      const canProjectToConsole =
        !!sceneRect &&
        sceneRect.width > 0 &&
        sceneRect.height > 0 &&
        consoleRect.width > 0 &&
        consoleRect.height > 0;

      const {
        nextIntent: intent,
        nextIntentLabel: intentLabel,
        monsterShield: monsterShield,
        ambientText,
        battleLog,
        monsterHp,
        turn,
        shieldLabel,
      } = textRef.current;
      const projectiles = projectilesRef.current;
      const slashes = slashesRef.current;
      const forceFields = forceFieldsRef.current;
      const now = performance.now();
      const intentSparkFrameDuration = 1000 / 12;
      const advanceIntentSparkFrame =
        now - lastIntentSparkFrameRef.current >= intentSparkFrameDuration;

      if (advanceIntentSparkFrame) {
        lastIntentSparkFrameRef.current = now;
      }

      const activeSlashFields: SlashField[] = [];
      const activeSlashRender: Array<{
        slash: SlashWave;
        visiblePoints: SlashSample[];
        intensity: number;
        sweep: number;
      }> = [];
      const torchFlicker = Math.max(
        0.58,
        Math.min(
          0.94,
          0.76 +
            Math.sin(now * 0.0042) * 0.08 +
            Math.sin(now * 0.0018 + 1.4) * 0.05,
        ),
      );
      const torchInk = 0.08 + torchFlicker * 0.16;

      forceFieldsRef.current = forceFields.filter(
        (forceField) => now - forceField.startTime < forceField.duration,
      );

      for (const slash of slashes) {
        if (!slash.alive) {
          continue;
        }

        const elapsed = now - slash.startTime;
        const totalDuration = slash.duration + slash.recoveryDuration;
        if (elapsed > totalDuration) {
          slash.alive = false;
          continue;
        }

        const sweep = clamp01(elapsed / slash.duration);
        const recover =
          elapsed <= slash.duration
            ? 0
            : clamp01((elapsed - slash.duration) / slash.recoveryDuration);
        const intensity =
          sweep < 1
            ? 0.18 + easeOutCubic(sweep) * 0.82
            : 1 - easeOutCubic(easeInOutCubic(recover));
        const visiblePoints = slash.points.filter(
          (point) => point.t <= Math.max(0.08, sweep),
        );

        activeSlashFields.push({
          points: visiblePoints,
          intensity: intensity * (slash.blocked ? 0.72 : 1),
          thickness: slash.blocked ? 26.4 : 35.4,
          strength: slash.blocked ? 21 : 30,
          alphaLoss: slash.blocked ? 0.3 : 0.5,
        });
        activeSlashRender.push({ slash, visiblePoints, intensity, sweep });

        if (!slash.impactTriggered && sweep >= 0.72) {
          slash.impactTriggered = true;
          slash.onImpact?.();
        }
      }

      slashesRef.current = slashes.filter((slash) => slash.alive);

      ctx.font = makeFont(560, BASE_FONT_SIZE);
      ctx.textBaseline = "top";
      const frame = drawAsciiConsoleFrame(
        ctx,
        `rgba(214, 184, 124, ${(0.24 + torchFlicker * 0.16).toFixed(2)})`,
      );

      ctx.font = CRT_FONT;
      const consoleCharWidth = ctx.measureText("M").width;

      const consolePulses = consolePulsesRef.current.filter(
        (pulse) => now - pulse.startTime < pulse.duration,
      );
      consolePulsesRef.current = consolePulses;
      const consoleInnerStartX = frame.startX + consoleCharWidth * 2;
      const consoleInnerWidth = consoleCharWidth * Math.max(1, frame.cols - 4);
      const textBounds = {
        startX: consoleInnerStartX,
        maxWidth: consoleInnerWidth,
        lineHeight: LINE_H,
      };
      const consoleProjectiles: Projectile[] = [];
      const projectileRenderState: Array<{
        projectile: Projectile;
        angle: number;
        progress: number;
        travel: number;
      }> = [];

      for (const projectile of projectiles) {
        if (!projectile.alive) {
          continue;
        }

        const progress = clamp01(
          (now - projectile.startTime) / projectile.duration,
        );
        const hasReturnTurn =
          projectile.turnX !== undefined && projectile.turnY !== undefined;
        const travel = hasReturnTurn
          ? progress
          : projectile.controlX !== undefined &&
              projectile.controlY !== undefined
            ? easeInOutCubic(progress)
            : easeInCubic(progress);
        const basePoint = hasReturnTurn
          ? (() => {
              const split = 0.54;
              if (travel <= split) {
                const outbound = easeOutCubic(travel / split);
                return sampleQuadraticPoint(
                  { x: projectile.startX, y: projectile.startY },
                  {
                    x: projectile.startX + (projectile.turnX! - projectile.startX) * 0.78,
                    y:
                      Math.min(projectile.startY, projectile.turnY!) -
                      SCENE_H * 0.035,
                  },
                  { x: projectile.turnX!, y: projectile.turnY! },
                  outbound,
                );
              }

              const returning = easeInOutCubic((travel - split) / (1 - split));
              return sampleQuadraticPoint(
                { x: projectile.turnX!, y: projectile.turnY! },
                {
                  x:
                    projectile.controlX ??
                    projectile.turnX! + (projectile.targetX - projectile.turnX!) * 0.35,
                  y:
                    projectile.controlY ??
                    projectile.turnY! + (projectile.targetY - projectile.turnY!) * 0.45,
                },
                { x: projectile.targetX, y: projectile.targetY },
                returning,
              );
            })()
          : projectile.controlX !== undefined &&
              projectile.controlY !== undefined
            ? sampleQuadraticPoint(
                { x: projectile.startX, y: projectile.startY },
                { x: projectile.controlX, y: projectile.controlY },
                { x: projectile.targetX, y: projectile.targetY },
                travel,
              )
            : {
                x:
                  projectile.startX +
                  (projectile.targetX - projectile.startX) * travel,
                y:
                  projectile.startY +
                  (projectile.targetY - projectile.startY) * travel,
              };
        const tangent = hasReturnTurn
          ? (() => {
              const split = 0.54;
              if (travel <= split) {
                const outbound = easeOutCubic(travel / split);
                return sampleQuadraticTangent(
                  { x: projectile.startX, y: projectile.startY },
                  {
                    x: projectile.startX + (projectile.turnX! - projectile.startX) * 0.78,
                    y:
                      Math.min(projectile.startY, projectile.turnY!) -
                      SCENE_H * 0.035,
                  },
                  { x: projectile.turnX!, y: projectile.turnY! },
                  outbound,
                );
              }

              const returning = easeInOutCubic((travel - split) / (1 - split));
              return sampleQuadraticTangent(
                { x: projectile.turnX!, y: projectile.turnY! },
                {
                  x:
                    projectile.controlX ??
                    projectile.turnX! + (projectile.targetX - projectile.turnX!) * 0.35,
                  y:
                    projectile.controlY ??
                    projectile.turnY! + (projectile.targetY - projectile.turnY!) * 0.45,
                },
                { x: projectile.targetX, y: projectile.targetY },
                returning,
              );
            })()
          : projectile.controlX !== undefined &&
              projectile.controlY !== undefined
            ? sampleQuadraticTangent(
                { x: projectile.startX, y: projectile.startY },
                { x: projectile.controlX, y: projectile.controlY },
                { x: projectile.targetX, y: projectile.targetY },
                travel,
              )
            : {
                x: projectile.targetX - projectile.startX,
                y: projectile.targetY - projectile.startY,
              };
        const angle = Math.atan2(tangent.y, tangent.x);

        projectile.x = basePoint.x;
        projectile.y = basePoint.y;
        projectile.offsets.forEach((offset) => {
          offset.dx = 0;
          offset.dy = 0;
          offset.rot = 0;
        });

        projectileRenderState.push({ projectile, angle, progress, travel });

        if (!canProjectToConsole || !sceneRect) {
          continue;
        }

        const consolePoint = mapScenePointToConsolePoint(
          { x: projectile.x, y: projectile.y },
          sceneRect,
          consoleRect,
        );
        if (
          consolePoint.x >= -DISPLACE_RADIUS &&
          consolePoint.x <= W + DISPLACE_RADIUS &&
          consolePoint.y >= -DISPLACE_RADIUS &&
          consolePoint.y <= H + DISPLACE_RADIUS
        ) {
          consoleProjectiles.push({
            ...projectile,
            x: consolePoint.x,
            y: consolePoint.y,
          });
        }
      }

      let y = frame.topY + LINE_H + 14;

      y = renderTextBlockPhysics(
        ctx,
        `> ${intentLabel}`,
        `rgba(255, 170, 60, ${(0.72 + torchFlicker * 0.14).toFixed(2)})`,
        y,
        consoleProjectiles,
        forceFields,
        activeSlashFields,
        { fontWeight: 700, inkBleed: 0.22 + torchInk },
        textBounds,
      );
      y += 4;

      if (monsterShield > 0) {
        y = renderTextBlockPhysics(
          ctx,
          `  [${shieldLabel}: ${monsterShield}]`,
          "rgba(100, 180, 255, 0.68)",
          y,
          consoleProjectiles,
          forceFields,
          activeSlashFields,
          { fontWeight: 620, inkBleed: 0.08 + torchInk * 0.28 },
          textBounds,
        );
      }

      y = renderTextBlockPhysics(
        ctx,
        ambientText,
        `rgba(180, 180, 180, ${(0.4 + torchFlicker * 0.08).toFixed(2)})`,
        y,
        consoleProjectiles,
        forceFields,
        activeSlashFields,
        { fontWeight: 430, inkBleed: 0.03 + torchInk * 0.15 },
        textBounds,
      );
      y += 4;

      drawAsciiConsoleRule(
        ctx,
        y,
        frame,
        `rgba(255, 255, 255, ${(0.12 + torchFlicker * 0.04).toFixed(2)})`,
      );
      y += 8;

      const maxLogLines = Math.floor((frame.bottomY - y - 8) / LINE_H);
      const visibleLog = battleLog.slice(-maxLogLines);

      for (let entryIndex = 0; entryIndex < visibleLog.length; entryIndex += 1) {
        const entry = visibleLog[entryIndex];
        const recency =
          visibleLog.length <= 1
            ? 1
            : entryIndex / (visibleLog.length - 1);
        ctx.font = CRT_FONT;
        y = renderTextBlockPhysics(
          ctx,
          entry.text,
          classToCanvasColor(entry.color),
          y,
          consoleProjectiles,
          forceFields,
          activeSlashFields,
          {
            fontWeight: 480 + recency * 180,
            inkBleed: 0.03 + recency * 0.12 + torchInk * 0.25,
          },
          textBounds,
        );
      }

      for (const { slash, visiblePoints, intensity, sweep } of activeSlashRender) {
        ctx.save();
        ctx.font = "bold 18px 'Courier New', monospace";
        ctx.shadowBlur = 18;
        ctx.shadowColor = slash.blocked
          ? "rgba(140, 210, 255, 0.4)"
          : "rgba(255, 240, 240, 0.42)";

        for (let index = 0; index < visiblePoints.length; index += 1) {
          const point = visiblePoints[index];
          const localWidth = (6 + point.t * 26) * intensity;
          const bandCount = Math.max(1, Math.round(localWidth / 6));

          for (let band = -bandCount; band <= bandCount; band += 1) {
            const bandT = bandCount === 0 ? 0 : band / bandCount;
            const edgeWeight = 1 - Math.abs(bandT);
            const ripple =
              Math.sin(now * 0.014 + index * 0.42 + band * 0.7) *
              (2.1 + edgeWeight * 1.4);
            const offsetX = point.nx * bandT * localWidth;
            const offsetY = point.ny * bandT * localWidth * 0.94;
            const char =
              Math.abs(band) === bandCount
                ? band < 0
                  ? "/"
                  : "\\"
                : edgeWeight > 0.6
                  ? "#"
                  : edgeWeight > 0.32
                    ? "="
                    : "-";
            const alpha = Math.min(
              0.92,
              (0.12 + intensity * 0.76) *
                (0.28 + point.t * 0.72) *
                (0.34 + edgeWeight * 0.66),
            );
            ctx.fillStyle = slash.blocked
              ? `rgba(150, 215, 255, ${alpha.toFixed(2)})`
              : `rgba(255, 238, 238, ${alpha.toFixed(2)})`;
            ctx.fillText(
              char,
              point.x + offsetX + point.nx * ripple,
              point.y + offsetY + point.ny * ripple * 0.85,
            );
          }
        }

        const head = visiblePoints[visiblePoints.length - 1];
        if (head && sweep > 0.3) {
          const label = slash.label.slice(0, 6).split("");
          ctx.font = "bold 14px 'Courier New', monospace";
          for (let index = 0; index < label.length; index += 1) {
            const trail = index / Math.max(1, label.length - 1);
            ctx.fillStyle = slash.blocked
              ? `rgba(170, 220, 255, ${(0.24 + intensity * 0.28).toFixed(2)})`
              : `rgba(255, 255, 255, ${(0.22 + intensity * 0.32).toFixed(2)})`;
            ctx.fillText(
              label[index],
              head.x - index * 12 + head.nx * (12 + trail * 8),
              head.y - index * 6 + head.ny * (10 + trail * 6),
            );
          }
        }

        ctx.restore();
      }

      for (const pulse of consolePulses) {
        renderConsolePulse(ctx, frame, consoleCharWidth, pulse, now);
      }

      for (const { projectile, angle, progress, travel } of projectileRenderState) {
        if (!projectile.alive) {
          continue;
        }

        if (sceneFxCtx) {
          const projectileTone = getProjectileTone(
            projectile.element,
            projectile.critical,
          );
          const projectileVisual = getProjectileVisual(projectileTone);
          const criticalScaleBoost = projectile.critical ? 1.34 : 1;
          const projectileScale =
            (1.06 + (0.82 - 1.06) * travel) * criticalScaleBoost;
          const trailSpacing =
            (16 + (12.5 - 16) * travel) * (projectile.critical ? 1.14 : 1);
          const glowBlur =
            (22 + (15 - 22) * travel) * (projectile.critical ? 1.42 : 1);
          sceneFxCtx.save();
          sceneFxCtx.font = `bold ${Math.round(24 * projectileScale)}px 'Courier New', monospace`;
          sceneFxCtx.fillStyle = projectileVisual.fill;
          sceneFxCtx.shadowColor = projectileVisual.shadow;
          sceneFxCtx.shadowBlur = glowBlur;

          for (let index = 0; index < projectile.chars.length; index += 1) {
            const along = -(projectile.chars.length - 1 - index) * trailSpacing;
            sceneFxCtx.save();
            sceneFxCtx.translate(
              projectile.x + Math.cos(angle) * along,
              projectile.y + Math.sin(angle) * along,
            );
            sceneFxCtx.rotate(angle * 0.12);
            sceneFxCtx.scale(projectileScale, projectileScale);
            sceneFxCtx.fillText(projectile.chars[index], 0, 0);
            sceneFxCtx.restore();
          }

          const headChar = projectile.blocked ? "#" : projectileVisual.head;
          sceneFxCtx.globalAlpha =
            (0.26 + Math.sin(travel * Math.PI) * 0.38) *
            (projectile.missed ? 0.86 : 1);
          sceneFxCtx.save();
          sceneFxCtx.translate(
            projectile.x + Math.cos(angle) * 8,
            projectile.y + Math.sin(angle) * 8,
          );
          sceneFxCtx.scale(
            projectileScale * (projectile.critical ? 1.22 : 1.12),
            projectileScale * (projectile.critical ? 1.22 : 1.12),
          );
          sceneFxCtx.font = "bold 32px 'Courier New', monospace";
          sceneFxCtx.fillText(headChar, 0, 0);
          sceneFxCtx.restore();
          sceneFxCtx.restore();
        }

        if (!projectile.impactTriggered && progress >= 1) {
          projectile.impactTriggered = true;
          projectile.onImpact?.();
          projectile.alive = false;
        }
      }

      projectilesRef.current = projectiles.filter((projectile) => projectile.alive);

      const scatter = sceneScatterRef.current;
      for (let index = scatter.length - 1; index >= 0; index -= 1) {
        const particle = scatter[index];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.94;
        particle.vy *= 0.94;
        particle.life += 1;
        if (particle.life > particle.maxLife) {
          scatter.splice(index, 1);
          continue;
        }
        if (!sceneFxCtx) {
          continue;
        }

        const ratio = particle.life / particle.maxLife;
        const fade = ratio > 0.45 ? 1 - (ratio - 0.45) / 0.55 : 1;
        sceneFxCtx.save();
        sceneFxCtx.globalAlpha = fade * particle.alpha;
        sceneFxCtx.font = `bold ${particle.size}px 'Courier New', monospace`;
        sceneFxCtx.fillStyle = particle.color;
        sceneFxCtx.shadowColor = particle.color;
        sceneFxCtx.shadowBlur = 10;
        sceneFxCtx.fillText(particle.char, particle.x, particle.y);
        sceneFxCtx.restore();
      }

      const playerAsciiCanvas = playerAsciiCanvasRef.current;
      if (playerAsciiCanvas) {
        const playerAsciiCtx = playerAsciiCanvas.getContext("2d");
        if (playerAsciiCtx) {
          renderLiveAsciiDisplacementCanvas(
            playerAsciiCtx,
            playerAsciiCanvas,
            playerAsciiMetricsRef.current,
            playerAsciiRenderRef.current.glyphs,
            playerPotionDisplacementRef.current,
            "rgba(244, 244, 244, 0.98)",
            playerAsciiRenderRef.current.glyphColors,
            now,
          );
        }
      }

      const monsterAsciiCanvas = monsterAsciiCanvasRef.current;
      if (monsterAsciiCanvas) {
        const monsterAsciiCtx = monsterAsciiCanvas.getContext("2d");
        if (monsterAsciiCtx) {
          renderMonsterAsciiImpactCanvas(
            monsterAsciiCtx,
            monsterAsciiCanvas,
            monsterAsciiMetricsRef.current,
            monsterAsciiRenderRef.current.glyphs,
            monsterImpactRef.current,
            monsterAsciiRenderRef.current.tone,
            now,
          );
        }
      }

      const effects = effectsRef.current;
      const playerOverlay = playerOverlayRef.current;
      const monsterOverlay = monsterOverlayRef.current;
      const monsterIntentOverlay = monsterIntentOverlayRef.current;

      if (playerOverlay) {
        const playerOverlayContext = playerOverlay.getContext("2d");
        if (playerOverlayContext) {
          renderOverlayEffects(
            playerOverlayContext,
            effects,
            "player",
            playerOverlay.width,
            playerOverlay.height,
          );
        }
      }

      if (monsterOverlay) {
        const monsterOverlayContext = monsterOverlay.getContext("2d");
        if (monsterOverlayContext) {
          renderOverlayEffects(
            monsterOverlayContext,
            effects,
            "monster",
            monsterOverlay.width,
            monsterOverlay.height,
          );
        }
      }

      if (monsterIntentOverlay) {
        const intentContext = monsterIntentOverlay.getContext("2d");
        if (intentContext) {
          intentContext.clearRect(
            0,
            0,
            monsterIntentOverlay.width,
            monsterIntentOverlay.height,
          );
          renderIntentSparks(
            intentContext,
            intentSparksRef.current,
            now,
            intent,
            turn === "player" && monsterHp > 0,
            advanceIntentSparkFrame,
            monsterIntentOverlay.width,
            monsterIntentOverlay.height,
          );
        }
      }

      effectsRef.current = effects.filter(
        (effect) => now - effect.startTime < effect.duration,
      );

      rafRef.current = window.requestAnimationFrame(animate);
    };

    rafRef.current = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [
    canvasRef,
    consolePulsesRef,
    effectsRef,
    forceFieldsRef,
    intentSparksRef,
    lastIntentSparkFrameRef,
    monsterAsciiCanvasRef,
    monsterAsciiMetricsRef,
    monsterAsciiRenderRef,
    monsterImpactRef,
    monsterIntentOverlayRef,
    monsterOverlayRef,
    playerAsciiCanvasRef,
    playerAsciiMetricsRef,
    playerAsciiRenderRef,
    playerOverlayRef,
    playerPotionDisplacementRef,
    projectilesRef,
    rafRef,
    sceneFxCanvasRef,
    sceneScatterRef,
    slashesRef,
    textRef,
  ]);
}
