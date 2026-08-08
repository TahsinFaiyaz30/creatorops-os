"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavbarLogo,
  NavbarButton,
} from "@/components/ui/resizable-navbar";
import { getToken } from "@/lib/auth";

/* No "Voices" — that section held placeholder testimonials and is gone, so the
   link scrolled to an anchor that no longer exists. */
const NAV_ITEMS = [
  { name: "Features", link: "#features" },
  { name: "Workflow", link: "#workflow" },
  { name: "Reach", link: "#reach" },
];

export default function SiteNavbar() {
  const [open, setOpen] = useState(false);
  /*
   * Auth state decides which door to show. "Sign in" pointed at /login, which
   * bounces an already-signed-in visitor straight back out — so to someone with
   * a session the button looked broken.
   *
   * `null` until resolved, and the slot renders empty in that state. The token
   * lives in localStorage, which cannot be read during render without the
   * server and client markup disagreeing — so the effect decides, and showing
   * "Sign in / Get started" first would visibly swap to "Dashboard" a beat
   * later on every load.
   */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => setSignedIn(Boolean(getToken())), []);

  return (
    <Navbar className="fixed inset-x-0 top-0 z-50">
      {/* Desktop — shrinks and blurs as you scroll */}
      <NavBody>
        <NavbarLogo />
        <NavItems items={NAV_ITEMS} />
        {/*
          One primary door, not two competing ones. "Sign in" is a quiet text
          link because returning users know where it is; the emphasis belongs on
          the action a first-time visitor should take.
        */}
        {/* Reserves its own height so resolving the session cannot reflow the bar. */}
        <div className="flex h-[34px] items-center gap-4">
          {signedIn === null ? null : signedIn ? (
            <NavbarButton href="/dashboard" variant="dark" className="px-4 py-1.5 text-sm">
              Dashboard
            </NavbarButton>
          ) : (
            <>
              <Link
                href="/login"
                className="focus-ring rounded text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                Sign in
              </Link>
              <NavbarButton href="/signup" variant="dark" className="px-4 py-1.5 text-sm">
                Get started
              </NavbarButton>
            </>
          )}
        </div>
      </NavBody>

      {/* Mobile */}
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle isOpen={open} onClick={() => setOpen(!open)} />
        </MobileNavHeader>
        <MobileNavMenu isOpen={open} onClose={() => setOpen(false)}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.link}
              href={item.link}
              onClick={() => setOpen(false)}
              className="w-full py-2 text-[var(--text-2)]"
            >
              {item.name}
            </Link>
          ))}
          <div className="mt-2 flex w-full flex-col gap-3">
            {signedIn === null ? null : signedIn ? (
              <NavbarButton href="/dashboard" variant="dark" className="w-full text-center">
                Dashboard
              </NavbarButton>
            ) : (
              <>
                <NavbarButton href="/signup" variant="dark" className="w-full text-center">
                  Get started
                </NavbarButton>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="focus-ring w-full rounded py-1 text-center text-sm font-medium text-[var(--muted)]"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
