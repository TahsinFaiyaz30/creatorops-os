"use client";

import { useId, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import DottedMap from "dotted-map";

interface Point {
  lat: number;
  lng: number;
  label?: string;
}

interface MapProps {
  dots?: Array<{ start: Point; end: Point }>;
  lineColor?: string;
  /** Render city labels next to each node. */
  showLabels?: boolean;
  /** Send a travelling pulse along each arc. */
  animatePackets?: boolean;
  /** Seconds for one full draw cycle before it repeats. */
  cycleSeconds?: number;
}

export default function WorldMap({
  dots = [],
  lineColor = "#0ea5e9",
  showLabels = true,
  animatePackets = true,
  cycleSeconds = 8,
}: MapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  // Gradient/filter ids must be unique per instance or two maps on one page
  // would resolve each other's defs.
  const uid = useId().replace(/:/g, "");

  const map = useMemo(() => new DottedMap({ height: 100, grid: "diagonal" }), []);

  // Upstream reads the theme from `next-themes`, which this project doesn't use
  // (it has its own ThemeProvider). The map only renders on dark surfaces here.
  const svgMap = useMemo(
    () =>
      map.getSVG({
        radius: 0.22,
        color: "#FFFFFF40",
        shape: "circle",
        backgroundColor: "black",
      }),
    [map]
  );

  const projectPoint = (lat: number, lng: number) => ({
    x: (lng + 180) * (800 / 360),
    y: (90 - lat) * (400 / 180),
  });

  /**
   * Arc height scales with distance instead of a flat -50 lift. Upstream used a
   * constant, so a short hop bowed as hard as a transatlantic route — the single
   * biggest thing making the map read as fake. Capped so very long routes don't
   * shoot off the top of the viewBox.
   */
  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const lift = Math.min(distance * 0.28, 110);
    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - lift;
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  };

  /* Nodes deduped by coordinate, weighted by how many routes touch them, so a
     genuine hub renders larger than a leaf. */
  const nodes = useMemo(() => {
    const byKey = new Map<
      string,
      { x: number; y: number; label?: string; weight: number }
    >();
    dots.forEach(({ start, end }) => {
      [start, end].forEach((p) => {
        const key = `${p.lat},${p.lng}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.weight += 1;
          existing.label = existing.label || p.label;
        } else {
          byKey.set(key, { ...projectPoint(p.lat, p.lng), label: p.label, weight: 1 });
        }
      });
    });
    return [...byKey.values()];
  }, [dots]);

  const stagger = cycleSeconds / Math.max(dots.length, 1);

  return (
    <div className="relative aspect-[2/1] w-full rounded-lg bg-black font-sans dark:bg-black">
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="pointer-events-none h-full w-full select-none [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)]"
        alt="world map"
        height="495"
        width="1056"
        draggable={false}
      />

      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      >
        <defs>
          <linearGradient id={`grad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="8%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="92%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {dots.map((dot, i) => {
          const start = projectPoint(dot.start.lat, dot.start.lng);
          const end = projectPoint(dot.end.lat, dot.end.lng);
          const d = createCurvedPath(start, end);
          const delay = stagger * i;

          return (
            <g key={`route-${i}`}>
              {/* Dim persistent trace, so the network reads as a whole even
                  between draw cycles. */}
              <path d={d} fill="none" stroke={lineColor} strokeWidth="0.5" opacity="0.18" />

              {/* Drawing stroke, looping */}
              <motion.path
                d={d}
                fill="none"
                stroke={`url(#grad-${uid})`}
                strokeWidth="1.1"
                filter={`url(#glow-${uid})`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={
                  reduceMotion
                    ? { pathLength: 1, opacity: 1 }
                    : { pathLength: [0, 1, 1], opacity: [0, 1, 0] }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.6 }
                    : {
                        duration: cycleSeconds,
                        times: [0, 0.35, 1],
                        delay,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                }
              />

              {/* Travelling packet */}
              {animatePackets && !reduceMotion ? (
                <circle r="2.2" fill={lineColor} filter={`url(#glow-${uid})`}>
                  <animateMotion
                    dur={`${cycleSeconds * 0.35}s`}
                    begin={`${delay}s`}
                    repeatCount="indefinite"
                    path={d}
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="spline"
                    keySplines="0.4 0 0.2 1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.1;0.85;1"
                    dur={`${cycleSeconds * 0.35}s`}
                    begin={`${delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ) : null}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const isHub = node.weight > 1;
          const core = isHub ? 2.6 : 1.8;
          return (
            <g key={`node-${i}`}>
              {/* Ping. Upstream fired every ring at begin="0s", so the whole map
                  pulsed in lockstep; offsetting them makes it feel alive. */}
              {!reduceMotion ? (
                <circle cx={node.x} cy={node.y} r={core} fill={lineColor} opacity="0.5">
                  <animate
                    attributeName="r"
                    from={core}
                    to={isHub ? 12 : 8}
                    dur="2.4s"
                    begin={`${(i * 0.37) % 2.4}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.5"
                    to="0"
                    dur="2.4s"
                    begin={`${(i * 0.37) % 2.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ) : null}

              <circle
                cx={node.x}
                cy={node.y}
                r={core}
                fill={lineColor}
                filter={`url(#glow-${uid})`}
              />
              {isHub ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={core + 2.2}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth="0.6"
                  opacity="0.55"
                />
              ) : null}

              {showLabels && node.label ? (
                <text
                  x={node.x}
                  y={node.y - (isHub ? 9 : 7)}
                  textAnchor="middle"
                  className="select-none"
                  style={{
                    fontSize: isHub ? 9 : 7.5,
                    fontWeight: isHub ? 700 : 500,
                    fill: "#ffffff",
                    fillOpacity: isHub ? 0.92 : 0.6,
                    letterSpacing: "0.04em",
                    paintOrder: "stroke",
                    stroke: "#000000",
                    strokeWidth: 2.4,
                    strokeOpacity: 0.55,
                    strokeLinejoin: "round",
                  }}
                >
                  {node.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
