"use server";

import { revalidatePath } from "next/cache";

import { createSafeAuditLog } from "@/lib/audit-log";
import { requireRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import {
  parseEnrollmentImportCsv,
  planGradePrefixEnrollments,
  parseTeachingClassImportCsv,
} from "@/lib/base-data/class-enrollment";
import { parseCourseImportCsv } from "@/lib/base-data/course-import";
import {
  courseSchema,
  enrollmentSchema,
  idSchema,
  idsSchema,
  organizationSchema,
  studentSchema,
  teacherSchema,
  teachingClassSchema,
} from "@/lib/base-data/validation";
import { parseStudentImportCsv } from "@/lib/base-data/student-import";
import { parseTeacherImportCsv } from "@/lib/base-data/teacher-import";
import { ADMIN_ROLES } from "@/lib/demo-data";

const defaultPassword = "Password123!";

export type BaseDataActionState = {
  ok: boolean;
  message: string;
};

const initialImportErrorMessage = "导入失败，请检查文件内容。";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return initialImportErrorMessage;
}

function baseDataPaths() {
  [
    "/admin/base-data",
    "/admin/base-data/organizations",
    "/admin/base-data/courses",
    "/admin/base-data/students",
    "/admin/base-data/teachers",
    "/admin/base-data/classes",
  ].forEach((path) => revalidatePath(path));
}

export async function createOrganization(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = organizationSchema.parse({
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.organization.create({ data: parsed });
  baseDataPaths();
}

export async function deleteOrganization(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const { id } = idSchema.parse({ id: String(formData.get("id") ?? "") });
  const { prisma } = await import("@/lib/db");
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: { children: true, users: true, courses: true, classes: true },
      },
    },
  });

  if (
    !organization ||
    organization._count.children ||
    organization._count.users ||
    organization._count.courses ||
    organization._count.classes
  ) {
    throw new Error("Organization is linked to data and cannot be deleted.");
  }

  await prisma.organization.delete({ where: { id } });
  baseDataPaths();
}

export async function createCourse(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = courseSchema.parse({
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    organizationId: String(formData.get("organizationId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.course.create({ data: parsed });
  baseDataPaths();
}

export async function deleteCourse(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const { id } = idSchema.parse({ id: String(formData.get("id") ?? "") });
  const { prisma } = await import("@/lib/db");
  const count = await prisma.teachingClass.count({ where: { courseId: id } });

  if (count > 0) {
    throw new Error("Course has teaching classes and cannot be deleted.");
  }

  await prisma.course.delete({ where: { id } });
  baseDataPaths();
}

export async function deleteCourses(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const rawIds = formData.getAll("ids").map((value) => String(value));

  if (rawIds.length === 0) {
    baseDataPaths();
    return;
  }

  const { ids } = idsSchema.parse({ ids: rawIds });
  const { prisma } = await import("@/lib/db");
  const courses = await prisma.course.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      _count: { select: { teachingClasses: true } },
    },
  });
  const deletableIds = courses
    .filter((course) => course._count.teachingClasses === 0)
    .map((course) => course.id);

  if (deletableIds.length === 0) {
    baseDataPaths();
    return;
  }

  await prisma.course.deleteMany({ where: { id: { in: deletableIds } } });
  baseDataPaths();
}

export async function importCourses(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please upload a CSV file.");
  }

  const rows = parseCourseImportCsv(await file.text());

  if (rows.length === 0) {
    baseDataPaths();
    return;
  }

  const { prisma } = await import("@/lib/db");
  const [organizations, existingCourses] = await Promise.all([
    prisma.organization.findMany({ select: { id: true, name: true } }),
    prisma.course.findMany({
      select: { code: true },
      where: { code: { in: rows.map((row) => row.code) } },
    }),
  ]);
  const organizationsByKey = new Map<string, string>();
  const existingCodes = new Set(existingCourses.map((course) => course.code));
  const seenCodes = new Set<string>();

  organizations.forEach((organization) => {
    organizationsByKey.set(organization.id, organization.id);
    organizationsByKey.set(organization.name, organization.id);
  });

  for (const row of rows) {
    const organizationId = row.organization
      ? organizationsByKey.get(row.organization)
      : undefined;

    if (
      existingCodes.has(row.code) ||
      seenCodes.has(row.code) ||
      (row.organization && !organizationId)
    ) {
      continue;
    }

    seenCodes.add(row.code);

    await prisma.course.create({
      data: {
        code: row.code,
        name: row.name,
        organizationId,
      },
    });
  }

  baseDataPaths();
}

