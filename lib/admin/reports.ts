export type ReportQuery = {
  courseId?: string;
  organizationId?: string;
  taskId?: string;
  teacherId?: string;
  term?: string;
};

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function optionalQueryText(value: string | string[] | undefined) {
  const trimmedValue = firstValue(value)?.trim();

  return trimmedValue || undefined;
}

export function parseReportQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ReportQuery {
  return {
    courseId: optionalQueryText(searchParams.courseId),
    organizationId: optionalQueryText(searchParams.organizationId),
    taskId: optionalQueryText(searchParams.taskId),
    teacherId: optionalQueryText(searchParams.teacherId),
    term: optionalQueryText(searchParams.term),
  };
}

export function buildReportSearchParams(
  query: ReportQuery,
  updates: Partial<ReportQuery> = {},
) {
  const params = new URLSearchParams();
  const merged = { ...query, ...updates };

  Object.entries(merged).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params;
}

export function maskSensitiveText(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱]")
    .replace(/1[3-9]\d{9}/g, "[手机号]")
    .replace(/\d{6,}/g, "[数字]");
}

export function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildCsv(headers: string[], rows: unknown[][]) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}
