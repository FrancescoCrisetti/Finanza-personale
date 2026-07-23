"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/profile", label: "Profilo" },
  { href: "/settings/goals", label: "Obiettivi" },
  { href: "/settings/liabilities", label: "Passività" },
  { href: "/settings/external-assets", label: "Asset esterni" },
  { href: "/settings/tax", label: "Fiscalità" },
  { href: "/settings/strategy", label: "Strategia" },
  { href: "/settings/allocation-targets", label: "Allocazione target" },
  { href: "/settings/tokens", label: "Token API" },
  { href: "/settings/diagnostics", label: "Diagnostica" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-gray-200 mb-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-black hover:border-gray-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
