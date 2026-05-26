export const COURSE_IMPORT_TEMPLATE_CSV =
  "课程代码,课程名称,组织\nCS101,程序设计基础,信息工程学院\n";

export type CourseImportRow = {
  code: string;
  name: string;
  organization?: string;
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

export function parseCourseImportCsv(content: string): CourseImportRow[] {
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
  const requiredHeaders = ["课程代码", "课程名称"];
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
    const row = {
      code: getCell("课程代码"),
      name: getCell("课程名称"),
      organization: getCell("组织") || undefined,
    };

    if (!row.code || !row.name) {
      throw new Error(`第 ${rowNumber} 行缺少课程代码或课程名称。`);
    }

    return row;
  });
}
