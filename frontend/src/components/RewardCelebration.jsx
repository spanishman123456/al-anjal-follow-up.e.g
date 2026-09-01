import { useEffect, useRef } from "react";
import { Award, PartyPopper, Sparkles, Star } from "lucide-react";
import "@/reward-celebration.css";

const COLORS = ["#facc15", "#fb7185", "#a855f7", "#22d3ee", "#34d399", "#f97316", "#60a5fa"];

function createParticle(width, height, origin, burstIndex, index) {
  const sideBurst = burstIndex > 0;
  const fromLeft = burstIndex === 1;
  const x = sideBurst ? (fromLeft ? width * 0.04 : width * 0.96) : origin.x * width;
  const y = sideBurst ? height * 0.78 : origin.y * height;
  const angle = sideBurst
    ? (fromLeft ? -Math.PI * (0.18 + Math.random() * 0.42) : -Math.PI * (0.4 + Math.random() * 0.42))
    : Math.random() * Math.PI * 2;
  const speed = sideBurst ? 11 + Math.random() * 12 : 8 + Math.random() * 14;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - (sideBurst ? 5 : 2),
    gravity: 0.19 + Math.random() * 0.12,
    drag: 0.982 + Math.random() * 0.009,
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.32,
    size: 5 + Math.random() * 9,
    color: COLORS[(index + burstIndex * 2) % COLORS.length],
    shape: index % 11 === 0 ? "ribbon" : index % 9 === 0 ? "star" : index % 5 === 0 ? "circle" : "strip",
    wobble: Math.random() * Math.PI * 2,
    life: 0,
    maxLife: 125 + Math.random() * 65,
  };
}

function drawStar(context, x, y, radius) {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const distance = point % 2 === 0 ? radius : radius * 0.43;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    if (point === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
}

function paintParticle(context, particle) {
  context.save();
  context.translate(particle.x, particle.y);
  context.rotate(particle.rotation);
  context.fillStyle = particle.color;
  if (particle.shape === "ribbon") {
    context.strokeStyle = particle.color;
    context.lineWidth = Math.max(2.2, particle.size * 0.32);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-particle.size, -particle.size * 0.55);
    context.bezierCurveTo(
      -particle.size * 0.35, particle.size,
      particle.size * 0.35, -particle.size,
      particle.size, particle.size * 0.55,
    );
    context.stroke();
  } else if (particle.shape === "star") {
    drawStar(context, 0, 0, particle.size);
  } else if (particle.shape === "circle") {
    context.beginPath();
    context.arc(0, 0, particle.size * 0.55, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillRect(-particle.size / 2, -particle.size * 0.24, particle.size, particle.size * 0.48);
  }
  context.restore();
}

export function RewardCelebration({ celebration, title, subtitle }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!celebration?.id) return undefined;
    const canvas = canvasRef.current;
    const context = canvas?.getContext?.("2d");
    if (!canvas || !context) return undefined;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let animationFrame;
    let stopped = false;
    let particles = [];
    const timers = [];
    const origin = celebration.origin || { x: 0.5, y: 0.38 };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const addBurst = (burstIndex, count) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      particles = particles.concat(
        Array.from({ length: count }, (_, index) => createParticle(width, height, origin, burstIndex, index)),
      );
    };

    const animate = () => {
      if (stopped) return;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles = particles.filter((particle) => {
        particle.life += 1;
        particle.vx *= particle.drag;
        particle.vy = particle.vy * particle.drag + particle.gravity;
        particle.wobble += 0.11;
        particle.x += particle.vx + Math.sin(particle.wobble) * 0.7;
        particle.y += particle.vy;
        particle.rotation += particle.rotationSpeed;
        const alpha = Math.min(1, (particle.maxLife - particle.life) / 24);
        context.globalAlpha = Math.max(0, alpha);
        paintParticle(context, particle);
        return particle.life < particle.maxLife && particle.y < window.innerHeight + 50;
      });
      context.globalAlpha = 1;
      if (particles.length) animationFrame = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    addBurst(0, reducedMotion ? 36 : 110);
    if (!reducedMotion) {
      addBurst(1, 58);
      addBurst(2, 58);
      timers.push(window.setTimeout(() => addBurst(0, 76), 360));
      timers.push(window.setTimeout(() => addBurst(1, 45), 720));
      timers.push(window.setTimeout(() => addBurst(2, 45), 780));
    }
    animate();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(animationFrame);
      timers.forEach(window.clearTimeout);
      window.removeEventListener("resize", resize);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [celebration]);

  if (!celebration?.id) return null;
  return (
    <div className="reward-celebration" aria-live="polite" data-testid="reward-celebration">
      <canvas ref={canvasRef} className="reward-celebration-canvas" aria-hidden="true" />
      <PartyPopper className="reward-cannon reward-cannon-start" aria-hidden="true" />
      <PartyPopper className="reward-cannon reward-cannon-end" aria-hidden="true" />
      <div className="reward-celebration-banner" dir={celebration.dir || "auto"}>
        <span className="reward-celebration-orbit" aria-hidden="true"><Star /></span>
        <span className="reward-celebration-icon" aria-hidden="true"><Award /></span>
        <p className="reward-celebration-title"><Sparkles />{title}<Sparkles /></p>
        <strong>{celebration.studentName}</strong>
        <p className="reward-celebration-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
