"use client";
import React, { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";

/*
 * The viewBox is measured from the text rather than fixed at 300 wide.
 *
 * Upstream hardcodes `viewBox="0 0 300 100"`, which only fits a short word: at
 * `text-7xl` a ten-character string like CREATOROPS is roughly 520 user units
 * across, so it ran off both edges of the viewport and the first and last
 * letters were clipped away. The clipped strip also swallowed the pointer —
 * there was nothing there to hover — so the reveal died at both ends.
 *
 * `preserveAspectRatio="none"` then lets the fitted box stretch to whatever the
 * caller sized it to, instead of letterboxing and leaving dead margins that the
 * cursor maths does not account for.
 */
export const TextHoverEffect = ({
  text,
  duration,
}: {
  text: string;
  duration?: number;
  automatic?: boolean;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });
  const [boxWidth, setBoxWidth] = useState(300);

  useEffect(() => {
    /* getBBox is in user units, so it is unaffected by the viewBox it feeds. */
    const measured = measureRef.current?.getBBox?.().width;
    if (measured) setBoxWidth(Math.ceil(measured + 16));
  }, [text]);

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      });
    }
  }, [cursor]);

  /* Keep the stroke a constant thickness on screen as the box widens. */
  const strokeWidth = (0.6 * boxWidth) / 300;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${boxWidth} 100`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className="select-none"
    >
      <defs>
        <linearGradient
          id="textGradient"
          gradientUnits="userSpaceOnUse"
          cx="50%"
          cy="50%"
          r="25%"
        >
          {hovered && (
            <>
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="25%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="75%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="20%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}

          // example for a smoother animation below

          //   transition={{
          //     type: "spring",
          //     stiffness: 300,
          //     damping: 50,
          //   }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="textMask">
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#revealMask)"
          />
        </mask>
      </defs>
      {/* Off-screen twin, used only to measure the glyph run. */}
      <text
        ref={measureRef}
        aria-hidden
        x="0"
        y="-999"
        className="fill-transparent stroke-transparent font-[helvetica] text-7xl font-bold"
      >
        {text}
      </text>

      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth={strokeWidth}
        className="fill-transparent stroke-neutral-300 font-[helvetica] text-7xl font-bold dark:stroke-neutral-700"
        style={{ opacity: hovered ? 0.7 : 0 }}
      >
        {text}
      </text>
      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth={strokeWidth}
        className="fill-transparent stroke-neutral-300 font-[helvetica] text-7xl font-bold dark:stroke-neutral-700"
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{
          strokeDashoffset: 0,
          strokeDasharray: 1000,
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
        }}
      >
        {text}
      </motion.text>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke="url(#textGradient)"
        strokeWidth={strokeWidth}
        mask="url(#textMask)"
        className="fill-transparent font-[helvetica] text-7xl font-bold"
      >
        {text}
      </text>
    </svg>
  );
};
