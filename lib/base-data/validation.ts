import { z } from "zod";

const requiredString = z.string().trim().min(1);

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue || undefined;
}, z.string().optional());

export const idSchema = z.object({
  id: requiredString,
});

export const idsSchema = z.object({
  ids: z
    .array(requiredString)
    .min(1)
    .transform((ids) => Array.from(new Set(ids))),
});

export const organizationSchema = z.object({
  name: requiredString,
  type: z.enum(["SCHOOL", "DEPARTMENT", "CLASS"]),
  parentId: optionalString,
});

export const courseSchema = z.object({
  code: requiredString,
  name: requiredString,
  organizationId: optionalString,
});

export const studentSchema = z.object({
  name: requiredString,
  email: z.string().trim().email(),
  organizationId: requiredString,
  studentNo: requiredString,
  grade: optionalString,
  major: optionalString,
  status: z.enum(["ACTIVE", "INACTIVE", "GRADUATED"]),
});

export const teacherSchema = z.object({
  name: requiredString,
  email: z.string().trim().email(),
  organizationId: requiredString,
  teacherNo: requiredString,
  title: optionalString,
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const teachingClassSchema = z.object({
  name: requiredString,
  term: requiredString,
  courseId: requiredString,
  teacherId: requiredString,
  organizationId: optionalString,
});

export const enrollmentSchema = z.object({
  teachingClassId: requiredString,
  studentId: requiredString,
});