export async function importCoursesWithState(
  _previousState: BaseDataActionState,
  formData: FormData,
): Promise<BaseDataActionState> {
  try {
    await importCourses(formData);

    return {
      ok: true,
      message: "课程导入完成。若部分记录未出现，请检查课程代码是否重复，组织是否匹配。",
    };
  } catch (error) {
    return {
      ok: false,
      message: `导入失败：${getErrorMessage(error)}`,
    };
  }
}

export async function createStudent(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = studentSchema.parse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    organizationId: String(formData.get("organizationId") ?? ""),
    studentNo: String(formData.get("studentNo") ?? ""),
    grade: String(formData.get("grade") ?? ""),
    major: String(formData.get("major") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.user.create({
    data: {
      email: parsed.email,
      name: parsed.name,
      organizationId: parsed.organizationId,
      role: "STUDENT",
      status: parsed.status,
      passwordHash: await hashPassword(defaultPassword),
      studentProfile: {
        create: {
          studentNo: parsed.studentNo,
          grade: parsed.grade,
          major: parsed.major,
        },
      },
    },
  });
  baseDataPaths();
}

export async function importStudents(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please upload a CSV file.");
  }

  const rows = parseStudentImportCsv(await file.text());
  const { prisma } = await import("@/lib/db");
  const [organizations, existingUsers, existingProfiles] = await Promise.all([
    prisma.organization.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { email: { in: rows.map((row) => row.email) } },
      select: { email: true },
    }),
    prisma.studentProfile.findMany({
      where: { studentNo: { in: rows.map((row) => row.studentNo) } },
      select: { studentNo: true },
    }),
  ]);
  const organizationsByKey = new Map<string, string>();

  organizations.forEach((organization) => {
    organizationsByKey.set(organization.id, organization.id);
    organizationsByKey.set(organization.name, organization.id);
  });

  const existingEmails = new Set(existingUsers.map((user) => user.email));
  const existingStudentNos = new Set(
    existingProfiles.map((profile) => profile.studentNo),
  );
  const seenEmails = new Set<string>();
  const seenStudentNos = new Set<string>();
  const passwordHash = await hashPassword(defaultPassword);

  for (const row of rows) {
    const organizationId = organizationsByKey.get(row.organization);

    if (
      !organizationId ||
      existingEmails.has(row.email) ||
      existingStudentNos.has(row.studentNo) ||
      seenEmails.has(row.email) ||
      seenStudentNos.has(row.studentNo)
    ) {
      continue;
    }

    seenEmails.add(row.email);
    seenStudentNos.add(row.studentNo);

    await prisma.user.create({
      data: {
        email: row.email,
        name: row.name,
        organizationId,
        passwordHash,
        role: "STUDENT",
        status: row.status,
        studentProfile: {
          create: {
            grade: row.grade,
            major: row.major,
            studentNo: row.studentNo,
          },
        },
      },
    });
  }

  baseDataPaths();
}

export async function importStudentsWithState(
  _previousState: BaseDataActionState,
  formData: FormData,
): Promise<BaseDataActionState> {
  try {
    await importStudents(formData);

    return {
      ok: true,
      message: "学生导入完成。若部分记录未出现，请检查邮箱、学号是否重复，组织是否匹配。",
    };
  } catch (error) {
    return {
      ok: false,
      message: `导入失败：${getErrorMessage(error)}`,
    };
  }
}

export async function deleteStudent(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const { id } = idSchema.parse({ id: String(formData.get("id") ?? "") });
  const { prisma } = await import("@/lib/db");
  const count = await prisma.enrollment.count({ where: { studentId: id } });
  const assignments = await prisma.evaluationAssignment.count({
    where: { evaluatorId: id },
  });

  if (count > 0 || assignments > 0) {
    throw new Error("Student is linked to enrollments or assignments.");
  }

  await prisma.user.delete({ where: { id } });
  baseDataPaths();
}

