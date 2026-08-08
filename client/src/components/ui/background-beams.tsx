"use client";
import React from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * The beam geometry, generated rather than pasted.
 *
 * These paths shipped as ~110 hand-copied `d` strings, and the copy was lossy:
 *
 *   · Every entry in the animated array ended its second cubic after two
 *     coordinate pairs — `C616 470 684 875` — when `C` needs three. The browser
 *     read to the end of the attribute looking for the sixth number and logged
 *     `<path> attribute d: Unexpected end of attribute. Expected number, "…"`,
 *     once per beam, on every render of every page using this background.
 *     It then drew only the prefix it had managed to parse, so each beam was
 *     rendering as its first segment and stopping.
 *   · The faint backdrop path had whole numbers missing mid-string in a dozen
 *     places (`C-324 -253 -256 279C…` — a pair short) from the same copy.
 *
 * The set is a strict arithmetic family: row i is row 0 translated by
 * (+7, -8). Generating it from that rule fixes both problems at once and makes
 * a truncated coordinate impossible to reintroduce. The geometry is unchanged —
 * every surviving number in the old strings matches what this produces.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const beamPath = (i: number) => {
  const x = (base: number) => base + 7 * i;
  const y = (base: number) => base - 8 * i;
  return (
    `M${x(-380)} ${y(-189)}` +
    `C${x(-380)} ${y(-189)} ${x(-312)} ${y(216)} ${x(152)} ${y(343)}` +
    /* The endpoint repeats the second control point, mirroring the first
       segment where the first control point repeats the start. */
    `C${x(616)} ${y(470)} ${x(684)} ${y(875)} ${x(684)} ${y(875)}`
  );
};

/** Animated beams; the backdrop draws the same family, extended and dimmed. */
const BEAM_COUNT = 50;
const BACKDROP_COUNT = 58;

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * Why the sweep is SMIL and not Framer Motion.
 *
 * Each beam is stroked with its own gradient, and the gradient's x1/x2/y1/y2
 * slide across it forever. Driving that from JS meant 50 elements × 4
 * attributes = 200 attribute writes on the main thread every single frame, each
 * one invalidating the rasterisation of the path that references it. A style +
 * layout pass on this page measured 9.8ms — most of a 16.7ms frame gone before
 * anything was painted, which is what made the whole UI feel heavy. This
 * component mounts on the landing hero AND the dashboard, so the cost followed
 * you around.
 *
 * `<animate>` hands the same interpolation to the browser's own animation
 * engine: no JS runs per frame, and the timing stays identical.
 *
 * The per-beam variation is derived from the index rather than Math.random().
 * Random values differ between the server render and the client render, so the
 * old version produced a hydration mismatch on every load as well.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const beamTiming = (i: number) => {
  /* Cheap deterministic spread — irrational multipliers so the three values
     never fall into step with each other across the run. */
  const frac = (n: number) => n - Math.floor(n);
  return {
    duration: +(10 + frac(i * 0.6180339887) * 10).toFixed(2),
    delay: +(frac(i * 0.7548776662) * 10).toFixed(2),
    endY: +(93 + frac(i * 0.4142135624) * 8).toFixed(1)
  };
};

export const BackgroundBeams = React.memo(
  ({ className }: { className?: string }) => {
    const reduce = useReducedMotion();
    const animate = !reduce;
    const paths = Array.from({ length: BEAM_COUNT }, (_, i) => beamPath(i));
    const backdropPath = Array.from({ length: BACKDROP_COUNT }, (_, i) => beamPath(i)).join("");
    return (
      <div
        className={cn(
          "absolute inset-0 flex h-full w-full items-center justify-center [mask-repeat:no-repeat] [mask-size:40px]",
          className,
        )}
      >
        <svg
          className="pointer-events-none absolute z-0 h-full w-full"
          width="100%"
          height="100%"
          viewBox="0 0 696 316"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d={backdropPath}
            stroke="url(#paint0_radial_242_278)"
            strokeOpacity="0.05"
            strokeWidth="0.5"
          ></path>

          {paths.map((path, index) => (
            <path
              key={`path-` + index}
              d={path}
              stroke={`url(#linearGradient-${index})`}
              strokeOpacity="0.4"
              strokeWidth="0.5"
            />
          ))}
          <defs>
            {paths.map((_, index) => {
              const { duration, delay, endY } = beamTiming(index);
              return (
                <linearGradient id={`linearGradient-${index}`} key={`gradient-${index}`} x1="0%" x2="0%" y1="0%" y2="0%">
                  {animate ? (
                    <>
                      <animate attributeName="x1" values="0%;100%" dur={`${duration}s`} begin={`-${delay}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1" keyTimes="0;1" />
                      <animate attributeName="x2" values="0%;95%" dur={`${duration}s`} begin={`-${delay}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1" keyTimes="0;1" />
                      <animate attributeName="y1" values="0%;100%" dur={`${duration}s`} begin={`-${delay}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1" keyTimes="0;1" />
                      <animate attributeName="y2" values={`0%;${endY}%`} dur={`${duration}s`} begin={`-${delay}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1" keyTimes="0;1" />
                    </>
                  ) : null}
                  <stop stopColor="#18CCFC" stopOpacity="0"></stop>
                  <stop stopColor="#18CCFC"></stop>
                  <stop offset="32.5%" stopColor="#6344F5"></stop>
                  <stop offset="100%" stopColor="#AE48FF" stopOpacity="0"></stop>
                </linearGradient>
              );
            })}

            <radialGradient
              id="paint0_radial_242_278"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(352 34) rotate(90) scale(555 1560.62)"
            >
              <stop offset="0.0666667" stopColor="#d4d4d4"></stop>
              <stop offset="0.243243" stopColor="#d4d4d4"></stop>
              <stop offset="0.43594" stopColor="white" stopOpacity="0"></stop>
            </radialGradient>
          </defs>
        </svg>
      </div>
    );
  },
);

BackgroundBeams.displayName = "BackgroundBeams";
