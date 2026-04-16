import { useEffect, useRef } from "react";

type ParticleTone = "health" | "mana";

interface ResourceChargeBurstProps {
  triggerValue: number;
  particleCount?: number;
  width?: number;
  height?: number;
  tone?: ParticleTone;
}

interface ChargeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  size: number;
}

const CHARGE_CHARS = ["·", "*", "◦", ".", "°"];

function buildParticleColor(tone: ParticleTone): string {
  if (tone === "mana") {
    return `rgba(${70 + Math.random() * 40}, ${135 + Math.random() * 70}, ${220 + Math.random() * 35}, 1)`;
  }

  return `rgba(${200 + Math.random() * 55}, ${40 + Math.random() * 60}, ${40 + Math.random() * 40}, 1)`;
}

function spawnChargeParticles(
  width: number,
  height: number,
  particleCount: number,
  tone: ParticleTone,
): ChargeParticle[] {
  const particles: ChargeParticle[] = [];
  const centerX = width * 0.5;
  const centerY = height * 0.45;
  const minSize = Math.min(width, height);
  // Keep the resource effect inside the widget footprint instead of using scene-sized radii.
  const minDistance = minSize * 0.18;
  const maxDistance = minSize * 0.36;
  const minGlyphSize = Math.max(5, minSize * 0.06);
  const maxGlyphSize = Math.max(minGlyphSize + 2, minSize * 0.1);

  for (let index = 0; index < particleCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);

    particles.push({
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      char: CHARGE_CHARS[Math.floor(Math.random() * CHARGE_CHARS.length)],
      color: buildParticleColor(tone),
      alpha: 0.8,
      life: 0,
      maxLife: 60 + Math.random() * 30,
      size: minGlyphSize + Math.random() * (maxGlyphSize - minGlyphSize),
    });
  }

  return particles;
}

export default function ResourceChargeBurst({
  triggerValue,
  particleCount = 20,
  width = 220,
  height = 220,
  tone = "health",
}: ResourceChargeBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevTriggerRef = useRef(triggerValue);
  const particlesRef = useRef<ChargeParticle[]>([]);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * devicePixelRatio);
    canvas.height = Math.round(height * devicePixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
  }, [height, width]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (triggerValue === prevTriggerRef.current) {
      return;
    }

    prevTriggerRef.current = triggerValue;
    particlesRef.current = [
      ...particlesRef.current,
      ...spawnChargeParticles(width, height, particleCount, tone),
    ];

    if (frameRef.current !== null) {
      return;
    }

    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        frameRef.current = null;
        return;
      }

      const step = lastFrameTimeRef.current === 0
        ? 1
        : Math.min((now - lastFrameTimeRef.current) / 16.6667, 2.4);
      lastFrameTimeRef.current = now;

      const centerX = width * 0.5;
      const centerY = height * 0.45;
      context.clearRect(0, 0, width, height);

      particlesRef.current = particlesRef.current.filter((particle) => {
        // Reuse the same inward-pull plus orbital drift pattern as the monster charge effect,
        // but constrain it to a resource-sized local canvas.
        particle.life += step;
        if (particle.life > particle.maxLife) {
          return false;
        }

        const lifeRatio = Math.min(particle.life / particle.maxLife, 1);
        const dx = centerX - particle.x;
        const dy = centerY - particle.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const pullStrength = (0.02 + lifeRatio * 0.06) * step;
        const orbitStrength = 0.3 * step;
        const damping = Math.pow(0.96, step);

        if (distance > 2) {
          particle.vx += (dx / distance) * pullStrength;
          particle.vy += (dy / distance) * pullStrength;
          particle.vx += (-dy / distance) * orbitStrength;
          particle.vy += (dx / distance) * orbitStrength;
          particle.vx *= damping;
          particle.vy *= damping;
        }

        particle.x += particle.vx * step;
        particle.y += particle.vy * step;

        const alpha = lifeRatio > 0.6
          ? particle.alpha * (1 - (lifeRatio - 0.6) / 0.4)
          : particle.alpha;

        if (alpha <= 0) {
          return false;
        }

        context.save();
        context.globalAlpha = alpha;
        context.font = `bold ${particle.size}px 'Courier New', monospace`;
        context.fillStyle = particle.color;
        context.shadowColor = particle.color;
        context.shadowBlur = 8;
        context.fillText(particle.char, particle.x, particle.y);
        context.restore();
        return true;
      });

      if (particlesRef.current.length === 0) {
        context.clearRect(0, 0, width, height);
        frameRef.current = null;
        lastFrameTimeRef.current = 0;
        return;
      }

      frameRef.current = requestAnimationFrame(renderFrame);
    };

    frameRef.current = requestAnimationFrame(renderFrame);
  }, [height, particleCount, tone, triggerValue, width]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute left-1/2 top-1/2 z-[4] -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    />
  );
}