export async function deleteStudents(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const rawIds = formData.getAll("ids").map((value) => String(value));

  if (rawIds.length === 0) {
    baseDataPaths();
    return;
  }

  const { ids } = idsSchema.parse({
    ids: rawIds,
  });
  const { prisma } = await import("@/lib/db");
  const students = await prisma.user.findMany({
    where: { id: { in: ids }, role: "STUDENT" },
    select: {
      id: true,
      _count: { select: { enrollments: true, assignments: true } },
    },
  });
  const deletableIds = students
    .filter(
      (student) =>
        student._count.enrollments === 0 && student._count.assignments === 0,
    )
    .map((student) => student.id);

  if (deletableIds.length === 0) {
    baseDataPaths();
    return;
  }

  await prisma.user.deleteMany({
    where: { id: { in: deletableIds }, role: "STUDENT" },
  });
  baseDataPaths();
}

export async function markStudentGraduated(formData: FormData) {
  const session = await requireRole([...ADMIN_ROLES]);
  const { id } = idSchema.parse({ id: String(formData.get("id") ?? "") });
  const { prisma } = await import("@/lib/db");
  const student = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, status: true },
  });

  if (!student || student.role !== "STUDENT") {
    throw new Error("Student was not found.");
  }

  if (student.status === "GRADUATED") {
    baseDataPaths();
    return;
  }

  await prisma.user.update({
    where: { id },
    data: { status: "GRADUATED" },
  });
  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "MARK_STUDENT_GRADUATED",
    entity: "User",
    entityId: id,
    metadata: { fromStatus: student.status, studentName: student.name },
  });

  baseDataPaths();
}

export async function restoreGraduatedStudent(formData: FormData) {
  const session = await requireRole([...ADMIN_ROLES]);
  const { id } = idSchema.parse({ id: String(formData.get("id") ?? "") });
  const { prisma } = await import("@/lib/db");
  const student = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, status: true },
  });

  if (!student || student.role !== "STUDENT") {
    throw new Error("Student was not found.");
  }

  if (student.status !== "GRADUATED") {
    baseDataPaths();
    return;
  }

  await prisma.user.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "RESTORE_GRADUATED_STUDENT",
    entity: "User",
    entityId: id,
    metadata: { fromStatus: student.status, studentName: student.name },
  });

  baseDataPaths();
}

export async function markStudentsGraduated(formData: FormData) {
  const session = await requireRole([...ADMIN_ROLES]);
  const rawIds = formData.getAll("ids").map((value) => String(value));

  if (rawIds.length === 0) {
    baseDataPaths();
    return;
  }

  const { ids } = idsSchema.parse({ ids: rawIds });
  const { prisma } = await import("@/lib/db");
  const students = await prisma.user.findMany({
    where: {
      id: { in: ids },
      role: "STUDENT",
      status: { not: "GRADUATED" },
    },
    select: { id: true, status: true },
  });
  const studentIds = students.map((student) => student.id);

  if (studentIds.length === 0) {
    baseDataPaths();
    return;
  }

  await prisma.user.updateMany({
    where: { id: { in: studentIds }, role: "STUDENT" },
    data: { status: "GRADUATED" },
  });
  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "BATCH_MARK_STUDENTS_GRADUATED",
    entity: "User",
    metadata: {
      count: studentIds.length,
      studentIds,
    },
  });

  baseDataPaths();
}

