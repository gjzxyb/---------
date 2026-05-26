import { z } from "zod";

export type StudentCourseQuery = {
  q: string;
  term: string;
};

export type StudentTeachingClassSummary = {
  id: string;
  name: string;
  term: string;
  course: { code: string; name: string };
  teacher: { name: string };
};

export const selfEnrollmentSchema = z.object({
  teachingClassId: z.string().trim().min(1, "请选择教学班"),
});

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseStudentCourseQuery(
  searchParams: Record<string, string | string[] | undefined>,
): StudentCourseQuery {
  return {
    q: firstValue(searchParams.q)?.trim() ?? "",
    term: firstValue(searchParams.term)?.trim() ?? "",
  };
}

export function canSelfUnenroll(assignmentCount: number) {
  return assignmentCount === 0;
}

export function filterAvailableTeachingClasses<
  T extends StudentTeachingClassSummary,
>(
  teachingClasses: T[],
  options: {
    enrolledTeachingClassIds: Set<string>;
    query: StudentCourseQuery;
  },
) {
  const keyword = options.query.q.toLowerCase();

  return teachingClasses.filter((teachingClass) => {
    if (options.enrolledTeachingClassIds.has(teachingClass.id)) {
      return false;
    }

    if (options.query.term && teachingClass.term !== options.query.term) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return [
      teachingClass.name,
      teachingClass.term,
      teachingClass.course.code,
      teachingClass.course.name,
      teachingClass.teacher.name,
    ].some((value) => value.toLowerCase().includes(keyword));
  });
}
