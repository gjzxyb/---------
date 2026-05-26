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

function excelEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildExcelWorkbook({
  headers,
  rows,
  sheetName,
}: {
  headers: string[];
  rows: unknown[][];
  sheetName: string;
}) {
  const safeSheetName = excelEscape(sheetName);
  const headerHtml = headers
    .map((header) => `<th style="background:#e2e8f0;font-weight:700;">${excelEscape(header)}</th>`)
    .join("");
  const rowHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td style="mso-number-format:'\\@';">${excelEscape(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Excel.Sheet" />
  <style>
    table { border-collapse: collapse; font-family: "Microsoft YaHei", Arial, sans-serif; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  </style>
</head>
<body>
  <h1>${safeSheetName}</h1>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowHtml}</tbody>
  </table>
</body>
</html>`;
}

export type ScoreTrendChartConfig = {
  height: number;
  maxScore: number;
  padding: number;
  width: number;
};

export function buildScoreTrendCoordinates(
  scores: number[],
  { height, maxScore, padding, width }: ScoreTrendChartConfig,
) {
  const drawableWidth = Math.max(width - padding * 2, 0);
  const drawableHeight = Math.max(height - padding * 2, 0);
  const denominator = Math.max(scores.length - 1, 1);

  return scores.map((score, index) => {
    const x = padding + (drawableWidth * index) / denominator;
    const y = padding + ((maxScore - score) / maxScore) * drawableHeight;

    return {
      score,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  });
}

export function buildScoreTrendPath(
  scores: number[],
  config: ScoreTrendChartConfig,
) {
  return buildScoreTrendCoordinates(scores, config)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}
