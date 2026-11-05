"use client";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/motion";
export type LoginPhase = "idle" | "busy" | "done" | "error";
type V = [number, number, number];
const TAU = Math.PI * 2;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
// Fixed topology. Positions are projected each frame; no React state per frame.
const points: V[] = Array.from({ length: 240 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 240;
  const a = i * Math.PI * (3 - Math.sqrt(5));
  const r = Math.sqrt(1 - y * y);
  return [r * Math.cos(a), y, r * Math.sin(a)];
});
const edges: [number, number][] = [];
points.forEach((p, i) => {
  points
    .map((q, j) => ({
      j,
      d: (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2,
    }))
    .filter((q) => q.j !== i)
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)
    .forEach(({ j }) => {
      if (j > i) edges.push([i, j]);
    });
});
export type LoginLinks = [boolean, boolean, boolean];
export function LoginNetwork({
  lit,
  phase,
  links,
}: {
  lit: number;
  phase: LoginPhase;
  links: LoginLinks;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef({ lit, phase, links });
  const reduced = useReducedMotion();
  const paint = useRef<(() => void) | null>(null);
  useEffect(() => {
    current.current = { lit, phase, links };
  }, [lit, phase, ...links]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const c = ctx;
    const css = getComputedStyle(document.documentElement);
    const green = css.getPropertyValue("--green").trim();
    const white = css.getPropertyValue("--text").trim();
    const red = css.getPropertyValue("--red").trim();
    const token = (name: string) => css.getPropertyValue(name).trim();
    const auras = {
      calm: ["--login-aura-core", "--login-aura-mid", "--login-aura-edge"].map(
        token,
      ),
      error: [
        "--login-aura-core-error",
        "--login-aura-mid-error",
        "--login-aura-edge-error",
      ].map(token),
    };
    let width = 0,
      height = 0,
      ratio = 1,
      raf = 0,
      time = 0,
      last = 0,
      visible = true;
    let mouseX = 0,
      mouseY = 0,
      tiltX = 0,
      tiltY = 0,
      energy = 0;
    let frameCount = 0,
      slow = 0,
      degraded = false,
      collapse = 0,
      coreRadius = 0;
    // Extremos de cada enlace, en coordenadas del canvas. Se miden al redimensionar.
    let anchors: ({ x: number; y: number; hw: number; hh: number } | null)[] =
      [];
    const reach = [0, 0, 0];
    const project = (v: V, scale: number, yaw: number, pitch: number): V => {
      const x = v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw);
      const z = -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw);
      const y = v[1] * Math.cos(pitch) - z * Math.sin(pitch);
      const depth = v[1] * Math.sin(pitch) + z * Math.cos(pitch);
      const perspective = 3.8 / (3.8 - depth * 0.3);
      return [
        width * 0.5 + x * scale * perspective,
        height * 0.5 + y * scale * perspective,
        depth,
      ];
    };
    const render = (dt: number) => {
      const state = current.current;
      const target =
        state.phase === "busy"
          ? 1
          : state.phase === "done"
            ? 1.25
            : state.lit * 0.22;
      const approach = (from: number, to: number, rate: number) =>
        reduced ? to : from + (to - from) * (1 - Math.exp(-dt * rate));
      energy = approach(energy, target, 4);
      collapse = approach(collapse, state.phase === "done" ? 1 : 0, 6);
      tiltX += (mouseX - tiltX) * (1 - Math.exp(-dt * 3));
      tiltY += (mouseY - tiltY) * (1 - Math.exp(-dt * 3));
      const radius = Math.min(width * 0.29, height * 0.34);
      const yaw = 0.4 + time * 0.095 + tiltX * 0.12;
      const pitch = -0.22 + tiltY * 0.1;
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      c.clearRect(0, 0, width, height);
      const tint = state.phase === "error" ? red : green;
      // Wide corona stays behind the scene, leaving the form completely opaque.
      const aura = c.createRadialGradient(
        width * 0.5,
        height * 0.5,
        radius * 0.1,
        width * 0.5,
        height * 0.5,
        radius * 1.8,
      );
      const stops = state.phase === "error" ? auras.error : auras.calm;
      aura.addColorStop(0, stops[0]);
      aura.addColorStop(0.6, stops[1]);
      aura.addColorStop(1, stops[2]);
      c.fillStyle = aura;
      c.fillRect(0, 0, width, height);
      // Sparse fixed stars make the scale legible without flicker.
      c.fillStyle = white;
      for (let i = 0; i < 64; i++) {
        c.globalAlpha = 0.12 + hash(i + 5) * 0.3;
        c.fillRect(
          hash(i + 1) * width,
          hash(i + 108) * height,
          i % 7 === 0 ? 2 : 1,
          i % 7 === 0 ? 2 : 1,
        );
      }
      const projected = points.map((p) => project(p, radius, yaw, pitch));
      c.strokeStyle = tint;
      c.lineWidth = 0.65;
      for (const [a, b] of edges) {
        const p = projected[a],
          q = projected[b];
        const front = ((p[2] + q[2]) / 2 + 1) / 2;
        c.globalAlpha = 0.025 + front * 0.19 + energy * 0.065;
        c.beginPath();
        c.moveTo(p[0], p[1]);
        c.lineTo(q[0], q[1]);
        c.stroke();
      }
      for (let i = 0; i < projected.length; i++) {
        const [x, y, z] = projected[i];
        c.globalAlpha = 0.15 + (z + 1) * 0.25;
        c.fillStyle = i % 5 === 0 ? white : tint;
        const size = z > 0.4 ? 1.7 : 1;
        c.fillRect(x - size / 2, y - size / 2, size, size);
      }
      // Three inclined orbital planes carry the signals around the same nucleus.
      for (let orbit = 0; orbit < 3; orbit++) {
        const inclination = [0.3, 1.05, -0.9][orbit];
        const twist = [-0.25, 0.6, -0.55][orbit];
        const position = (a: number): V => {
          // Al entrar, las órbitas se recogen sobre la superficie del núcleo.
          const span = 1.43 - collapse * 0.41;
          const x = Math.cos(a) * span,
            y = Math.sin(a) * span;
          return project(
            [x, y * Math.cos(inclination), y * Math.sin(inclination)],
            radius,
            twist,
            pitch,
          );
        };
        c.strokeStyle = orbit === 0 ? white : tint;
        c.lineWidth = 0.7;
        c.globalAlpha = 0.12 + energy * 0.055;
        c.beginPath();
        for (let i = 0; i <= 160; i++) {
          const [x, y] = position((i / 160) * TAU);
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
        const speed =
          (0.25 + orbit * 0.04) * (state.phase === "busy" ? 2.4 : 1);
        for (let j = 0; j < 3; j++) {
          const head = time * speed + orbit * 2 + (j * TAU) / 3;
          for (let k = 18; k >= 0; k--) {
            const [x, y] = position(head - k * 0.008);
            c.globalAlpha = (1 - k / 19) * (0.55 + energy * 0.3);
            c.fillStyle = j === 0 ? white : tint;
            const size = k === 0 ? 2.3 : 1;
            c.beginPath();
            c.arc(x, y, size, 0, TAU);
            c.fill();
          }
        }
      }
      // A travelling meridian responds to valid fields, then speeds up on submit.
      c.strokeStyle = tint;
      c.lineWidth = 1.5;
      c.globalAlpha = 0.65;
      c.beginPath();
      for (let i = 0; i < 70; i++) {
        const a = (i / 70) * Math.PI * 1.35 + time * (0.3 + energy * 0.35);
        const p = project(
          [Math.cos(a), Math.sin(a) * 0.7, Math.sin(a) * 0.7],
          radius * 1.02,
          yaw,
          pitch,
        );
        if (i === 0) c.moveTo(p[0], p[1]);
        else c.lineTo(p[0], p[1]);
      }
      c.stroke();
      // Cada dato válido enlaza su etiqueta con el núcleo.
      const cx = width * 0.5,
        cy = height * 0.5;
      anchors.forEach((anchor, i) => {
        reach[i] = approach(reach[i], state.links[i] ? 1 : 0, 5);
        if (!anchor || reach[i] < 0.01) return;
        const dx = anchor.x - cx,
          dy = anchor.y - cy,
          distance = Math.hypot(dx, dy) || 1;
        // Termina en el borde de la etiqueta y arranca en el del núcleo.
        const edge = Math.min(
          anchor.hw / Math.max(Math.abs(dx), 1),
          anchor.hh / Math.max(Math.abs(dy), 1),
        );
        const sx = cx + (dx / distance) * coreRadius,
          sy = cy + (dy / distance) * coreRadius,
          ex = anchor.x - dx * edge,
          ey = anchor.y - dy * edge;
        // Curva leve para que el enlace no parezca una regla sobre la esfera.
        const bx = (sx + ex) / 2 - dy * 0.1,
          by = (sy + ey) / 2 + dx * 0.1;
        const at = (t: number) => {
          const u = 1 - t;
          return [
            u * u * sx + 2 * u * t * bx + t * t * ex,
            u * u * sy + 2 * u * t * by + t * t * ey,
          ];
        };
        c.strokeStyle = tint;
        c.lineWidth = 1;
        c.globalAlpha = 0.5;
        c.beginPath();
        for (let k = 0; k <= 28; k++) {
          const [x, y] = at((k / 28) * reach[i]);
          if (k === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
        if (reduced || reach[i] < 0.98) return;
        const pulse = (time * 0.5 + i / 3) % 1;
        c.fillStyle = tint;
        for (let k = 0; k < 10; k++) {
          const t = pulse - k * 0.012;
          if (t < 0) break;
          const [x, y] = at(t);
          c.globalAlpha = 1 - k / 10;
          c.beginPath();
          c.arc(x, y, k === 0 ? 2.2 : 1.1, 0, TAU);
          c.fill();
        }
      });
      c.globalAlpha = 1;
    };
    paint.current = () => render(0);
    const frame = (now: number) => {
      const elapsed = last ? (now - last) / 1000 : 0;
      last = now;
      const dt = Math.min(elapsed, 0.045);
      time += dt;
      render(dt);
      frameCount++;
      if (elapsed > 0.032) slow++;
      if (frameCount === 120 && slow > 35) {
        degraded = true;
        resize();
      }
      if (!reduced && visible && !document.hidden)
        raf = requestAnimationFrame(frame);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (reduced) {
        render(0);
        raf = requestAnimationFrame(() => render(0));
      } else if (visible && !document.hidden)
        raf = requestAnimationFrame(frame);
    };
    const measure = (rect: DOMRect) => {
      const scene = element.parentElement;
      if (!scene) return;
      const core = scene.querySelector(".login-core-label");
      coreRadius = (core?.getBoundingClientRect().width ?? 0) / 2;
      anchors = Array.from(scene.querySelectorAll(".orbit-label"), (label) => {
        const box = label.getBoundingClientRect();
        if (!box.width) return null;
        return {
          x: box.left - rect.left + box.width / 2,
          y: box.top - rect.top + box.height / 2,
          hw: box.width / 2,
          hh: box.height / 2,
        };
      });
    };
    const resize = () => {
      const rect = element.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      ratio = degraded ? 1 : Math.min(devicePixelRatio || 1, 1.75);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      measure(rect);
      render(0);
    };
    const pointer = (e: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / Math.max(width, 1) - 0.5;
      mouseY = (e.clientY - rect.top) / Math.max(height, 1) - 0.5;
    };
    const leave = () => {
      mouseX = mouseY = 0;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      play();
    });
    observer.observe(element);
    element.parentElement?.addEventListener("pointermove", pointer);
    element.parentElement?.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", play);
    resize();
    play();
    return () => {
      paint.current = null;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", play);
      element.parentElement?.removeEventListener("pointermove", pointer);
      element.parentElement?.removeEventListener("pointerleave", leave);
    };
  }, [reduced]);
  // Static mode still reflects validation without restarting a render loop.
  useEffect(() => {
    if (reduced) paint.current?.();
  }, [reduced, lit, phase, ...links]);
  return (
    <canvas ref={canvas} className="login-core-canvas" aria-hidden="true" />
  );
}
export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </svg>
  );
}
