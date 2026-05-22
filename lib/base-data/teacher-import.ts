export const TEACHER_IMPORT_TEMPLATE_CSV =
  "姓名,邮箱,工号,职称,组织,状态\n李老师,lilaoshi@example.edu,T2026001,讲师,信息工程学院,ACTIVE\n";

export type TeacherImportRow = {
  email: string;
  name: string;
  organization: string;
  status: "ACTIVE" | "INACTIVE";
  teacherNo: string;
  title?: string;
};

export type TeacherListQuery = {
  organizationId?: string;
  page: number;
  pageSize: 30 | 60 | 100;
  q?: string;
  status?: "ACTIVE" | "INACTIVE";
  title?: string;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      cells.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  cells.push(currentCell.trim());

  return cells;
}

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

export function parseTeacherImportCsv(content: string): TeacherImportRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ["姓名", "邮箱", "工号", "组织"];
  const missingHeader = requiredHeaders.find(
    (header) => !headerIndex.has(header),
  );

  if (missingHeader) {
    throw new Error(`缺少必填字段：${missingHeader}`);
  }

  return lines.slice(1).map((line, lineIndex) => {
    const cells = parseCsvLine(line);
    const rowNumber = lineIndex + 2;
    const getCell = (header: string) =>
      cells[headerIndex.get(header) ?? -1] ?? "";
    const status = getCell("状态") || "ACTIVE";
    const row = {
      email: getCell("邮箱"),
      name: getCell("姓名"),
      organization: getCell("组织"),
      status,
      teacherNo: getCell("工号"),
      title: getCell("职称") || undefined,
    };

    if (!row.name || !row.email || !row.teacherNo || !row.organization) {
      throw new Error(`第 ${rowNumber} 行缺少姓名、邮箱、工号或组织。`);
    }

    if (row.status !== "ACTIVE" && row.status !== "INACTIVE") {
      throw new Error(`第 ${rowNumber} 行状态只能是 ACTIVE 或 INACTIVE。`);
    }

    return row as TeacherImportRow;
  });
}

export function parseTeacherListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): TeacherListQuery {
  const rawPage = Number(firstValue(searchParams.page));
  const rawPageSize = Number(firstValue(searchParams.pageSize));
  const status = optionalQueryText(searchParams.status);
  const pageSize = [30, 60, 100].includes(rawPageSize)
    ? (rawPageSize as 30 | 60 | 100)
    : 30;

  return {
    organizationId: optionalQueryText(searchParams.organizationId),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1,
    pageSize,
    q: optionalQueryText(searchParams.q),
    status:
      status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
    title: optionalQueryText(searchParams.title),
  };
}