export async function createTeacher(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = teacherSchema.parse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    organizationId: String(formData.get("organizationId") ?? ""),
    teacherNo: String(formData.get("teacherNo") ?? ""),
    title: String(formData.get("title") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.user.create({
    data: {
      email: parsed.email,
      name: parsed.name,
      organizationId: parsed.organizationId,
      role: "TEACHER",
      status: parsed.status,
      passwordHash: await hashPassword(defaultPassword),
      teacherProfile: {
        create: {
          teacherNo: parsed.teacherNo,
          title: parsed.title,
        },
      },
    },
  });
  baseDataPaths();
}

export async function deleteTeacher(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const { id } = idSchema.parse({ id: String(formData.get("id") ?? "") });
  const { prisma } = await import("@/lib/db");
  const count = await prisma.teachingClass.count({ where: { teacherId: id } });

  if (count > 0) {
    throw new Error("Teacher has teaching classes and cannot be deleted.");
  }

  await prisma.user.delete({ where: { id } });
  baseDataPaths();
}

export async function importTeachers(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please upload a CSV file.");
  }

  const rows = parseTeacherImportCsv(await file.text());
  const { prisma } = await import("@/lib/db");
  const [organizations, existingUsers, existingProfiles] = await Promise.all([
    prisma.organization.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { email: { in: rows.map((row) => row.email) } },
      select: { email: true },
    }),
    prisma.teacherProfile.findMany({
      where: { teacherNo: { in: rows.map((row) => row.teacherNo) } },
      select: { teacherNo: true },
    }),
  ]);
  const organizationsByKey = new Map<string, string>();

  organizations.forEach((organization) => {
    organizationsByKey.set(organization.id, organization.id);
    organizationsByKey.set(organization.name, organization.id);
  });

  const existingEmails = new Set(existingUsers.map((user) => user.email));
  const existingTeacherNos = new Set(
    existingProfiles.map((profile) => profile.teacherNo),
  );
  const seenEmails = new Set<string>();
  const seenTeacherNos = new Set<string>();
  const passwordHash = await hashPassword(defaultPassword);

  for (const row of rows) {
    const organizationId = organizationsByKey.get(row.organization);

    if (
      !organizationId ||
      existingEmails.has(row.email) ||
      existingTeacherNos.has(row.teacherNo) ||
      seenEmails.has(row.email) ||
      seenTeacherNos.has(row.teacherNo)
    ) {
      continue;
    }

    seenEmails.add(row.email);
    seenTeacherNos.add(row.teacherNo);

    await prisma.user.create({
      data: {
        email: row.email,
        name: row.name,
        organizationId,
        passwordHash,
        role: "TEACHER",
        status: row.status,
        teacherProfile: {
          create: {
            teacherNo: row.teacherNo,
            title: row.title,
          },
        },
      },
    });
  }

  baseDataPaths();
}

export async function importTeachersWithState(
  _previousState: BaseDataActionState,
  formData: FormData,
): Promise<BaseDataActionState> {
  try {
    await importTeachers(formData);

    return {
      ok: true,
      message: "教师导入完成。若部分记录未出现，请检查邮箱、工号是否重复，组织是否匹配。",
    };
  } catch (error) {
    return {
      ok: false,
      message: `导入失败：${getErrorMessage(error)}`,
    };
  }
}

export async function deleteTeachers(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const rawIds = formData.getAll("ids").map((value) => String(value));

  if (rawIds.length === 0) {
    baseDataPaths();
    return;
  }

  const { ids } = idsSchema.parse({ ids: rawIds });
  const { prisma } = await import("@/lib/db");
  const teachers = await prisma.user.findMany({
    where: { id: { in: ids }, role: "TEACHER" },
    select: {
      id: true,
      _count: { select: { taughtClasses: true } },
    },
  });
  const deletableIds = teachers
    .filter((teacher) => teacher._count.taughtClasses === 0)
    .map((teacher) => teacher.id);

  if (deletableIds.length === 0) {
    baseDataPaths();
    return;
  }

  await prisma.user.deleteMany({
    where: { id: { in: deletableIds }, role: "TEACHER" },
  });
  baseDataPaths();
}

