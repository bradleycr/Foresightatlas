/**
 * NanowheelBurst — a one-shot canvas celebration that plays when a member
 * checks into a node. It's the visual payoff for the tap: something small but
 * tactile enough that the first check-in feels worth photographing.
 *
 * What's on the stage (all painted on a single 2D canvas for low jank):
 *
 *   • A radial halo that blooms out of the centre and settles.
 *   • Three concentric ring waves that expand and fade, staggered so they
 *     look like a ripple on water rather than a flash.
 *   • Thirty-two orbital sparkles that launch outward, rotate as they fly,
 *     and fade with an ease-out curve.
 *   • The Foresight nanowheel mark at centre, scaled with an ease-out-back
 *     bounce and rotating gently on its own axis (this is the bit that
 *     visually mirrors — and improves on — the spinning loader).
 *   • A "+1" glyph paired with the nanowheel symbol that rises and fades.
 *
 * The whole performance runs for ~1800 ms and then self-dismisses via
 * {@link NanowheelBurstProps.onComplete}. If the user has prefers-reduced-
 * motion enabled we shorten it to a soft crossfade so the experience stays
 * celebratory without inducing vestibular strain.
 */

import { useEffect, useRef } from "react";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";

const DURATION_MS = 1800;
const DURATION_REDUCED_MS = 900;
const PARTICLE_COUNT = 32;
const RING_COUNT = 3;
const PALETTE = {
  halo: "rgba(186, 230, 253, 0.55)",    // sky-200 glow
  haloInner: "rgba(224, 231, 255, 0.9)", // indigo-100 core
  ring: "rgba(14, 165, 233, 0.85)",      // sky-500
  particleHot: "rgba(99, 102, 241, 0.95)", // indigo-500
  particleCool: "rgba(14, 165, 233, 0.85)", // sky-500
  text: "#0f172a",                        // slate-900
};

interface Particle {
  /** Angle of initial launch (radians). */
  angle: number;
  /** How far out this particle ends up, as a fraction of the max radius. */
  reach: number;
  /** Rotation rate in radians per millisecond. */
  spin: number;
  /** Starting angular offset so they don't all phase-align. */
  phase: number;
  /** Per-particle color (indigo or sky, picked at creation). */
  color: string;
  /** Individual size in px at peak. */
  size: number;
}

interface NanowheelBurstProps {
  /** Play the animation when this flips to true; ignored otherwise. */
  visible: boolean;
  /** Fires once when the animation finishes (or the user cancels with a tap). */
  onComplete: () => void;
}

