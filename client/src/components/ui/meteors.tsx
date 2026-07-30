"use client";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import React from "react";

export const Meteors = ({
  number,
  className,
}: {
  number?: number;
  className?: string;
}) => {
  const count = number || 20;
  // animationDelay/Duration come from Math.random(), so the server and client
  // render different inline styles and React logs a hydration mismatch for each
  // meteor. Generating the timings after mount keeps the streak purely client-side.
  const [timings, setTimings] = React.useState<
    { delay: string; duration: string }[]
  >([]);

  React.useEffect(() => {
    setTimings(
      Array.from({ length: count }, () => ({
        delay: Math.random() * 5 + "s",
        duration: Math.floor(Math.random() * (10 - 5) + 5) + "s",
      })),
    );
  }, [count]);

  const meteors = new Array(count).fill(true);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {meteors.map((el, idx) => {
        const meteorCount = count;
        // Calculate position to evenly distribute meteors across container width
        const position = idx * (800 / meteorCount) - 400; // Spread across 800px range, centered
        const timing = timings[idx];

        return (
          <span
            key={"meteor" + idx}
            className={cn(
              "animate-meteor-effect absolute h-0.5 w-0.5 rotate-[45deg] rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10]",
              "before:absolute before:top-1/2 before:h-[1px] before:w-[50px] before:-translate-y-[50%] before:transform before:bg-gradient-to-r before:from-[#64748b] before:to-transparent before:content-['']",
              className,
            )}
            style={{
              top: "-40px", // Start above the container
              left: position + "px",
              // Undefined until mounted, so SSR and first client render agree.
              animationDelay: timing?.delay,
              animationDuration: timing?.duration,
            }}
          ></span>
        );
      })}
    </motion.div>
  );
};