export async function createTeachingClass(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = teachingClassSchema.parse({
    name: String(formData.get("name") ?? ""),
    term: String(formData.get("term") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
    teacherId: String(formData.get("teacherId") ?? ""),
    organizationId: String(formData.get("organizationId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.teachingClass.create({ data: parsed });
  baseDataPaths();
}

export async function importTeachingClasses(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please upload a CSV file.");
  }

  const rows = parseTeachingClassImportCsv(await file.text());

  if (rows.length === 0) {
    baseDataPaths();
    return;
  }

  const { prisma } = await import("@/lib/db");
  const [courses, teachers, organizations, existingClasses] =
    await Promise.all([
      prisma.course.findMany({
        select: { code: true, id: true },
        where: { code: { in: rows.map((row) => row.courseCode) } },
      }),
      prisma.teacherProfile.findMany({
        select: { teacherNo: true, userId: true },
        where: { teacherNo: { in: rows.map((row) => row.teacherNo) } },
      }),
      prisma.organization.findMany({ select: { id: true, name: true } }),
      prisma.teachingClass.findMany({
        select: { courseId: true, name: true, teacherId: true, term: true },
      }),
    ]);
  const coursesByCode = new Map(
    courses.map((course) => [course.code, course.id]),
  );
  const teachersByNo = new Map(
    teachers.map((teacher) => [teacher.teacherNo, teacher.userId]),
  );
  const organizationsByKey = new Map<string, string>();
  const existingKeys = new Set(
    existingClasses.map(
      (teachingClass) =>
        `${teachingClass.term}::${teachingClass.name}::${teachingClass.courseId}::${teachingClass.teacherId}`,
    ),
  );

  organizations.forEach((organization) => {
    organizationsByKey.set(organization.id, organization.id);
    organizationsByKey.set(organization.name, organization.id);
  });

  for (const row of rows) {
    const courseId = coursesByCode.get(row.courseCode);
    const teacherId = teachersByNo.get(row.teacherNo);
    const organizationId = row.organization
      ? organizationsByKey.get(row.organization)
      : undefined;

    if (!courseId || !teacherId || (row.organization && !organizationId)) {
      continue;
    }

    const key = `${row.term}::${row.name}::${courseId}::${teacherId}`;

    if (existingKeys.has(key)) {
      continue;
    }

    existingKeys.add(key);

    await prisma.teachingClass.create({
      data: {
        courseId,
        name: row.name,
        organizationId,
        teacherId,
        term: row.term,
      },
    });
  }

  baseDataPaths();
}

export async function importTeachingClassesWithState(
  _previousState: BaseDataActionState,
  formData: FormData,
): Promise<BaseDataActionState> {
  try {
    await importTeachingClasses(formData);

    return {
      ok: true,
      message: "教学班导入完成。若部分记录未出现，请检查课程代码、教师工号、组织是否匹配。",
    };
  } catch (error) {
    return {
      ok: false,
      message: `导入失败：${getErrorMessage(error)}`,
    };
  }
}

export async function deleteTeachingClass(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const { id } = idSchema.parse({ id: String(formData.get("id") ?? "") });
  const { prisma } = await import("@/lib/db");
  const assignmentCount = await prisma.evaluationAssignment.count({
    where: { teachingClassId: id },
  });

  if (assignmentCount > 0) {
    throw new Error("Teaching class has evaluation assignments.");
  }

  await prisma.teachingClass.delete({ where: { id } });
  baseDataPaths();
}

export async function deleteTeachingClasses(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const rawIds = formData.getAll("ids").map((value) => String(value));

  if (rawIds.length === 0) {
    baseDataPaths();
    return;
  }

  const { ids } = idsSchema.parse({ ids: rawIds });
  const { prisma } = await import("@/lib/db");
  const teachingClasses = await prisma.teachingClass.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      _count: { select: { assignments: true } },
    },
  });
  const deletableIds = teachingClasses
    .filter((teachingClass) => teachingClass._count.assignments === 0)
    .map((teachingClass) => teachingClass.id);

  if (deletableIds.length === 0) {
    baseDataPaths();
    return;
  }

  await prisma.teachingClass.deleteMany({
    where: { id: { in: deletableIds } },
  });
  baseDataPaths();
}

export async function createEnrollment(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = enrollmentSchema.parse({
    teachingClassId: String(formData.get("teachingClassId") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.enrollment.create({ data: parsed });
  baseDataPaths();
}

export async function importEnrollments(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please upload a CSV file.");
  }

  const rows = parseEnrollmentImportCsv(await file.text());

  if (rows.length === 0) {
    baseDataPaths();
    return;
  }

  const { prisma } = await import("@/lib/db");
  const [teachingClasses, studentProfiles, existingEnrollments] =
    await Promise.all([
      prisma.teachingClass.findMany({
        select: { id: true, name: true, term: true },
        where: {
          OR: rows.map((row) => ({
            name: row.teachingClassName,
            term: row.term,
          })),
        },
      }),
      prisma.studentProfile.findMany({
        select: { studentNo: true, userId: true },
        where: { studentNo: { in: rows.map((row) => row.studentNo) } },
      }),
      prisma.enrollment.findMany({
        select: { studentId: true, teachingClassId: true },
      }),
    ]);
  const classesByKey = new Map(
    teachingClasses.map((teachingClass) => [
      `${teachingClass.term}::${teachingClass.name}`,
      teachingClass.id,
    ]),
  );
  const studentsByNo = new Map(
    studentProfiles.map((profile) => [profile.studentNo, profile.userId]),
  );
  const existingKeys = new Set(
    existingEnrollments.map(
      (enrollment) =>
        `${enrollment.teachingClassId}::${enrollment.studentId}`,
    ),
  );

  for (const row of rows) {
    const teachingClassId = classesByKey.get(
      `${row.term}::${row.teachingClassName}`,
    );
    const studentId = studentsByNo.get(row.studentNo);

    if (!teachingClassId || !studentId) {
      continue;
    }

    const key = `${teachingClassId}::${studentId}`;

    if (existingKeys.has(key)) {
      continue;
    }

    existingKeys.add(key);

    await prisma.enrollment.create({
      data: { studentId, teachingClassId },
    });
  }

  baseDataPaths();
}

export async function importEnrollmentsWithState(
  _previousState: BaseDataActionState,
  formData: FormData,
): Promise<BaseDataActionState> {
  try {
    await importEnrollments(formData);

    return {
      ok: true,
      message: "选课导入完成。若部分记录未出现，请检查学期、教学班名称和学号是否匹配。",
    };
  } catch (error) {
    return {
      ok: false,
      message: `导入失败：${getErrorMessage(error)}`,
    };
  }
}

export async function generateEnrollmentsByGradePrefixWithState(
  _previousState: BaseDataActionState,
  _formData: FormData,
): Promise<BaseDataActionState> {
  void _previousState;
  void _formData;

  try {
    await requireRole([...ADMIN_ROLES]);
    const { prisma } = await import("@/lib/db");
    const [students, teachingClasses, existingEnrollments] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          studentProfile: { select: { grade: true } },
        },
        where: {
          role: "STUDENT",
          status: { not: "GRADUATED" },
        },
      }),
      prisma.teachingClass.findMany({
        select: { id: true, name: true },
        orderBy: [{ term: "desc" }, { name: "asc" }],
      }),
      prisma.enrollment.findMany({
        select: { studentId: true, teachingClassId: true },
      }),
    ]);
    const plannedEnrollments = planGradePrefixEnrollments({
      existingEnrollments,
      students: students.map((student) => ({
        id: student.id,
        grade: student.studentProfile?.grade,
      })),
      teachingClasses,
    });

    if (plannedEnrollments.length > 0) {
      await prisma.enrollment.createMany({
        data: plannedEnrollments,
        skipDuplicates: true,
      });
    }

    baseDataPaths();

    return {
      ok: true,
      message: `生成完成：新增 ${plannedEnrollments.length} 条选课记录。规则为学生年级匹配教学班名称前 7 位。`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `生成失败：${getErrorMessage(error)}`,
    };
  }
}