export function NanowheelBurst({ visible, onComplete }: NanowheelBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep the latest completion callback without retriggering the effect so
  // parents can pass an inline function without re-running the animation.
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const totalDuration = reducedMotion ? DURATION_REDUCED_MS : DURATION_MS;

    const dpr = Math.max(window.devicePixelRatio || 1, 1);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    /* ── Particle fleet generation ───────────────────────────────────
     * Create once, reuse each frame. Deterministic per-run randomness is fine
     * here because the whole effect lives for less than 2 seconds. */
    const particles: Particle[] = Array.from(
      { length: reducedMotion ? Math.floor(PARTICLE_COUNT / 2) : PARTICLE_COUNT },
      (_, i) => ({
        angle: (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.6,
        reach: 0.55 + Math.random() * 0.45,
        spin: (Math.random() - 0.5) * 0.02,
        phase: Math.random() * Math.PI * 2,
        color: i % 2 === 0 ? PALETTE.particleHot : PALETTE.particleCool,
        size: 4 + Math.random() * 4,
      }),
    );

    /* Preload the Foresight mark so the first frame isn't blank. If it fails
     * we just skip drawing it — the rings and particles still carry the beat. */
    const logo = new Image();
    logo.src = foresightIconUrl;
    let logoReady = false;
    logo.onload = () => {
      logoReady = true;
    };

    const draw = (timestamp: number) => {
      if (startedAtRef.current === null) startedAtRef.current = timestamp;
      const elapsed = timestamp - startedAtRef.current;
      const t = Math.min(elapsed / totalDuration, 1);

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(w, h) * 0.45;

      /* Clear with a transparent wash so we don't leave trails but the
       * backdrop behind the canvas (the app itself) shows through. */
      ctx.clearRect(0, 0, w, h);

      /* Backdrop halo — biggest at 40% of the run, then fades. */
      const haloAlpha = Math.sin(Math.PI * Math.min(t * 1.4, 1));
      const haloRadius = maxRadius * (0.6 + 0.5 * easeOutCubic(Math.min(t * 1.2, 1)));
      const haloGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloRadius);
      haloGradient.addColorStop(0, withAlpha(PALETTE.haloInner, 0.9 * haloAlpha));
      haloGradient.addColorStop(0.55, withAlpha(PALETTE.halo, 0.55 * haloAlpha));
      haloGradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = haloGradient;
      ctx.fillRect(0, 0, w, h);

      /* Ring pulses — staggered, expanding, fading. */
      ctx.lineWidth = 2;
      for (let i = 0; i < RING_COUNT; i++) {
        const delay = i * 0.18;
        const ringT = clamp((t - delay) / (1 - delay), 0, 1);
        if (ringT <= 0 || ringT >= 1) continue;
        const r = maxRadius * easeOutCubic(ringT) * (0.75 + i * 0.1);
        const alpha = (1 - ringT) * 0.6;
        ctx.strokeStyle = withAlpha(PALETTE.ring, alpha);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      /* Sparkle particles. Each launches from centre, flies outward with an
       * ease-out curve, rotates on its own pivot, and fades in the back half. */
      for (const p of particles) {
        const reach = p.reach * maxRadius;
        const travel = easeOutQuart(t);
        const distance = reach * travel;
        const x = cx + Math.cos(p.angle) * distance;
        const y = cy + Math.sin(p.angle) * distance;
        const fade = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
        const alpha = clamp(fade, 0, 1) * 0.9;
        const rotation = p.phase + elapsed * p.spin;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        drawSparkle(ctx, p.size, withAlpha(p.color, alpha));
        ctx.restore();
      }

      /* Foresight nanowheel — the protagonist. Scales with an ease-out-back
       * bounce, rotates on its axis, and stays centred through the whole run. */
      if (logoReady) {
        const scale = easeOutBack(clamp(t / 0.5, 0, 1)) * (t > 0.8 ? 1 - (t - 0.8) * 0.6 : 1);
        const rotation = t * Math.PI * 1.4;
        const size = Math.min(w, h) * 0.18 * scale;
        const opacity = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;

        ctx.save();
        ctx.globalAlpha = clamp(opacity, 0, 1);
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.drawImage(logo, -size / 2, -size / 2, size, size);
        ctx.restore();
      }

      /* "+1 ◎" glyph — rises up and fades to finish. */
      const textT = clamp((t - 0.35) / 0.55, 0, 1);
      if (textT > 0) {
        const textAlpha = Math.sin(Math.PI * textT);
        const lift = 40 * easeOutCubic(textT);
        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.fillStyle = PALETTE.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "600 28px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto";
        ctx.fillText(
          "+1  \u25CE",
          cx,
          cy + Math.min(w, h) * 0.18 + 32 - lift,
        );
        ctx.restore();
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        onCompleteRef.current?.();
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startedAtRef.current = null;
      window.removeEventListener("resize", resize);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 flex items-center justify-center"
      style={{ zIndex: Z_INDEX_MODAL_CONTENT }}
      aria-hidden
      onClick={() => onCompleteRef.current?.()}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
}

/* ── Drawing primitives ──────────────────────────────────────────────── */

/**
 * A small 4-pointed sparkle drawn around the canvas origin. Meant to be
 * translated + rotated by the caller before invocation.
 */
function drawSparkle(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.25, 0, size, 0);
  ctx.quadraticCurveTo(size * 0.25, 0, 0, size);
  ctx.quadraticCurveTo(-size * 0.25, 0, -size, 0);
  ctx.quadraticCurveTo(-size * 0.25, 0, 0, -size);
  ctx.closePath();
  ctx.fill();
}

/* ── Easing + helpers ─────────────────────────────────────────────────
 * Kept tiny and local so the animation has no runtime dependencies. */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Replace the alpha channel of an rgba() string. Accepts the palette's
 * "rgba(r, g, b, a)" format and returns the same string with a swapped in.
 */
function withAlpha(rgba: string, alpha: number): string {
  const match = rgba.match(/rgba?\(([^)]+)\)/);
  if (!match) return rgba;
  const parts = match[1].split(",").map((s) => s.trim());
  const [r, g, b] = parts;
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}
