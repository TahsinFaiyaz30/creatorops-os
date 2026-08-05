'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, useRef } from 'react';

// Animated counting effect for numbers
function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  const reduce = useReducedMotion();
  
  useEffect(() => {
    if (reduce) { setCount(target); return; }
    const num = typeof target === 'string' ? parseFloat(target) : target;
    if (isNaN(num) || num === 0) { setCount(target); return; }
    
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(num * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration, reduce]);
  
  return typeof target === 'string' && target.includes('%') ? `${count}%` : count;
}

export default function CreatorStatsCard({ label, value, note }) {
  const reduce = useReducedMotion();
  const displayValue = useCountUp(value);
  
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduce ? undefined : { y: -2, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--border-strong)]"
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-soft)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-line)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
        <div className="mt-2.5 text-3xl font-bold tabular-nums tracking-tight text-[var(--text)]">
          {displayValue ?? 'Unavailable'}
        </div>
        {note && <p className="mt-1.5 text-xs text-[var(--muted)]">{note}</p>}
      </div>
    </motion.div>
  );
}