export async function deleteEnrollment(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const { id } = idSchema.parse({ id: String(formData.get("id") ?? "") });
  const { prisma } = await import("@/lib/db");
  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    select: { studentId: true, teachingClassId: true },
  });

  if (!enrollment) {
    baseDataPaths();
    return;
  }

  const assignmentCount = await prisma.evaluationAssignment.count({
    where: {
      evaluatorId: enrollment.studentId,
      teachingClassId: enrollment.teachingClassId,
    },
  });

  if (assignmentCount > 0) {
    throw new Error("Enrollment has evaluation assignments.");
  }

  await prisma.enrollment.delete({ where: { id } });
  baseDataPaths();
}

export async function deleteEnrollments(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const rawIds = formData.getAll("ids").map((value) => String(value));

  if (rawIds.length === 0) {
    baseDataPaths();
    return;
  }

  const { ids } = idsSchema.parse({ ids: rawIds });
  const { prisma } = await import("@/lib/db");
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: ids } },
    select: { id: true, studentId: true, teachingClassId: true },
  });

  if (enrollments.length === 0) {
    baseDataPaths();
    return;
  }

  const assignments = await prisma.evaluationAssignment.findMany({
    select: { evaluatorId: true, teachingClassId: true },
    where: {
      OR: enrollments.map((enrollment) => ({
        evaluatorId: enrollment.studentId,
        teachingClassId: enrollment.teachingClassId,
      })),
    },
  });
  const assignedKeys = new Set(
    assignments.map(
      (assignment) => `${assignment.teachingClassId}::${assignment.evaluatorId}`,
    ),
  );
  const deletableIds = enrollments
    .filter(
      (enrollment) =>
        !assignedKeys.has(`${enrollment.teachingClassId}::${enrollment.studentId}`),
    )
    .map((enrollment) => enrollment.id);

  if (deletableIds.length === 0) {
    baseDataPaths();
    return;
  }

  await prisma.enrollment.deleteMany({ where: { id: { in: deletableIds } } });
  baseDataPaths();
}
