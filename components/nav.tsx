import Link from "next/link";

import type { NavigationGroup } from "@/lib/navigation";

type NavProps = {
  groups: NavigationGroup[];
};

export function Nav({ groups }: NavProps) {
  return (
    <nav className="space-y-7" aria-label="主导航">
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="px-3 text-xs font-semibold uppercase tracking-normal text-slate-400">
            {group.title}
          </h2>
          <div className="mt-2 space-y-1">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
