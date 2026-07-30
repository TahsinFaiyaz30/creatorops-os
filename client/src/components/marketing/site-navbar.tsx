"use client";

import { useState } from "react";
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

const NAV_ITEMS = [
  { name: "Features", link: "#features" },
  { name: "Workflow", link: "#workflow" },
  { name: "Voices", link: "#voices" },
  { name: "Reach", link: "#reach" },
];

export default function SiteNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <Navbar className="fixed inset-x-0 top-0 z-50">
      {/* Desktop — shrinks and blurs as you scroll */}
      <NavBody>
        <NavbarLogo />
        <NavItems items={NAV_ITEMS} />
        <div className="flex items-center gap-2">
          <NavbarButton href="/login" variant="secondary">
            Sign in
          </NavbarButton>
          <NavbarButton href="/signup" variant="dark">
            Get started
          </NavbarButton>
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
          <div className="mt-2 flex w-full flex-col gap-2">
            <NavbarButton href="/login" variant="secondary" className="w-full text-center">
              Sign in
            </NavbarButton>
            <NavbarButton href="/signup" variant="dark" className="w-full text-center">
              Get started
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
