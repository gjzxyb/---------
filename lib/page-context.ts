import type { NavigationGroup, NavigationItem } from "@/lib/navigation";

export type PageContextCrumb = {
  title: string;
  href?: string;
  current?: boolean;
};

export type PageContext = {
  breadcrumbs: PageContextCrumb[];
  parentHref?: string;
  parentLabel?: string;
  sectionTitle?: string;
  sectionItems: PageContextCrumb[];
};

type NavigationEntry = NavigationItem & {
  groupTitle: string;
};

const dynamicRoutes = [
  {
    prefix: "/student/evaluations/",
    parentHref: "/student/evaluations",
    title: "填写评教",
  },
  {
    prefix: "/teacher/results/",
    parentHref: "/teacher/results",
    title: "评价详情",
  },
  {
    prefix: "/admin/reports/classes/",
    parentHref: "/admin/reports",
    title: "教学班明细",
  },
] as const;

const dashboardHref = "/dashboard";

function normalizePathname(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

function flattenNavigation(navigation: NavigationGroup[]): NavigationEntry[] {
  return navigation.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupTitle: group.title,
    })),
  );
}

function findNavigationEntry(href: string, entries: NavigationEntry[]) {
  return entries.find((entry) => entry.href === href);
}

function findSectionItems(
  activeEntry: NavigationEntry | undefined,
  navigation: NavigationGroup[],
  pathname: string,
): PageContextCrumb[] {
  if (!activeEntry) {
    return [];
  }

  const activeGroup = navigation.find((group) => group.title === activeEntry.groupTitle);
  if (!activeGroup) {
    return [];
  }

  const matchedEntries = activeGroup.items
    .filter((item) => isSameOrChildPath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length);
  const activeHref = matchedEntries[0]?.href ?? activeEntry.href;

  return activeGroup.items.map((item) => ({
    title: item.title,
    href: item.href,
    current: item.href === activeHref,
  }));
}

function isSameOrChildPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildStaticBreadcrumbs(
  pathname: string,
  entries: NavigationEntry[],
): PageContextCrumb[] {
  const ancestors = entries
    .filter((entry) => isSameOrChildPath(pathname, entry.href))
    .sort((a, b) => a.href.length - b.href.length);

  const exact = ancestors.at(-1);
  if (!exact) {
    return [{ title: "工作台", href: "/dashboard" }, { title: "当前页面", current: true }];
  }

  return [
    { title: exact.groupTitle },
    ...ancestors.map((entry, index) => ({
      title: entry.title,
      href: entry.href,
      current: index === ancestors.length - 1 && pathname === entry.href,
    })),
  ];
}

export function buildPageContext(
  rawPathname: string,
  navigation: NavigationGroup[],
): PageContext {
  const pathname = normalizePathname(rawPathname);
  const entries = flattenNavigation(navigation);
  const dynamicRoute = dynamicRoutes.find((route) => pathname.startsWith(route.prefix));
  const contextPathname = dynamicRoute?.parentHref ?? pathname;
  const activeEntry =
    findNavigationEntry(contextPathname, entries) ??
    entries
      .filter((entry) => isSameOrChildPath(contextPathname, entry.href))
      .sort((a, b) => b.href.length - a.href.length)[0];
  const staticBreadcrumbs = buildStaticBreadcrumbs(
    contextPathname,
    entries,
  );
  const sectionItems = findSectionItems(activeEntry, navigation, contextPathname);

  if (dynamicRoute) {
    return {
      breadcrumbs: [
        ...staticBreadcrumbs.map((crumb) => ({ ...crumb, current: false })),
        { title: dynamicRoute.title, current: true },
      ],
      parentHref: dynamicRoute.parentHref,
      parentLabel: "返回上级",
      sectionTitle: activeEntry?.groupTitle,
      sectionItems,
    };
  }

  const linkedCrumbs = staticBreadcrumbs.filter((crumb) => crumb.href);
  const currentIndex = linkedCrumbs.findIndex((crumb) => crumb.href === pathname);
  const parentHref =
    currentIndex > 0
      ? linkedCrumbs[currentIndex - 1]?.href
      : pathname === dashboardHref
        ? undefined
        : dashboardHref;

  return {
    breadcrumbs: staticBreadcrumbs,
    parentHref,
    parentLabel: parentHref === dashboardHref ? "回到工作台" : "返回上级",
    sectionTitle: activeEntry?.groupTitle,
    sectionItems,
  };
}
