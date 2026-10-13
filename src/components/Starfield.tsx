"use client";

import { useEffect, useRef } from "react";

interface P {
  x: number;
  y: number;
  z: number;
  r: number;
  hue: number;
}

/** Drifting particle field with subtle mouse parallax. */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const particles: P[] = [];
    const mouse = { x: 0.5, y: 0.34 };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = () => {
      particles.length = 0;
      const count = Math.min(170, Math.floor((w * h) / 11000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: 0.25 + Math.random() * 0.75,
          r: 0.5 + Math.random() * 1.5,
          hue: Math.random() < 0.12 ? 190 : Math.random() < 0.5 ? 225 : 265,
        });
      }
    };

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX / w;
      mouse.y = e.clientY / h;
    };

    let t = 0;
    const draw = () => {
      t += 0.0026;
      ctx.clearRect(0, 0, w, h);
      const px = (mouse.x - 0.5) * 22;
      const py = (mouse.y - 0.5) * 16;
      for (const p of particles) {
        p.y -= 0.045 * p.z;
        p.x += Math.sin(t * 2 + p.y * 0.01) * 0.03;
        if (p.y < -4) {
          p.y = h + 4;
          p.x = Math.random() * w;
        }
        const tw = 0.55 + 0.45 * Math.sin(t * 6 + p.x * 0.05 + p.y * 0.03);
        ctx.beginPath();
        ctx.arc(p.x + px * p.z, p.y + py * p.z, p.r * p.z, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 85%, 74%, ${0.09 + 0.33 * tw * p.z})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    spawn();
    draw();
    window.addEventListener("resize", () => {
      resize();
      spawn();
    });
    window.addEventListener("mousemove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-80"
    />
  );
}
