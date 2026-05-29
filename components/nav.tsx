"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavigationGroup } from "@/lib/navigation";

type NavProps = {
  groups: NavigationGroup[];
};

export function Nav({ groups }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-max gap-5 lg:block lg:min-w-0 lg:space-y-7" aria-label="主导航">
      {groups.map((group) => (
        <section key={group.title} className="shrink-0">
          <h2 className="nav-group-title px-3 text-xs font-semibold uppercase tracking-normal text-slate-400">
            {group.title}
          </h2>
          <div className="mt-2 flex gap-1 lg:block lg:space-y-1">
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                    isActive ? "nav-link-active" : "text-slate-200"
                  }`}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
