'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Portal for anchored popups.
 *
 * `position: fixed` is only relative to the viewport while no ancestor
 * establishes a containing block. `transform`, `filter`, `backdrop-filter` and
 * `perspective` all do — and this app's header carries `backdrop-blur-md`, its
 * cards `backdrop-blur-xl`. A menu opened from inside one of those was measured
 * against the viewport but positioned against the blurred box, which put the
 * notification panel 278px off the right edge of the screen.
 *
 * Rendering into <body> takes the popup out of every one of those boxes, so
 * measured coordinates mean what they say.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Popover({ children }) {
  const [mounted, setMounted] = useState(false);

  /* Portals need a DOM target, which does not exist during SSR. */
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
