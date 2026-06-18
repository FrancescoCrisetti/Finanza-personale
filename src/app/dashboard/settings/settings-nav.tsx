"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/settings/profile", label: "Profilo" },
  { href: "/dashboard/settings/goals", label: "Obiettivi" },
  { href: "/dashboard/settings/liabilities", label: "Passività" },
  { href: "/dashboard/settings/external-assets", label: "Asset esterni" },
  { href: "/dashboard/settings/tax", label: "Fiscalità" },
  { href: "/dashboard/settings/strategy", label: "Strategia" },
  { href: "/dashboard/settings/tokens", label: "Token API" },
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
