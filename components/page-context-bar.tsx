"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buildPageContext } from "@/lib/page-context";
import type { NavigationGroup } from "@/lib/navigation";

type PageContextBarProps = {
  navigation: NavigationGroup[];
};

export function PageContextBar({ navigation }: PageContextBarProps) {
  const pathname = usePathname();
  const context = buildPageContext(pathname, navigation);

  if (context.breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="mb-5 border-b border-slate-200 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="当前位置" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            {context.breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.title}-${index}`} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-slate-300">
                    /
                  </span>
                ) : null}
                {crumb.href && !crumb.current ? (
                  <Link
                    href={crumb.href}
                    className="font-medium text-slate-500 transition hover:text-sky-700"
                  >
                    {crumb.title}
                  </Link>
                ) : (
                  <span
                    aria-current={crumb.current ? "page" : undefined}
                    className={
                      crumb.current
                        ? "font-semibold text-slate-950"
                        : "font-medium text-slate-400"
                    }
                  >
                    {crumb.title}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {context.parentHref ? (
          <Link
            href={context.parentHref}
            className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <span aria-hidden="true">←</span>
            {context.parentLabel ?? "返回上级"}
          </Link>
        ) : null}
      </div>

      {context.sectionItems.length > 0 ? (
        <nav
          aria-label={context.sectionTitle ?? "当前模块导航"}
          className="mt-3 overflow-x-auto"
        >
          <div className="flex min-w-max gap-2">
            {context.sectionItems.map((item) => (
              <Link
                key={item.href}
                href={item.href ?? "#"}
                aria-current={item.current ? "page" : undefined}
                className={
                  item.current
                    ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm"
                    : "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                }
              >
                {item.title}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
