import type { QuestionType } from "@/lib/generated/prisma/enums";

export type ImportedTemplateQuestion = {
  category?: string;
  sortOrder: number;
  title: string;
  maxScore: number | null;
  type: QuestionType;
  optionsText: string;
  required: boolean;
};

const requiredHeaders = ["分类", "题号", "题目", "分值", "题型", "选项串"];

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  cells.push(currentCell.trim());

  return cells;
}

function normalizeQuestionType(type: string): QuestionType {
  const normalizedType = type.trim().toLowerCase();

  if (
    normalizedType.includes("文本") ||
    normalizedType.includes("开放") ||
    normalizedType.includes("填空")
  ) {
    return "TEXT";
  }

  return "SCALE";
}

export function parseQuestionCsv(content: string): ImportedTemplateQuestion[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const indexes = Object.fromEntries(
    requiredHeaders.map((header) => [header, headers.indexOf(header)]),
  );

  requiredHeaders.forEach((header) => {
    if (indexes[header] === -1) {
      throw new Error(`CSV 缺少必需表头：${header}`);
    }
  });

  return lines.slice(1).flatMap((line, lineIndex) => {
    const cells = parseCsvLine(line);
    const title = cells[indexes["题目"]]?.trim();

    if (!title) {
      return [];
    }

    const scoreValue = Number(cells[indexes["分值"]]);
    const sortOrderValue = Number(cells[indexes["题号"]]);

    return [
      {
        category: cells[indexes["分类"]]?.trim() || undefined,
        sortOrder: Number.isInteger(sortOrderValue)
          ? sortOrderValue
          : lineIndex + 1,
        title,
        maxScore: Number.isFinite(scoreValue) && scoreValue >= 0 ? scoreValue : null,
        type: normalizeQuestionType(cells[indexes["题型"]] ?? ""),
        optionsText: cells[indexes["选项串"]]?.trim() ?? "",
        required: true,
      },
    ];
  });
}
