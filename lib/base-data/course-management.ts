export type CourseListQuery = {
  organizationId?: string;
  page: number;
  pageSize: 30 | 60 | 100;
  q?: string;
  teachingClassStatus: "ALL" | "WITH_CLASSES" | "WITHOUT_CLASSES";
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function optionalText(value: string | string[] | undefined) {
  const trimmedValue = firstValue(value)?.trim();

  return trimmedValue || undefined;
}

function parsePage(value: string | string[] | undefined) {
  const rawPage = Number(firstValue(value));

  return Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1;
}

function parsePageSize(value: string | string[] | undefined) {
  const rawPageSize = Number(firstValue(value));

  return [30, 60, 100].includes(rawPageSize)
    ? (rawPageSize as 30 | 60 | 100)
    : 30;
}

function parseTeachingClassStatus(value: string | string[] | undefined) {
  const rawStatus = firstValue(value);

  return rawStatus === "WITH_CLASSES" || rawStatus === "WITHOUT_CLASSES"
    ? rawStatus
    : "ALL";
}

export function parseCourseListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): CourseListQuery {
  return {
    organizationId: optionalText(searchParams.organizationId),
    page: parsePage(searchParams.page),
    pageSize: parsePageSize(searchParams.pageSize),
    q: optionalText(searchParams.q),
    teachingClassStatus: parseTeachingClassStatus(
      searchParams.teachingClassStatus,
    ),
  };
}

export function buildCourseListHref(
  query: CourseListQuery,
  updates: Partial<CourseListQuery>,
) {
  const merged = { ...query, ...updates };
  const params = new URLSearchParams();

  if (merged.q) {
    params.set("q", merged.q);
  }

  if (merged.organizationId) {
    params.set("organizationId", merged.organizationId);
  }

  if (merged.teachingClassStatus !== "ALL") {
    params.set("teachingClassStatus", merged.teachingClassStatus);
  }

  params.set("page", String(merged.page));
  params.set("pageSize", String(merged.pageSize));

  return `/admin/base-data/courses?${params.toString()}`;
}
