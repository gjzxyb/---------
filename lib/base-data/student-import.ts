export const STUDENT_IMPORT_TEMPLATE_CSV =
  "姓名,邮箱,学号,年级,专业,组织,状态\n张三,zhangsan@example.edu,S2026001,2026,计算机科学,高一一班,ACTIVE\n";

export type StudentImportRow = {
  name: string;
  email: string;
  studentNo: string;
  grade?: string;
  major?: string;
  organization: string;
  status: "ACTIVE" | "INACTIVE" | "GRADUATED";
};

export type StudentListQuery = {
  grade?: string;
  major?: string;
  organizationId?: string;
  page: number;
  pageSize: 30 | 60 | 100;
  q?: string;
  status?: "ACTIVE" | "INACTIVE" | "GRADUATED";
};

const studentStatuses = ["ACTIVE", "INACTIVE", "GRADUATED"] as const;
const studentStatusLabels: Record<string, StudentImportRow["status"]> = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  GRADUATED: "GRADUATED",
  停用: "INACTIVE",
  已停用: "INACTIVE",
  已毕业: "GRADUATED",
  毕业: "GRADUATED",
  启用: "ACTIVE",
  正常: "ACTIVE",
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

export function parseStudentImportCsv(content: string): StudentImportRow[] {
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
  const requiredHeaders = ["姓名", "邮箱", "学号", "组织"];
  const missingHeader = requiredHeaders.find(
    (header) => !headerIndex.has(header),
  );

  if (missingHeader) {
    throw new Error(`缺少必填字段：${missingHeader}`);
  }

  return lines.slice(1).map((line, lineIndex) => {
    const cells = parseCsvLine(line);
    const rowNumber = lineIndex + 2;
    const getCell = (header: string) => cells[headerIndex.get(header) ?? -1] ?? "";
    const rawStatus = getCell("状态") || "ACTIVE";
    const status = studentStatusLabels[rawStatus.toUpperCase()] ?? studentStatusLabels[rawStatus];
    const row = {
      email: getCell("邮箱"),
      grade: getCell("年级") || undefined,
      major: getCell("专业") || undefined,
      name: getCell("姓名"),
      organization: getCell("组织"),
      status: status ?? rawStatus,
      studentNo: getCell("学号"),
    };

    if (!row.name || !row.email || !row.studentNo || !row.organization) {
      throw new Error(`第 ${rowNumber} 行缺少姓名、邮箱、学号或组织。`);
    }

    if (!studentStatuses.includes(row.status as StudentImportRow["status"])) {
      throw new Error(
        `第 ${rowNumber} 行状态只能是 ACTIVE、INACTIVE、GRADUATED、启用、停用或已毕业。`,
      );
    }

    return row as StudentImportRow;
  });
}

export function parseStudentListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): StudentListQuery {
  const rawPage = Number(firstValue(searchParams.page));
  const rawPageSize = Number(firstValue(searchParams.pageSize));
  const status = optionalQueryText(searchParams.status);
  const pageSize = [30, 60, 100].includes(rawPageSize)
    ? (rawPageSize as 30 | 60 | 100)
    : 30;

  return {
    grade: optionalQueryText(searchParams.grade),
    major: optionalQueryText(searchParams.major),
    organizationId: optionalQueryText(searchParams.organizationId),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1,
    pageSize,
    q: optionalQueryText(searchParams.q),
    status: studentStatuses.includes(status as StudentImportRow["status"])
      ? (status as StudentImportRow["status"])
      : undefined,
  };
}
