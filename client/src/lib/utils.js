import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes, letting later classes win conflicts.
 *
 * twMerge matters here beyond tidiness: a `dark:`-prefixed utility survives
 * alongside an unprefixed one, so a caller passing `bg-x` does not silently
 * lose to a component's own `dark:bg-y`.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
