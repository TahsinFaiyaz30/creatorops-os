"use client";
import React from "react";
import { motion } from "motion/react";
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

export const BackgroundBeams = React.memo(
  ({ className }: { className?: string }) => {
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
            <motion.path
              key={`path-` + index}
              d={path}
              stroke={`url(#linearGradient-${index})`}
              strokeOpacity="0.4"
              strokeWidth="0.5"
            ></motion.path>
          ))}
          <defs>
            {paths.map((path, index) => (
              <motion.linearGradient
                id={`linearGradient-${index}`}
                key={`gradient-${index}`}
                initial={{
                  x1: "0%",
                  x2: "0%",
                  y1: "0%",
                  y2: "0%",
                }}
                animate={{
                  x1: ["0%", "100%"],
                  x2: ["0%", "95%"],
                  y1: ["0%", "100%"],
                  y2: ["0%", `${93 + Math.random() * 8}%`],
                }}
                transition={{
                  duration: Math.random() * 10 + 10,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: Math.random() * 10,
                }}
              >
                <stop stopColor="#18CCFC" stopOpacity="0"></stop>
                <stop stopColor="#18CCFC"></stop>
                <stop offset="32.5%" stopColor="#6344F5"></stop>
                <stop offset="100%" stopColor="#AE48FF" stopOpacity="0"></stop>
              </motion.linearGradient>
            ))}

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
