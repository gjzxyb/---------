export const ENROLLMENT_IMPORT_TEMPLATE_CSV =
  "学期,教学班,学号\n2025-2026-2,程序设计基础 1 班,S2026001\n";

export const TEACHING_CLASS_IMPORT_TEMPLATE_CSV =
  "教学班,学期,课程代码,教师工号,组织\n程序设计基础 1 班,2025-2026-2,CS101,T2026001,信息工程学院\n";

export type ClassListQuery = {
  classPage: number;
  classPageSize: 30 | 60 | 100;
  courseId?: string;
  organizationId?: string;
  q?: string;
  teacherId?: string;
  term?: string;
};

export type TeachingClassImportRow = {
  courseCode: string;
  name: string;
  organization?: string;
  teacherNo: string;
  term: string;
};

export type EnrollmentImportRow = {
  studentNo: string;
  teachingClassName: string;
  term: string;
};

export type EnrollmentListQuery = {
  enrollmentPage: number;
  enrollmentPageSize: 30 | 60 | 100;
  enrollmentQ?: string;
  enrollmentTerm?: string;
  enrollmentTeachingClassId?: string;
};

export type GradePrefixEnrollmentPlanInput = {
  existingEnrollments: { studentId: string; teachingClassId: string }[];
  students: { id: string; grade?: string | null }[];
  teachingClasses: { id: string; name: string }[];
};

export type PlannedEnrollment = {
  studentId: string;
  teachingClassId: string;
};

export type GradePrefixEnrollmentPlanSummary = {
  matchedClassCount: number;
  matchedStudentCount: number;
  plannedEnrollments: PlannedEnrollment[];
  unmatchedClassPrefixes: string[];
};

const teachingClassGradePrefixLength = 7;

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

function pageSize(value: string | string[] | undefined) {
  const rawPageSize = Number(firstValue(value));

  return [30, 60, 100].includes(rawPageSize)
    ? (rawPageSize as 30 | 60 | 100)
    : 30;
}

function page(value: string | string[] | undefined) {
  const rawPage = Number(firstValue(value));

  return Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1;
}

export function parseEnrollmentImportCsv(
  content: string,
): EnrollmentImportRow[] {
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
  const requiredHeaders = ["学期", "教学班", "学号"];
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
      studentNo: getCell("学号"),
      teachingClassName: getCell("教学班"),
      term: getCell("学期"),
    };

    if (!row.term || !row.teachingClassName || !row.studentNo) {
      throw new Error(`第 ${rowNumber} 行缺少学期、教学班或学号。`);
    }

    return row;
  });
}

export function parseTeachingClassImportCsv(
  content: string,
): TeachingClassImportRow[] {
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
  const requiredHeaders = ["教学班", "学期", "课程代码", "教师工号"];
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
      courseCode: getCell("课程代码"),
      name: getCell("教学班"),
      organization: getCell("组织") || undefined,
      teacherNo: getCell("教师工号"),
      term: getCell("学期"),
    };

    if (!row.name || !row.term || !row.courseCode || !row.teacherNo) {
      throw new Error(`第 ${rowNumber} 行缺少教学班、学期、课程代码或教师工号。`);
    }

    return row;
  });
}

export function parseClassListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ClassListQuery {
  return {
    classPage: page(searchParams.classPage),
    classPageSize: pageSize(searchParams.classPageSize),
    courseId: optionalQueryText(searchParams.courseId),
    organizationId: optionalQueryText(searchParams.organizationId),
    q: optionalQueryText(searchParams.q),
    teacherId: optionalQueryText(searchParams.teacherId),
    term: optionalQueryText(searchParams.term),
  };
}

export function parseEnrollmentListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): EnrollmentListQuery {
  return {
    enrollmentPage: page(searchParams.enrollmentPage),
    enrollmentPageSize: pageSize(searchParams.enrollmentPageSize),
    enrollmentQ: optionalQueryText(searchParams.enrollmentQ),
    enrollmentTeachingClassId: optionalQueryText(
      searchParams.enrollmentTeachingClassId,
    ),
    enrollmentTerm: optionalQueryText(searchParams.enrollmentTerm),
  };
}

export function planGradePrefixEnrollments({
  existingEnrollments,
  students,
  teachingClasses,
}: GradePrefixEnrollmentPlanInput): PlannedEnrollment[] {
  const existingKeys = new Set(
    existingEnrollments.map(
      (enrollment) =>
        `${enrollment.studentId}::${enrollment.teachingClassId}`,
    ),
  );
  const classesByPrefix = new Map<string, { id: string; name: string }[]>();

  for (const teachingClass of teachingClasses) {
    const prefix = teachingClass.name
      .slice(0, teachingClassGradePrefixLength)
      .trim();

    if (!prefix) {
      continue;
    }

    classesByPrefix.set(prefix, [
      ...(classesByPrefix.get(prefix) ?? []),
      teachingClass,
    ]);
  }

  return students.flatMap((student) => {
    const grade = student.grade?.trim();

    if (!grade) {
      return [];
    }

    return (classesByPrefix.get(grade) ?? [])
      .map((teachingClass) => ({
        studentId: student.id,
        teachingClassId: teachingClass.id,
      }))
      .filter((enrollment) => {
        const key = `${enrollment.studentId}::${enrollment.teachingClassId}`;

        return !existingKeys.has(key);
      });
  });
}

export function summarizeGradePrefixEnrollmentPlan(
  input: GradePrefixEnrollmentPlanInput,
): GradePrefixEnrollmentPlanSummary {
  const studentGrades = new Set(
    input.students.flatMap((student) => {
      const grade = student.grade?.trim();

      return grade ? [grade] : [];
    }),
  );
  const classPrefixes = Array.from(
    new Set(
      input.teachingClasses.flatMap((teachingClass) => {
        const prefix = teachingClass.name
          .slice(0, teachingClassGradePrefixLength)
          .trim();

        return prefix ? [prefix] : [];
      }),
    ),
  );
  const matchedClassPrefixes = new Set(
    classPrefixes.filter((prefix) => studentGrades.has(prefix)),
  );
  const plannedEnrollments = planGradePrefixEnrollments(input);

  return {
    matchedClassCount: input.teachingClasses.filter((teachingClass) =>
      matchedClassPrefixes.has(
        teachingClass.name.slice(0, teachingClassGradePrefixLength).trim(),
      ),
    ).length,
    matchedStudentCount: input.students.filter((student) => {
      const grade = student.grade?.trim();

      return grade ? matchedClassPrefixes.has(grade) : false;
    }).length,
    plannedEnrollments,
    unmatchedClassPrefixes: classPrefixes.filter(
      (prefix) => !studentGrades.has(prefix),
    ),
  };
}
